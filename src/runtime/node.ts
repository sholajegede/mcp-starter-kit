import { createServer, type Server } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { StarterServer } from '../server.js';

export interface ListenOptions {
  /** Defaults to `PORT`, then 3000. */
  port?: number;
  /** Defaults to `127.0.0.1`. Use `0.0.0.0` in containers. */
  host?: string;
  /** Called once the server is listening. */
  onListen?: (info: { url: string }) => void;
}

const loopback = new Set(['127.0.0.1', 'localhost', '::1']);

/** Serve over Node's `http` module. Loopback binds reject non-local `Host` headers to block DNS rebinding. */
export function listen(server: StarterServer, options: ListenOptions = {}): Promise<{ url: string; close(): Promise<void>; http: Server }> {
  const port = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  const host = options.host ?? '127.0.0.1';
  const local = loopback.has(host);
  const allowed = server.config.http?.allowedHosts ?? (local ? ['localhost', '127.0.0.1', '[::1]'] : undefined);

  const fetchWithHostCheck = async (request: Request) => {
    if (allowed) {
      const hostname = (request.headers.get('host') ?? '').replace(/:\d+$/, '');
      if (!allowed.includes(hostname)) return new Response(JSON.stringify({ error: 'invalid_host' }), { status: 403 });
    }
    return server.fetch(request);
  };

  const handle = toNodeHandler({ fetch: fetchWithHostCheck }, { onerror: (error) => server.log.error('node handler', { error }) });
  const http = createServer((req, res) => {
    void handle(req, res);
  });

  return new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, host, () => {
      const address = http.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      const url = `http://${host.includes(':') ? `[${host}]` : host}:${actualPort}${server.config.http?.path ?? '/mcp'}`;
      server.log.info('listening', { url });
      options.onListen?.({ url });

      const close = async () => {
        await server.close();
        await new Promise<void>((done) => http.close(() => done()));
      };
      const shutdown = () => void close().then(() => process.exit(0));
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
      resolve({ url, close, http });
    });
  });
}
