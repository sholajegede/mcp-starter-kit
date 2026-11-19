import { toMs } from './duration.js';
import type { Store } from './store/types.js';
import type { Principal, RateLimitRule } from './types.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Fixed-window counter in the shared store, so limits hold across instances. */
export async function checkRateLimit(store: Store, scope: string, rule: RateLimitRule, principal: Principal): Promise<RateLimitResult> {
  const windowMs = toMs(rule.window);
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const holder =
    rule.by === 'global' ? 'global' : rule.by === 'org' && principal.orgId ? `org:${principal.orgId}` : `p:${principal.id}`;
  const count = await store.increment(`rl:${scope}:${holder}:${bucket}`, 1, { ttlMs: windowMs + 1000 });
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSec: Math.ceil(((bucket + 1) * windowMs - now) / 1000),
  };
}
