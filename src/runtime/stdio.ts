import { serveStdio as sdkServeStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { AuthError } from '../errors.js';
import type { StarterServer } from '../server.js';
import type { Principal } from '../types.js';

export interface StdioOptions {
  /**
   * Credential for this process. Defaults to `MCP_ACCESS_TOKEN`, then
   * `MCP_API_KEY`. Verified with the server's `auth` before serving, the way
   * the MCP spec asks stdio servers to take credentials from the environment.
   */
  token?: string;
  /**
   * Identity to run as when the server has no `auth`. Defaults to a local
   * principal holding every scope, since a stdio process runs as the user
   * who started it.
   */
  principal?: Partial<Principal>;
}

/** Serve over stdin/stdout for local clients (Claude Desktop, Cursor, VS Code, Claude Code). All logs go to stderr. */
export async function serveStdio(server: StarterServer, options: StdioOptions = {}): Promise<StdioServerHandle> {
  const token = options.token ?? process.env.MCP_ACCESS_TOKEN ?? process.env.MCP_API_KEY;
  const auth = server.config.auth;
  let principal: Principal;
  let expiresAt: number | undefined;

  if (auth) {
    if (!token) {
      throw new AuthError(`${server.name} requires a credential. Set MCP_ACCESS_TOKEN or MCP_API_KEY in the client's MCP config.`);
    }
    const verified = await auth.verify(token);
    principal = verified.principal;
    expiresAt = verified.expiresAt;
  } else {
    principal = { id: 'local', kind: 'local', scopes: ['*'], claims: {}, ...options.principal };
  }

  if (expiresAt) {
    const ms = expiresAt * 1000 - Date.now();
    if (ms > 0 && ms < 2 ** 31) {
      setTimeout(() => {
        server.log.error('credential expired, shutting down so the client restarts with a fresh one');
        process.exit(1);
      }, ms).unref();
    }
  }

  const handle = sdkServeStdio((context) => server.build(context, principal), {
    onerror: (error) => server.log.error('stdio transport', { error }),
  });
  server.log.info('serving on stdio', { principal: principal.id });

  const shutdown = () => void handle.close().finally(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return handle;
}
