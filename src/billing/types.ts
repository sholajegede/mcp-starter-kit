import type { Logger } from '../logger.js';
import type { Store } from '../store/types.js';
import type { Principal } from '../types.js';

export interface UsageRequest {
  principal: Principal;
  tool: string;
  /** Units this call costs, from the tool's `cost`. */
  units: number;
  /** Billing feature the tool belongs to. Defaults to the tool name. */
  feature: string;
  requestId: string;
}

export type EntitlementDecision =
  | { allowed: true; remaining?: number }
  | { allowed: false; reason: string; upgradeUrl?: string; retryAfterSec?: number };

export interface EntitlementRuntime {
  store: Store;
  log: Logger;
}

/**
 * Decides whether a principal may run a tool, and records what they used.
 * `reserve` runs before the handler; `settle` runs after it with `ok: false`
 * when the handler failed, so adapters can refund what they reserved.
 */
export interface Entitlements {
  readonly name: string;
  reserve(request: UsageRequest, runtime: EntitlementRuntime): Promise<EntitlementDecision>;
  settle(request: UsageRequest & { ok: boolean }, runtime: EntitlementRuntime): Promise<void>;
}
