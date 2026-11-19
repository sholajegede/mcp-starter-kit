import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { jwtVerifier } from '../src/auth/index.js';
import { quota } from '../src/billing/index.js';
import { defineServer, defineTool, createTool, ToolError } from '../src/index.js';
import { memoryStore } from '../src/store/index.js';
import { connect, createIssuer, ISSUER, RESOURCE, text } from './helpers.js';

const silent = { logLevel: 'silent' as const };

describe('HTTP server', async () => {
  const { jwks, sign } = await createIssuer();
  const auth = jwtVerifier({ issuer: ISSUER, audience: RESOURCE, jwks, scopesSupported: ['notes:read', 'notes:write'] });

  const notes = new Map<string, string>();
  const tool = createTool<{ owner: string }>();
  const failing = vi.fn(async (): Promise<string> => {
    throw new Error('database password is hunter2');
  });

  const tools = [
    tool({
      name: 'add_note',
      description: 'Save a note',
      input: z.object({ text: z.string().min(1) }),
      output: z.object({ id: z.string(), owner: z.string() }),
      scopes: ['notes:write'],
      handler: async ({ text }, ctx) => {
        const id = `n${notes.size + 1}`;
        notes.set(id, text);
        return { id, owner: ctx.services.owner };
      },
    }),
    defineTool({ name: 'whoami', description: 'Who is calling', cost: 0, handler: (_input, ctx) => ({ id: ctx.principal.id, plan: ctx.principal.plan ?? null }) }),
    defineTool({ name: 'explode', description: 'Always fails', handler: failing }),
    defineTool({
      name: 'refuse',
      description: 'Fails with a message for the model',
      handler: () => {
        throw new ToolError('Title must be unique', { code: 'conflict' });
      },
    }),
    defineTool({
      name: 'delete_all',
      description: 'Delete every note',
      annotations: { destructiveHint: true },
      confirm: 'Delete every note?',
      handler: () => {
        notes.clear();
        return 'All notes deleted';
      },
    }),
    defineTool({ name: 'limited', description: 'Rate limited', cost: 0, rateLimit: { limit: 2, window: '1m' }, handler: () => 'ok' }),
    defineTool({ name: 'slow', description: 'Too slow', timeoutMs: 50, handler: () => new Promise<string>((r) => setTimeout(() => r('late'), 1000)) }),
  ];

  const server = defineServer({
    name: 'notes',
    version: '1.0.0',
    tools,
    auth,
    publicUrl: RESOURCE,
    store: memoryStore(),
    entitlements: quota({ plans: { free: { units: 3, per: 'day' }, pro: { units: Infinity } }, upgradeUrl: 'https://notes.test/billing' }),
    services: (principal) => ({ owner: principal.id }),
    http: { corsOrigins: ['https://app.notes.test'] },
    ...silent,
  });

  it('serves health without auth', async () => {
    const res = await server.fetch(new Request('https://mcp.example.test/health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', name: 'notes' });
  });

  it('publishes protected resource metadata', async () => {
    const res = await server.fetch(new Request('https://mcp.example.test/.well-known/oauth-protected-resource/mcp'));
    expect(await res.json()).toEqual({
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      bearer_methods_supported: ['header'],
      resource_name: 'notes',
      scopes_supported: ['notes:read', 'notes:write'],
    });
  });

  it('challenges unauthenticated requests with a pointer to the metadata', async () => {
    const res = await server.fetch(new Request(RESOURCE, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata="https://mcp.example.test/.well-known/oauth-protected-resource/mcp"');
  });

  it('rejects tokens minted for another API', async () => {
    const token = await sign({}, { audience: 'https://other.api' });
    await expect(connect(server, { token })).rejects.toThrow();
  });

  for (const era of ['modern', 'legacy'] as const) {
    it(`lists tools and returns structured output (${era})`, async () => {
      const client = await connect(server, { era, token: await sign({ sub: 'u_struct', scope: 'notes:write', plan: 'pro' }) });
      const { tools: listed } = await client.listTools();
      expect(listed.map((t) => t.name)).toEqual(['add_note', 'whoami', 'explode', 'refuse', 'delete_all', 'limited', 'slow']);
      const result = await client.callTool({ name: 'add_note', arguments: { text: 'hello' } });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ owner: 'u_struct' });
    });
  }

  it('validates input before the handler runs', async () => {
    const client = await connect(server, { token: await sign({ scope: 'notes:write', plan: 'pro' }) });
    const result = await client.callTool({ name: 'add_note', arguments: { text: '' } });
    expect(result.isError).toBe(true);
  });

  it('returns ToolError messages to the model', async () => {
    const client = await connect(server, { token: await sign({ plan: 'pro' }) });
    const result = await client.callTool({ name: 'refuse', arguments: {} });
    expect(result).toMatchObject({ isError: true });
    expect(text(result)).toBe('Title must be unique');
  });

  it('hides unexpected errors from the client', async () => {
    const client = await connect(server, { token: await sign({ plan: 'pro' }) });
    const result = await client.callTool({ name: 'explode', arguments: {} });
    expect(result.isError).toBe(true);
    expect(text(result)).not.toContain('hunter2');
    expect(text(result)).toMatch(/failed unexpectedly\. Reference: [0-9a-f-]{36}/);
  });

  it('sends a scope challenge when the token lacks a required scope', async () => {
    const client = await connect(server, { token: await sign({ scope: 'notes:read', plan: 'pro' }) });
    await expect(client.callTool({ name: 'add_note', arguments: { text: 'x' } })).rejects.toThrow();
  });

  it('enforces quotas per principal and refunds failed calls', async () => {
    const client = await connect(server, { token: await sign({ sub: 'u_quota' }) });
    await client.callTool({ name: 'explode', arguments: {} });
    for (let i = 0; i < 3; i++) expect((await client.callTool({ name: 'refuse', arguments: {} })).isError).toBe(true);
    const ok = await connect(server, { token: await sign({ sub: 'u_quota', scope: 'notes:write' }) });
    for (let i = 0; i < 3; i++) expect((await ok.callTool({ name: 'add_note', arguments: { text: `n${i}` } })).isError).toBeFalsy();
    const denied = await ok.callTool({ name: 'add_note', arguments: { text: 'one too many' } });
    expect(denied.isError).toBe(true);
    expect(text(denied)).toContain('Usage limit reached on the free plan');
    expect(text(denied)).toContain('https://notes.test/billing');
    const free = await ok.callTool({ name: 'whoami', arguments: {} });
    expect(free.isError).toBeFalsy();
  });

  it('rate limits per principal', async () => {
    const client = await connect(server, { token: await sign({ sub: 'u_rl' }) });
    expect(text(await client.callTool({ name: 'limited', arguments: {} }))).toBe('ok');
    expect(text(await client.callTool({ name: 'limited', arguments: {} }))).toBe('ok');
    const third = await client.callTool({ name: 'limited', arguments: {} });
    expect(third.isError).toBe(true);
    expect(text(third)).toMatch(/Rate limit reached for limited\. Try again in \d+s/);
    const other = await connect(server, { token: await sign({ sub: 'u_rl_2' }) });
    expect(text(await other.callTool({ name: 'limited', arguments: {} }))).toBe('ok');
  });

  it('asks for confirmation through multi round-trip input', async () => {
    notes.set('keep', 'me');
    const declined = await connect(server, { token: await sign({ plan: 'pro' }), elicit: () => ({ action: 'accept', content: { confirm: false } }) });
    expect(text(await declined.callTool({ name: 'delete_all', arguments: {} }))).toContain('Cancelled');
    expect(notes.size).toBeGreaterThan(0);

    const prompts: string[] = [];
    const accepted = await connect(server, {
      token: await sign({ plan: 'pro' }),
      elicit: (message) => {
        prompts.push(message);
        return { action: 'accept', content: { confirm: true } };
      },
    });
    expect(text(await accepted.callTool({ name: 'delete_all', arguments: {} }))).toBe('All notes deleted');
    expect(prompts).toEqual(['Delete every note?']);
    expect(notes.size).toBe(0);
  });

  it('refuses to run a confirm-gated tool when the client cannot confirm', async () => {
    notes.set('keep', 'me');
    const client = await connect(server, { era: 'legacy', token: await sign({ plan: 'pro' }) });
    const result = await client.callTool({ name: 'delete_all', arguments: {} });
    expect(result.isError).toBe(true);
    expect(notes.size).toBe(1);
  });

  it('times out slow handlers', async () => {
    const client = await connect(server, { token: await sign({ plan: 'pro' }) });
    const result = await client.callTool({ name: 'slow', arguments: {} });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('slow timed out.');
  });

  it('adds CORS headers only for allowed origins', async () => {
    const pre = await server.fetch(new Request(RESOURCE, { method: 'OPTIONS', headers: { origin: 'https://app.notes.test' } }));
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://app.notes.test');
    const evil = await server.fetch(new Request(RESOURCE, { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }));
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('runs hooks around each call', async () => {
    const events: string[] = [];
    const hooked = defineServer({
      name: 'hooked',
      version: '1.0.0',
      allowAnonymous: true,
      tools: [defineTool({ name: 'ping', description: 'Ping', handler: () => 'pong' })],
      hooks: { onToolStart: (e) => void events.push(`start:${e.tool}`), onToolEnd: (e) => void events.push(`end:${e.tool}:${e.ok}`) },
      ...silent,
    });
    const client = await connect(hooked);
    await client.callTool({ name: 'ping', arguments: {} });
    expect(events).toEqual(['start:ping', 'end:ping:true']);
  });
});

describe('configuration', () => {
  it('refuses HTTP traffic when no auth is configured', async () => {
    const server = defineServer({ name: 's', version: '1', tools: [], ...silent });
    const res = await server.fetch(new Request('http://localhost/mcp', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(503);
  });

  it('rejects duplicate and invalid tool names', () => {
    const t = defineTool({ name: 'a', description: 'x', handler: () => 'x' });
    expect(() => defineServer({ name: 's', version: '1', tools: [t, t] })).toThrow('Duplicate tool name');
    expect(() => defineServer({ name: 's', version: '1', tools: [{ ...t, name: 'has space' }] })).toThrow(/must be 1-128/);
    expect(() => defineServer({ name: 's', version: '1', tools: [{ ...t, description: '' }] })).toThrow(/needs a description/);
  });

  it('requires https for public URLs', () => {
    expect(() => defineServer({ name: 's', version: '1', tools: [], publicUrl: 'http://api.example.com/mcp' })).toThrow(/https/);
  });
});
