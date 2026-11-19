import {
  ProtocolError,
  ProtocolErrorCode,
  requireScopes,
  ResourceTemplate,
  type GetPromptResult,
  type Icon,
  type McpServer,
  type ReadResourceResult,
  type ServerContext,
  type StandardSchemaWithJSON,
  type Variables,
} from '@modelcontextprotocol/server';
import { createContext, missingScopes, oauthPrincipal, type Runtime } from './context.js';
import { ToolError } from './errors.js';
import type { Awaitable, ToolContext } from './types.js';

type Infer<S> = S extends StandardSchemaWithJSON ? StandardSchemaWithJSON.InferOutput<S> : Record<string, never>;

export type ResourceContent =
  | string
  | { text: string; mimeType?: string }
  | { blob: Uint8Array | string; mimeType: string }
  | ReadResourceResult;

interface ResourceBase {
  /** Unique name, used in listings. */
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  icons?: Icon[];
  scopes?: string[];
}

export interface ResourceDefinition<Services = unknown> extends ResourceBase {
  /** Fixed URI, e.g. `docs://handbook` or `config://limits`. */
  uri: string;
  read: (ctx: ToolContext<Services>) => Awaitable<ResourceContent>;
}

export interface ResourceTemplateDefinition<Services = unknown> extends ResourceBase {
  /** RFC 6570 template, e.g. `notes://{id}`. */
  uriTemplate: string;
  /** List concrete resources for discovery. Omit when the set is unbounded. */
  list?: (ctx: ToolContext<Services>) => Awaitable<Array<{ uri: string; name: string; title?: string; description?: string; mimeType?: string }>>;
  read: (variables: Record<string, string>, ctx: ToolContext<Services>) => Awaitable<ResourceContent>;
}

export interface PromptDefinition<A extends StandardSchemaWithJSON | undefined = undefined, Services = unknown> {
  name: string;
  title?: string;
  description?: string;
  args?: A;
  icons?: Icon[];
  scopes?: string[];
  /** Return a string for a single user message, or a full prompt result. */
  render: (args: Infer<A>, ctx: ToolContext<Services>) => Awaitable<string | GetPromptResult>;
}

export type AnyResource = ResourceDefinition<any> | ResourceTemplateDefinition<any>;
export type AnyPrompt = PromptDefinition<any, any>;

export function defineResource<Services = unknown>(definition: ResourceDefinition<Services>): ResourceDefinition<Services> {
  return definition;
}

export function defineResourceTemplate<Services = unknown>(definition: ResourceTemplateDefinition<Services>): ResourceTemplateDefinition<Services> {
  return definition;
}

export function definePrompt<A extends StandardSchemaWithJSON | undefined = undefined, Services = unknown>(
  definition: PromptDefinition<A, Services>,
): PromptDefinition<A, Services> {
  return definition;
}

function toContents(uri: string, value: ResourceContent, mimeType?: string): ReadResourceResult {
  if (typeof value === 'string') return { contents: [{ uri, text: value, ...(mimeType ? { mimeType } : {}) }] };
  if ('contents' in value) return value;
  if ('text' in value) return { contents: [{ uri, text: value.text, ...((value.mimeType ?? mimeType) ? { mimeType: value.mimeType ?? mimeType } : {}) }] };
  const blob = typeof value.blob === 'string' ? value.blob : btoa(String.fromCharCode(...value.blob));
  return { contents: [{ uri, blob, mimeType: value.mimeType }] };
}

async function guarded<T>(
  rt: Runtime,
  ctx: ServerContext,
  kind: 'resource' | 'prompt',
  name: string,
  scopes: string[] | undefined,
  fn: (handlerCtx: ToolContext<unknown>) => Promise<T>,
): Promise<T> {
  const requestId = crypto.randomUUID();
  const meta = ctx.mcpReq._meta as Record<string, unknown> | undefined;
  return rt.telemetry.run({ kind, name, principal: rt.principal, requestId, ...(meta ? { meta } : {}) }, async (span) => {
    const missing = missingScopes(rt.principal, scopes);
    if (missing.length) {
      span.fail(undefined, 'insufficient_scope');
      throw new ProtocolError(ProtocolErrorCode.InvalidRequest, `Missing permission: ${missing.join(', ')}.`);
    }
    const handlerCtx = createContext(rt, ctx, name, requestId, ctx.mcpReq.signal);
    try {
      handlerCtx.services = await rt.services();
      return await fn(handlerCtx);
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      span.fail(error);
      if (error instanceof ToolError) throw new ProtocolError(ProtocolErrorCode.InvalidParams, error.message);
      handlerCtx.log.error(`${kind} failed`, { error });
      throw new ProtocolError(ProtocolErrorCode.InternalError, `${name} failed unexpectedly. Reference: ${requestId}`);
    }
  });
}

const challenge = (rt: Runtime, scopes?: string[]) =>
  rt.http && scopes?.length && oauthPrincipal(rt.principal) ? { scopeChallenge: requireScopes(...(scopes as [string, ...string[]])) } : {};

export function registerResource(server: McpServer, def: AnyResource, rt: Runtime): void {
  const meta = {
    ...(def.title ? { title: def.title } : {}),
    ...(def.description ? { description: def.description } : {}),
    ...(def.mimeType ? { mimeType: def.mimeType } : {}),
    ...(def.icons ? { icons: def.icons } : {}),
    ...challenge(rt, def.scopes),
  };

  if ('uri' in def) {
    server.registerResource(def.name, def.uri, meta, (uri: URL, ctx: ServerContext) =>
      guarded(rt, ctx, 'resource', def.uri, def.scopes, async (c) => toContents(uri.href, await def.read(c), def.mimeType)),
    );
    return;
  }

  const template = new ResourceTemplate(def.uriTemplate, {
    list: def.list
      ? (ctx: ServerContext) => guarded(rt, ctx, 'resource', def.uriTemplate, def.scopes, async (c) => ({ resources: await def.list!(c) }))
      : undefined,
  });
  server.registerResource(def.name, template, meta, (uri: URL, variables: Variables, ctx: ServerContext) =>
    guarded(rt, ctx, 'resource', def.uriTemplate, def.scopes, async (c) => {
      const flat = Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]));
      return toContents(uri.href, await def.read(flat, c), def.mimeType);
    }),
  );
}

export function registerPrompt(server: McpServer, def: AnyPrompt, rt: Runtime): void {
  const config = {
    ...(def.title ? { title: def.title } : {}),
    ...(def.description ? { description: def.description } : {}),
    ...(def.args ? { argsSchema: def.args } : {}),
    ...(def.icons ? { icons: def.icons } : {}),
    ...challenge(rt, def.scopes),
  };
  const render = (args: unknown, ctx: ServerContext): Promise<GetPromptResult> =>
    guarded(rt, ctx, 'prompt', def.name, def.scopes, async (c) => {
      const out = await def.render((args ?? {}) as never, c);
      return typeof out === 'string' ? { messages: [{ role: 'user', content: { type: 'text', text: out } }] } : out;
    });
  if (def.args) server.registerPrompt(def.name, config as never, ((args: unknown, ctx: ServerContext) => render(args, ctx)) as never);
  else server.registerPrompt(def.name, config as never, ((ctx: ServerContext) => render(undefined, ctx)) as never);
}
