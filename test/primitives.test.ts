import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { jwtVerifier } from '../src/auth/index.js';
import { definePrompt, defineResource, defineResourceTemplate, defineServer, defineTool, ToolError } from '../src/index.js';
import { connect, createIssuer, ISSUER, RESOURCE } from './helpers.js';

describe('resources and prompts', async () => {
  const { jwks, sign } = await createIssuer();
  const docs: Record<string, string> = { onboarding: 'Read the handbook first.', billing: 'Invoices go out on the 1st.' };

  const server = defineServer({
    name: 'kb',
    version: '1.0.0',
    publicUrl: RESOURCE,
    auth: jwtVerifier({ issuer: ISSUER, audience: RESOURCE, jwks }),
    logLevel: 'silent',
    services: (principal) => ({ tenant: principal.orgId ?? principal.id }),
    tools: [defineTool({ name: 'noop', description: 'No-op', cost: 0, handler: () => 'ok' })],
    resources: [
      defineResource<{ tenant: string }>({ name: 'limits', uri: 'config://limits', mimeType: 'application/json', read: (ctx) => JSON.stringify({ tenant: ctx.services.tenant, max: 10 }) }),
      defineResourceTemplate({
        name: 'doc',
        uriTemplate: 'docs://{slug}',
        mimeType: 'text/markdown',
        list: () => Object.keys(docs).map((slug) => ({ uri: `docs://${slug}`, name: slug })),
        read: ({ slug }) => {
          const text = docs[slug!];
          if (!text) throw new ToolError(`No doc called ${slug}`);
          return text;
        },
      }),
      defineResource({ name: 'secrets', uri: 'admin://secrets', scopes: ['admin'], read: () => 'top secret' }),
      defineResource({ name: 'broken', uri: 'config://broken', read: () => { throw new Error('db password leaked'); } }),
    ],
    prompts: [
      definePrompt({
        name: 'review_invoice',
        title: 'Review an invoice',
        args: z.object({ invoiceId: z.string() }),
        render: ({ invoiceId }, ctx) => `Review invoice ${invoiceId} for ${ctx.principal.email ?? ctx.principal.id}. Flag anything unusual.`,
      }),
    ],
  });

  it('reads fixed resources with services', async () => {
    const client = await connect(server, { token: await sign({ org_code: 'org_7' }) });
    const { contents } = await client.readResource({ uri: 'config://limits' });
    expect(contents[0]).toMatchObject({ uri: 'config://limits', mimeType: 'application/json' });
    expect(JSON.parse((contents[0] as { text: string }).text)).toEqual({ tenant: 'org_7', max: 10 });
  });

  it('lists and reads templated resources', async () => {
    const client = await connect(server, { token: await sign() });
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(expect.arrayContaining(['config://limits', 'docs://onboarding', 'docs://billing']));
    const { contents } = await client.readResource({ uri: 'docs://billing' });
    expect((contents[0] as { text: string }).text).toBe('Invoices go out on the 1st.');
    await expect(client.readResource({ uri: 'docs://missing' })).rejects.toThrow('No doc called missing');
  });

  it('enforces scopes and hides internal errors', async () => {
    const client = await connect(server, { era: 'legacy', token: await sign() });
    await expect(client.readResource({ uri: 'admin://secrets' })).rejects.toThrow();
    const err = await client.readResource({ uri: 'config://broken' }).catch((e: Error) => e);
    expect(String(err)).not.toContain('db password');
    const admin = await connect(server, { era: 'legacy', token: await sign({ scope: 'admin' }) });
    expect(((await admin.readResource({ uri: 'admin://secrets' })).contents[0] as { text: string }).text).toBe('top secret');
  });

  it('renders prompts with typed arguments', async () => {
    const client = await connect(server, { token: await sign({ email: 'ops@acme.test' }) });
    const { prompts } = await client.listPrompts();
    expect(prompts[0]).toMatchObject({ name: 'review_invoice', title: 'Review an invoice' });
    const result = await client.getPrompt({ name: 'review_invoice', arguments: { invoiceId: 'inv_42' } });
    expect(result.messages[0]!.content).toEqual({ type: 'text', text: 'Review invoice inv_42 for ops@acme.test. Flag anything unusual.' });
  });

  it('advertises resource and prompt scopes in metadata', async () => {
    const res = await server.fetch(new Request('https://mcp.example.test/.well-known/oauth-protected-resource/mcp'));
    expect((await res.json()).scopes_supported).toEqual(['admin']);
  });
});
