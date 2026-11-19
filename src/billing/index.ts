import type { Entitlements } from './types.js';

export type { Entitlements, EntitlementDecision, EntitlementRuntime, UsageRequest } from './types.js';
export { quota, type QuotaOptions, type PlanLimits, type QuotaPeriod } from './quota.js';
export { stripeMeter, type StripeMeterOptions } from './stripe.js';
export { kindeBilling, type KindeBillingOptions } from './kinde.js';
export { autumn, type AutumnOptions } from './autumn.js';
export { polar, type PolarOptions } from './polar.js';

/** Every adapter must allow the call. Reservations made before a denial are released. */
export function allOf(...adapters: Entitlements[]): Entitlements {
  return {
    name: adapters.map((a) => a.name).join('+'),
    async reserve(request, runtime) {
      const reserved: Entitlements[] = [];
      for (const adapter of adapters) {
        const decision = await adapter.reserve(request, runtime);
        if (!decision.allowed) {
          await Promise.all(reserved.map((a) => a.settle({ ...request, ok: false }, runtime)));
          return decision;
        }
        reserved.push(adapter);
      }
      return { allowed: true };
    },
    async settle(request, runtime) {
      await Promise.all(adapters.map((a) => a.settle(request, runtime)));
    },
  };
}

/** Allows everything and records nothing. The default. */
export function unmetered(): Entitlements {
  return {
    name: 'unmetered',
    async reserve() {
      return { allowed: true };
    },
    async settle() {},
  };
}
