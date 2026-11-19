import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  requireBearerAuth,
  type AuthInfo,
  type Icon,
  type McpHttpHandler,
  type McpRequestContext,
  type OAuthTokenVerifier,
  type PerRequestResponseMode,
  validateHostHeader,
} from '@modelcontextprotocol/server';
import { unmetered } from './billing/index.js';
import type { Entitlements } from './billing/types.js';
import { ConfigError } from './errors.js';
import { noLlm } from './llm/index.js';
import type { LlmClient } from './llm/types.js';
import { createLogger, type Logger, type LogLevel } from './logger.js';
import { memoryStore } from './store/memory.js';
import type { Store } from './store/types.js';
import { registerTool, type AnyTool } from './tool.js';
import { registerPrompt, registerResource, type AnyPrompt, type AnyResource } from './primitives.js';
import { noTelemetry, type Telemetry } from './telemetry.js';
import type { Awaitable, Principal, ServerHooks, TokenVerifier } from './types.js';

export interface HttpOptions {
  /** Path the MCP endpoint is served on. Defaults to `/mcp`. */
  path?: string;
  /**
   * Browser origins allowed to call the endpoint. Leave unset for server-side
   * clients only. `'*'` allows any origin, which only makes sense for
   * token-authenticated public servers.
   */
  corsOrigins?: string[] | '*';
  /** Accepted `Host` header values. Set this behind a known domain to block DNS rebinding. */
  allowedHosts?: string[];
  /** Serve 2025-era clients statelessly (default) or reject them. */
  legacy?: 'stateless' | 'reject';
  responseMode?: PerRequestResponseMode;
  /** Serve `GET /health`. Defaults to true. */
  health?: boolean;
}

export interface ServerSetupContext {
  principal: Principal;
  store: Store;
  log: Logger;
}

export interface ServerConfig<Services = unknown> {
  name: string;
  version: string;
  title?: string;
  description?: string;
  /** Guidance for the model on how to use this server's tools together. */
  instructions?: string;
  websiteUrl?: string;
  icons?: Icon[];
  tools: AnyTool[];
  /** Read-only context the client can load: docs, configuration, records addressed by URI. */
  resources?: AnyResource[];
  /** Reusable prompt templates users pick from the client's menu. */
  prompts?: AnyPrompt[];
  /** Verifies bearer tokens on HTTP and the startup token on stdio. */
  auth?: TokenVerifier;
  /** Serve HTTP without authentication. Only for local development or public read-only servers. */
  allowAnonymous?: boolean;
  /**
   * Public URL of the MCP endpoint, e.g. `https://api.example.com/mcp`. Used as
   * the resource identifier in OAuth metadata. Set your verifier's `audience`
   * to the same value so tokens minted for other APIs are refused.
   */
  publicUrl?: string;
  scopesSupported?: string[];
  store?: Store;
  entitlements?: Entitlements;
  llm?: LlmClient;
  /** Per-request dependencies handed to tools as `ctx.services`: a database client, an SDK, a tenant-scoped repository. */
  services?: (principal: Principal, runtime: { store: Store; log: Logger }) => Awaitable<Services>;
  /** Register resources, prompts or anything else directly on the SDK server. */
  setup?: (server: McpServer, context: ServerSetupContext) => void;
  hooks?: ServerHooks;
  /** Tracing and metrics. Use `openTelemetry()` from `mcp-starter-kit/otel`. */
  telemetry?: Telemetry;
  logLevel?: LogLevel;
  logger?: Logger;
  http?: HttpOptions;
}

export interface StarterServer {
  readonly name: string;
  readonly version: string;
  readonly config: ServerConfig<any>;
  readonly log: Logger;
  readonly store: Store;
  /** Web-standard handler. Export it from Cloudflare Workers, Bun, Deno, Vercel, Netlify or any fetch-based router. */
  fetch(request: Request): Promise<Response>;
  /** Builds an SDK server for one request or connection. Used by the stdio and Node runtimes. */
  build(context: McpRequestContext, principal: Principal, token?: string): McpServer;
  /** Notify subscribed clients that the tool list changed. */
  toolsChanged(): void;
  close(): Promise<void>;
}

