import type { AuthInfo, ToolAnnotations } from '@modelcontextprotocol/server';
import type { Logger } from './logger.js';
import type { Store } from './store/types.js';
import type { LlmClient } from './llm/types.js';

export type Awaitable<T> = T | Promise<T>;

export interface Principal {
  /** Stable subject identifier: the `sub` claim, an API key id, or `local` for stdio. */
  id: string;
  kind: 'user' | 'client' | 'api_key' | 'local' | 'anonymous';
  email?: string;
  name?: string;
  /** Tenant the request runs under, when the provider has one (org, workspace, team). */
  orgId?: string;
  scopes: string[];
  /** Billing plan, when the token or key carries one. */
  plan?: string;
  clientId?: string;
  /** Raw claims or key metadata. */
  claims: Record<string, unknown>;
}

export interface TokenVerifier {
  /** Human-readable provider name used in logs. */
  readonly name: string;
  /** Issuer URL(s) advertised as `authorization_servers` in protected resource metadata. */
  readonly authorizationServers: string[];
  /** Scopes advertised in protected resource metadata. */
  readonly scopesSupported?: string[];
  verify(token: string): Promise<VerifiedToken>;
}

export interface VerifiedToken {
  principal: Principal;
  /** Seconds since epoch. */
  expiresAt: number;
  /** Audiences the token was issued for. */
  audience: string[];
}

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length: milliseconds, or a string like `30s`, `1m`, `1h`, `1d`. */
  window: number | string;
  /** What the limit is counted against. Defaults to `principal`. */
  by?: 'principal' | 'org' | 'global';
}

export interface ToolContext<Services = unknown> {
  principal: Principal;
  /** Raw auth info from the transport, when the request came over HTTP. */
  authInfo?: AuthInfo;
  services: Services;
  store: Store;
  llm: LlmClient;
  log: Logger;
  signal: AbortSignal;
  requestId: string;
  toolName: string;
  /** Report progress for long-running work. A no-op when the client did not ask for progress. */
  progress(progress: number, total?: number, message?: string): Promise<void>;
}

export interface ConfirmSpec<Input> {
  /** The question shown to the user before the tool runs. */
  message: (input: Input) => string;
}

export interface ToolHooksEvent {
  tool: string;
  principal: Principal;
  requestId: string;
}

export interface ServerHooks {
  onToolStart?(event: ToolHooksEvent & { input: unknown }): Awaitable<void>;
  onToolEnd?(event: ToolHooksEvent & { durationMs: number; ok: boolean; units: number }): Awaitable<void>;
  onToolError?(event: ToolHooksEvent & { error: unknown }): Awaitable<void>;
}

export type { ToolAnnotations };
