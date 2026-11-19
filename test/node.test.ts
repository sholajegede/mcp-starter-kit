import { request } from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, describe, expect, it } from 'vitest';
import { defineServer, defineTool } from '../src/index.js';
import { listen } from '../src/runtime/node.js';

describe('node runtime', async () => {
  const server = defineServer({
    name: 'node-test',
    version: '1.0.0',
    allowAnonymous: true,
    logLevel: 'silent',
    tools: [defineTool({ name: 'ping', description: 'Ping', handler: () => 'pong' })],
  });
  const running = await listen(server, { port: 0 });
  afterAll(() => running.close());

  it('serves MCP over real HTTP', async () => {
    const client = new Client({ name: 'c', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
    await client.connect(new StreamableHTTPClientTransport(new URL(running.url)));
    const result = await client.callTool({ name: 'ping', arguments: {} });
    expect((result.content as Array<{ text: string }>)[0]!.text).toBe('pong');
  });

  it('rejects foreign Host headers on a loopback bind', async () => {
    const url = new URL(running.url);
    const status = await new Promise<number>((resolve, reject) => {
      request({ host: url.hostname, port: url.port, path: '/health', headers: { host: 'evil.test' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
        .on('error', reject)
        .end();
    });
    expect(status).toBe(403);
  });
});
