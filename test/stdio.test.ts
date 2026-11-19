import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixture = fileURLToPath(new URL('./fixtures/stdio-server.ts', import.meta.url));

async function start(env: Record<string, string>, era: 'modern' | 'legacy') {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', fixture],
    env: { ...(process.env as Record<string, string>), ...env },
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'stdio-test', version: '1.0.0' },
    { versionNegotiation: { mode: era === 'legacy' ? 'legacy' : { pin: '2026-07-28' } } },
  );
  await client.connect(transport);
  return client;
}

describe('stdio runtime', () => {
  for (const era of ['modern', 'legacy'] as const) {
    it(`serves tools over stdio with logs kept off stdout (${era})`, async () => {
      const client = await start({}, era);
      const result = await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
      expect(result.structuredContent).toEqual({ sum: 5 });
      const who = await client.callTool({ name: 'whoami', arguments: {} });
      expect((who.content as Array<{ text: string }>)[0]!.text).toBe('local');
      await client.close();
    });
  }

  it('verifies the credential from the environment', async () => {
    const client = await start({ FIXTURE_AUTH: '1', MCP_API_KEY: 'secret' }, 'modern');
    const who = await client.callTool({ name: 'whoami', arguments: {} });
    expect((who.content as Array<{ text: string }>)[0]!.text).toBe('cli_user');
    await client.close();
  });

  it('refuses to start without a credential when auth is configured', async () => {
    await expect(start({ FIXTURE_AUTH: '1', MCP_API_KEY: '', MCP_ACCESS_TOKEN: '' }, 'legacy')).rejects.toThrow();
  });
});
