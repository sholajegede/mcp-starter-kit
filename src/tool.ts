import {
  acceptedContent,
  inputRequired,
  isCallToolResult,
  isInputRequiredResult,
  requireScopes,
  type CallToolResult,
  type Icon,
  type InputRequiredResult,
  type McpServer,
  type ServerContext,
  type StandardSchemaWithJSON,
  type ToolAnnotations,
} from '@modelcontextprotocol/server';
import { ToolError } from './errors.js';
import { checkRateLimit } from './rate-limit.js';
import { createContext, missingScopes, oauthPrincipal, type Runtime } from './context.js';
import type { Awaitable, RateLimitRule, ToolContext } from './types.js';

type Infer<S> = S extends StandardSchemaWithJSON ? StandardSchemaWithJSON.InferOutput<S> : Record<string, never>;

export type ToolReturn<O> = O extends StandardSchemaWithJSON
  ? StandardSchemaWithJSON.InferOutput<O> | CallToolResult | InputRequiredResult
  : string | Record<string, unknown> | unknown[] | CallToolResult | InputRequiredResult | void;

export interface ToolDefinition<
  I extends StandardSchemaWithJSON | undefined = StandardSchemaWithJSON | undefined,
  O extends StandardSchemaWithJSON | undefined = StandardSchemaWithJSON | undefined,
  Services = unknown,
> {
  /** Snake case, unique per server. */
  name: string;
  title?: string;
  /** What the tool does and when to use it. Models read this to decide whether to call the tool. */
  description: string;
  input?: I;
  /** When set, results are validated and returned as `structuredContent`. */
  output?: O;
  annotations?: ToolAnnotations;
  icons?: Icon[];
  /** OAuth scopes the caller must hold. HTTP clients missing one get a step-up challenge. */
  scopes?: string[];
  rateLimit?: RateLimitRule;
  /** Units charged against the caller's entitlements. Defaults to 1. Use 0 for free tools. */
  cost?: number | ((input: Infer<I>) => number);
  /** Billing feature this tool counts toward. Defaults to the tool name. */
  feature?: string;
  /** Ask the user to confirm before running. Use for destructive or costly actions. */
  confirm?: string | ((input: Infer<I>) => string);
  /** Abort the handler after this long. Defaults to 60 seconds. */
  timeoutMs?: number;
  _meta?: Record<string, unknown>;
  handler: (input: Infer<I>, ctx: ToolContext<Services>) => Awaitable<ToolReturn<O>>;
}

export type AnyTool = ToolDefinition<any, any, any>;

/** Define a tool. Use `createTool<Services>()` instead when the handler needs typed services. */
export function defineTool<
  I extends StandardSchemaWithJSON | undefined = undefined,
  O extends StandardSchemaWithJSON | undefined = undefined,
>(definition: ToolDefinition<I, O, unknown>): ToolDefinition<I, O, unknown> {
  return definition;
}

/** Returns a `defineTool` whose handlers receive `ctx.services` typed as `Services`. */
export function createTool<Services>() {
  return <I extends StandardSchemaWithJSON | undefined = undefined, O extends StandardSchemaWithJSON | undefined = undefined>(
    definition: ToolDefinition<I, O, Services>,
  ): ToolDefinition<I, O, Services> => definition;
}

export type ToolRuntime = Runtime;

const confirmSchema = {
  type: 'object' as const,
  properties: { confirm: { type: 'boolean' as const, title: 'Confirm', description: 'Allow this action to run' } },
  required: ['confirm'],
};

function errorResult(message: string, extra: Record<string, unknown> = {}): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true, ...(Object.keys(extra).length ? { _meta: { 'mcp-starter-kit/error': extra } } : {}) };
}

export const hasScopes = missingScopes;

function toResult(value: unknown, hasOutput: boolean): CallToolResult | InputRequiredResult {
  if (value !== null && typeof value === 'object' && isInputRequiredResult(value)) return value;
  if (value !== null && typeof value === 'object' && 'content' in value && isCallToolResult(value)) return value as CallToolResult;
  if (hasOutput) return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown> };
  if (value === undefined || value === null) return { content: [{ type: 'text', text: 'Done.' }] };
  if (typeof value === 'string') return { content: [{ type: 'text', text: value }] };
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

async function confirmed(def: AnyTool, input: unknown, ctx: ServerContext, rt: ToolRuntime): Promise<true | CallToolResult | InputRequiredResult> {
  const message = typeof def.confirm === 'function' ? def.confirm(input) : def.confirm!;
  if (rt.era === 'modern') {
    const answer = acceptedContent<{ confirm?: unknown }>(ctx.mcpReq.inputResponses, 'confirm');
    if (answer?.confirm === true) return true;
    if (answer) return { content: [{ type: 'text', text: 'Cancelled: the user did not confirm.' }] };
    return inputRequired({ inputRequests: { confirm: inputRequired.elicit({ message, requestedSchema: confirmSchema }) } });
  }
  try {
    const result = await ctx.mcpReq.elicitInput({ mode: 'form', message, requestedSchema: confirmSchema });
    if (result.action === 'accept' && result.content?.confirm === true) return true;
    return { content: [{ type: 'text', text: 'Cancelled: the user did not confirm.' }] };
  } catch {
    return errorResult(
      'This action needs the user to confirm it, and this client cannot show a confirmation prompt. Use a client that supports elicitation.',
      { code: 'confirmation_unavailable' },
    );
  }
}

