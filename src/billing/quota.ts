import { ConfigError } from '../errors.js';
import { toMs } from '../duration.js';
import type { Principal } from '../types.js';
import type { Store } from '../store/types.js';
import type { Entitlements, UsageRequest } from './types.js';

export type QuotaPeriod = 'day' | 'month' | 'lifetime' | number | string;

export interface PlanLimits {
  /** Units allowed per period. `Infinity` means unmetered. */
  units: number;
  per?: QuotaPeriod;
  /** Per-feature limits that override `units` for those features. */
  features?: Record<string, number>;
}

export interface QuotaOptions {
  plans: Record<string, PlanLimits>;
  /** Plan for a principal. Defaults to `principal.plan`, then `defaultPlan`. */
  planOf?: (principal: Principal) => string | undefined | Promise<string | undefined>;
  defaultPlan?: string;
  /** Count usage per user, or pool it across the whole org. Defaults to `principal`. */
  by?: 'principal' | 'org';
  upgradeUrl?: string | ((principal: Principal) => string | undefined);
  /** Defaults to the server's store. */
  store?: Store;
}

function periodWindow(per: QuotaPeriod, now = new Date()): { id: string; ttlMs?: number; resetsAt?: Date } {
  if (per === 'lifetime') return { id: 'all' };
  if (per === 'day') {
    const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return { id: now.toISOString().slice(0, 10), ttlMs: resetsAt.getTime() - now.getTime() + 3_600_000, resetsAt };
  }
  if (per === 'month') {
    const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { id: now.toISOString().slice(0, 7), ttlMs: resetsAt.getTime() - now.getTime() + 3_600_000, resetsAt };
  }
  const ms = toMs(per);
  const bucket = Math.floor(now.getTime() / ms);
  const resetsAt = new Date((bucket + 1) * ms);
  return { id: `w${ms}:${bucket}`, ttlMs: resetsAt.getTime() - now.getTime() + 1000, resetsAt };
}

/**
 * Plan-based usage quotas kept in your own store. Works with any auth
 * provider: the plan comes from the token (`plan` claim), your database, or
 * a lookup you supply.
 */
export function quota(options: QuotaOptions): Entitlements {
  const defaultPlan = options.defaultPlan ?? 'free';
  if (!options.plans[defaultPlan]) throw new ConfigError(`quota: defaultPlan "${defaultPlan}" is not in plans`);

  const resolve = async (request: UsageRequest) => {
    const planName = (await options.planOf?.(request.principal)) ?? request.principal.plan ?? defaultPlan;
    const plan = options.plans[planName] ?? options.plans[defaultPlan]!;
    const limit = plan.features?.[request.feature] ?? plan.units;
    const holder = options.by === 'org' && request.principal.orgId ? `org:${request.principal.orgId}` : `p:${request.principal.id}`;
    const window = periodWindow(plan.per ?? 'month');
    const scope = plan.features?.[request.feature] !== undefined ? request.feature : '*';
    return { planName, limit, window, key: `quota:${holder}:${scope}:${window.id}` };
  };

  const upgradeUrl = (p: Principal) => (typeof options.upgradeUrl === 'function' ? options.upgradeUrl(p) : options.upgradeUrl);

  return {
    name: 'quota',
    async reserve(request, runtime) {
      const store = options.store ?? runtime.store;
      const { planName, limit, window, key } = await resolve(request);
      if (limit === Infinity) return { allowed: true };
      if (request.units > limit) return { allowed: false, reason: `This action needs ${request.units} units but the ${planName} plan allows ${limit}.` };
      const used = await store.increment(key, request.units, window.ttlMs ? { ttlMs: window.ttlMs } : undefined);
      if (used > limit) {
        await store.increment(key, -request.units);
        const url = upgradeUrl(request.principal);
        const resets = window.resetsAt ? ` It resets ${window.resetsAt.toISOString()}.` : '';
        return {
          allowed: false,
          reason: `Usage limit reached on the ${planName} plan (${limit} per period).${resets}`,
          ...(url ? { upgradeUrl: url } : {}),
          ...(window.resetsAt ? { retryAfterSec: Math.ceil((window.resetsAt.getTime() - Date.now()) / 1000) } : {}),
        };
      }
      return { allowed: true, remaining: limit - used };
    },
    async settle(request, runtime) {
      if (request.ok) return;
      const store = options.store ?? runtime.store;
      const { limit, key } = await resolve(request);
      if (limit !== Infinity) await store.increment(key, -request.units);
    },
  };
}