export const ANONYMOUS: Principal = Object.freeze({ id: 'anonymous', kind: 'anonymous', scopes: [], claims: {} }) as Principal;

function toSdkVerifier(verifier: TokenVerifier, resource?: URL): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token): Promise<AuthInfo> {
      try {
        const verified = await verifier.verify(token);
        const info: AuthInfo = {
          token,
          clientId: verified.principal.clientId ?? verified.principal.id,
          scopes: verified.principal.scopes,
          expiresAt: verified.expiresAt,
          extra: { principal: verified.principal },
        };
        if (resource && verified.audience.some((a) => a.replace(/\/$/, '') === resource.href.replace(/\/$/, ''))) info.resource = resource;
        return info;
      } catch (error) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, error instanceof Error ? error.message : 'Invalid token');
      }
    },
  };
}

function validateConfig(config: ServerConfig<any>): void {
  if (!config.name) throw new ConfigError('defineServer: name is required');
  if (!config.version) throw new ConfigError('defineServer: version is required');
  const names = new Set<string>();
  for (const tool of config.tools) {
    if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name)) throw new ConfigError(`Tool name "${tool.name}" must be 1-128 letters, digits, "_", "-" or "."`);
    if (names.has(tool.name)) throw new ConfigError(`Duplicate tool name "${tool.name}"`);
    if (!tool.description?.trim()) throw new ConfigError(`Tool "${tool.name}" needs a description`);
    names.add(tool.name);
  }
  const seen = new Set<string>();
  for (const item of [...(config.resources ?? []), ...(config.prompts ?? [])]) {
    const key = `${'render' in item ? 'prompt' : 'resource'}:${item.name}`;
    if (seen.has(key)) throw new ConfigError(`Duplicate ${key.replace(':', ' name "')}"`);
    seen.add(key);
  }
  if (config.publicUrl) {
    const url = new URL(config.publicUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) throw new ConfigError('publicUrl must use https outside localhost');
  }
}