export function registerTool(server: McpServer, def: AnyTool, rt: Runtime): void {
  const hasOutput = def.output !== undefined;
  const scopes = def.scopes?.length ? (def.scopes as [string, ...string[]]) : undefined;

  const run = async (rawInput: unknown, ctx: ServerContext): Promise<CallToolResult | InputRequiredResult> => {
    const input = rawInput ?? {};
    const requestId = crypto.randomUUID();
    const principal = rt.principal;
    const log = rt.log.child({ tool: def.name, requestId, principal: principal.id });
    const event = { tool: def.name, principal, requestId };
    const meta = ctx.mcpReq._meta as Record<string, unknown> | undefined;

    return rt.telemetry.run({ kind: 'tool', name: def.name, principal, requestId, ...(meta ? { meta } : {}) }, async (span) => {
      const finish = (result: CallToolResult | InputRequiredResult, outcome: string) => {
        span.setAttributes({ 'mcp_starter_kit.outcome': outcome });
        if ((result as CallToolResult).isError) span.fail(undefined, outcome);
        return result;
      };

      const missing = missingScopes(principal, def.scopes);
      if (missing.length) return finish(errorResult(`Missing permission: ${missing.join(', ')}.`, { code: 'insufficient_scope', scopes: missing }), 'insufficient_scope');

      if (def.confirm) {
        const gate = await confirmed(def, input, ctx, rt);
        if (gate !== true) return finish(gate, isInputRequiredResult(gate) ? 'input_required' : 'not_confirmed');
      }

      if (def.rateLimit) {
        const limit = await checkRateLimit(rt.store, def.name, def.rateLimit, principal);
        if (!limit.allowed) {
          return finish(
            errorResult(`Rate limit reached for ${def.name}. Try again in ${limit.retryAfterSec}s.`, { code: 'rate_limited', retryAfterSec: limit.retryAfterSec }),
            'rate_limited',
          );
        }
      }

      const units = typeof def.cost === 'function' ? def.cost(input) : (def.cost ?? 1);
      span.setAttributes({ 'mcp_starter_kit.units': units });
      const token = ctx.http?.authInfo?.token ?? rt.token;
      const usage = { principal, tool: def.name, units, feature: def.feature ?? def.name, requestId, ...(token ? { token } : {}) };
      const billing = { store: rt.store, log };
      if (units > 0) {
        const decision = await rt.entitlements.reserve(usage, billing);
        if (!decision.allowed) {
          const upgrade = decision.upgradeUrl ? ` Upgrade: ${decision.upgradeUrl}` : '';
          return finish(
            errorResult(`${decision.reason}${upgrade}`, {
              code: 'entitlement_denied',
              ...(decision.upgradeUrl ? { upgradeUrl: decision.upgradeUrl } : {}),
              ...(decision.retryAfterSec ? { retryAfterSec: decision.retryAfterSec } : {}),
            }),
            'entitlement_denied',
          );
        }
      }

      const started = Date.now();
      await rt.hooks.onToolStart?.({ ...event, input });
      const timeout = AbortSignal.timeout(def.timeoutMs ?? 60_000);
      const signal = AbortSignal.any([ctx.mcpReq.signal, timeout]);
      const toolCtx = createContext(rt, ctx, def.name, requestId, signal);

      let ok = false;
      try {
        toolCtx.services = await rt.services();
        let onAbort: (() => void) | undefined;
        const aborted = new Promise<never>((_, reject) => {
          onAbort = () => reject(signal.reason);
          if (signal.aborted) onAbort();
          else signal.addEventListener('abort', onAbort, { once: true });
        });
        aborted.catch(() => {});
        const value = await Promise.race([Promise.resolve(def.handler(input, toolCtx)), aborted]).finally(() => {
          if (onAbort) signal.removeEventListener('abort', onAbort);
        });
        const result = toResult(value, hasOutput);
        ok = !isInputRequiredResult(result) && !(result as CallToolResult).isError;
        return finish(result, ok ? 'ok' : isInputRequiredResult(result) ? 'input_required' : 'tool_error');
      } catch (error) {
        await rt.hooks.onToolError?.({ ...event, error });
        if (error instanceof ToolError) {
          log.info('tool returned an error', { code: error.code, message: error.message });
          return finish(errorResult(error.message, { code: error.code, ...error.details }), 'tool_error');
        }
        if (timeout.aborted) {
          log.warn('tool timed out', { timeoutMs: def.timeoutMs ?? 60_000 });
          return finish(errorResult(`${def.name} timed out.`, { code: 'timeout' }), 'timeout');
        }
        if (ctx.mcpReq.signal.aborted) return finish(errorResult('Cancelled.', { code: 'cancelled' }), 'cancelled');
        log.error('tool failed', { error });
        span.fail(error);
        return errorResult(`${def.name} failed unexpectedly. Reference: ${requestId}`, { code: 'internal_error', requestId });
      } finally {
        if (units > 0) await rt.entitlements.settle({ ...usage, ok }, billing).catch((error) => log.error('settling usage failed', { error }));
        await rt.hooks.onToolEnd?.({ ...event, durationMs: Date.now() - started, ok, units });
      }
    });
  };

  const config = {
    ...(def.title ? { title: def.title } : {}),
    description: def.description,
    ...(def.input ? { inputSchema: def.input } : {}),
    ...(def.output ? { outputSchema: def.output } : {}),
    ...(def.annotations ? { annotations: def.annotations } : {}),
    ...(def.icons ? { icons: def.icons } : {}),
    ...(def._meta ? { _meta: def._meta } : {}),
    ...(rt.http && scopes && oauthPrincipal(rt.principal) ? { scopeChallenge: requireScopes(...scopes) } : {}),
  };

  if (def.input) server.registerTool(def.name, config as never, ((args: unknown, ctx: ServerContext) => run(args, ctx)) as never);
  else server.registerTool(def.name, config as never, ((ctx: ServerContext) => run(undefined, ctx)) as never);
}
