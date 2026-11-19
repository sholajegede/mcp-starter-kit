import type { ServerContext } from '@modelcontextprotocol/server';
import type { Entitlements } from './billing/types.js';
import type { LlmClient } from './llm/types.js';
import type { Logger } from './logger.js';
import type { Store } from './store/types.js';
import type { Telemetry } from './telemetry.js';
import type { Principal, ServerHooks, ToolContext } from './types.js';

export interface Runtime {
  era: 'legacy' | 'modern';
  principal: Principal;
  store: Store;
  entitlements: Entitlements;
  llm: LlmClient;
  log: Logger;
  hooks: ServerHooks;
  telemetry: Telemetry;
  services: () => Promise<unknown>;
  http: boolean;
  token?: string;
}

export function missingScopes(principal: Principal, scopes: string[] | undefined): string[] {
  if (!scopes?.length || principal.scopes.includes('*')) return [];
  return scopes.filter((s) => !principal.scopes.includes(s));
}

export function oauthPrincipal(principal: Principal): boolean {
  return principal.kind === 'user' || principal.kind === 'client';
}

/** Builds the context handed to tool, resource and prompt handlers. Services are resolved by the caller. */
export function createContext(rt: Runtime, ctx: ServerContext, name: string, requestId: string, signal: AbortSignal): ToolContext<unknown> {
  const progressToken = ctx.mcpReq._meta?.progressToken;
  return {
    principal: rt.principal,
    ...(ctx.http?.authInfo ? { authInfo: ctx.http.authInfo } : {}),
    services: undefined,
    store: rt.store,
    llm: rt.llm,
    log: rt.log.child({ op: name, requestId, principal: rt.principal.id }),
    signal,
    requestId,
    toolName: name,
    progress: async (progress, total, message) => {
      if (progressToken === undefined) return;
      await ctx.mcpReq.notify({
        method: 'notifications/progress',
        params: { progressToken, progress, ...(total !== undefined ? { total } : {}), ...(message ? { message } : {}) },
      });
    },
  };
}