/** Declare an MCP server once and serve it over HTTP, Node or stdio. */
export function defineServer<Services = unknown>(config: ServerConfig<Services>): StarterServer {
  validateConfig(config);
  const log = config.logger ?? createLogger({ level: config.logLevel ?? 'info' }, { server: config.name });
  const store = config.store ?? memoryStore();
  const entitlements = config.entitlements ?? unmetered();
  const llm = config.llm ?? noLlm();
  const hooks = config.hooks ?? {};
  const telemetry = config.telemetry ?? noTelemetry;
  const http = config.http ?? {};
  const mcpPath = http.path ?? (config.publicUrl ? new URL(config.publicUrl).pathname : '/mcp');
  const resource = config.publicUrl ? new URL(config.publicUrl) : undefined;

  const build = (context: McpRequestContext, principal: Principal, token?: string): McpServer => {
    const server = new McpServer(
      {
        name: config.name,
        version: config.version,
        ...(config.title ? { title: config.title } : {}),
        ...(config.description ? { description: config.description } : {}),
        ...(config.websiteUrl ? { websiteUrl: config.websiteUrl } : {}),
        ...(config.icons ? { icons: config.icons } : {}),
      },
      { ...(config.instructions ? { instructions: config.instructions } : {}) },
    );
    let services: Promise<unknown> | undefined;
    const runtime = {
      era: context.era,
      principal,
      store,
      entitlements,
      llm,
      log,
      hooks,
      telemetry,
      http: context.requestInfo !== undefined,
      ...(token ? { token } : {}),
      services: () => (services ??= Promise.resolve(config.services?.(principal, { store, log }))),
    };
    for (const tool of config.tools) registerTool(server, tool, runtime);
    for (const resource of config.resources ?? []) registerResource(server, resource, runtime);
    for (const prompt of config.prompts ?? []) registerPrompt(server, prompt, runtime);
    config.setup?.(server, { principal, store, log });
    return server;
  };

  const handler: McpHttpHandler = createMcpHandler(
    (context) => build(context, (context.authInfo?.extra?.principal as Principal | undefined) ?? ANONYMOUS),
    {
      legacy: http.legacy ?? 'stateless',
      ...(http.responseMode ? { responseMode: http.responseMode } : {}),
      onerror: (error) => log.debug('mcp handler', { error }),
    },
  );

  const metadataUrl = resource ? getOAuthProtectedResourceMetadataUrl(resource) : undefined;
  const gate = config.auth
    ? requireBearerAuth({ verifier: toSdkVerifier(config.auth, resource), ...(metadataUrl ? { resourceMetadataUrl: metadataUrl } : {}) })
    : undefined;

  const corsHeaders = (request: Request): Record<string, string> => {
    const origin = request.headers.get('origin');
    const allowed = http.corsOrigins;
    if (!origin || !allowed) return {};
    if (allowed !== '*' && !allowed.includes(origin)) return {};
    return {
      'access-control-allow-origin': allowed === '*' ? '*' : origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers':
        'authorization, content-type, accept, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id, last-event-id',
      'access-control-expose-headers': 'www-authenticate, mcp-session-id',
      'access-control-max-age': '86400',
      vary: 'origin',
    };
  };

  const withHeaders = (response: Response, headers: Record<string, string>): Response => {
    if (!Object.keys(headers).length) return response;
    const out = new Response(response.body, response);
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
    return out;
  };

  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

  const toolScopes = [
    ...new Set([...config.tools, ...(config.resources ?? []), ...(config.prompts ?? [])].flatMap((t) => t.scopes ?? [])),
  ];
  const scopesSupported = config.scopesSupported ?? config.auth?.scopesSupported ?? (toolScopes.length ? toolScopes : undefined);
  const protectedResourceMetadata = () => ({
    resource: resource!.href,
    authorization_servers: config.auth!.authorizationServers,
    bearer_methods_supported: ['header'],
    resource_name: config.title ?? config.name,
    ...(scopesSupported ? { scopes_supported: scopesSupported } : {}),
  });

  if (!config.auth && !config.allowAnonymous) {
    log.warn('No auth configured: HTTP requests will be refused. Set `auth`, or `allowAnonymous: true` for local development.');
  }

  const fetchHandler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (http.allowedHosts) {
      const check = validateHostHeader(request.headers.get('host') ?? url.host, http.allowedHosts);
      if (!check.ok) return json({ error: 'invalid_host', error_description: check.message }, 403);
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/health' && request.method === 'GET' && http.health !== false) {
      return json({ status: 'ok', name: config.name, version: config.version }, 200, cors);
    }

    if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
      if (!resource || !config.auth?.authorizationServers.length) return json({ error: 'not_found' }, 404, cors);
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET', ...cors });
      return json(protectedResourceMetadata(), 200, { 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' });
    }

    if (url.pathname !== mcpPath) return json({ error: 'not_found' }, 404, cors);

    let authInfo: AuthInfo | undefined;
    if (gate) {
      const result = await gate(request);
      if (result instanceof Response) return withHeaders(result, cors);
      authInfo = result;
    } else if (!config.allowAnonymous) {
      return json({ error: 'server_misconfigured', error_description: 'This server has no authentication configured.' }, 503, cors);
    }

    const response = await handler.fetch(request, authInfo ? { authInfo } : undefined);
    return withHeaders(response, cors);
  };

  return {
    name: config.name,
    version: config.version,
    config,
    log,
    store,
    fetch: async (request) => {
      try {
        return await fetchHandler(request);
      } catch (error) {
        log.error('request failed', { error });
        return json({ error: 'internal_error' }, 500);
      }
    },
    build,
    toolsChanged: () => handler.notify.toolsChanged(),
    close: () => handler.close(),
  };
}
