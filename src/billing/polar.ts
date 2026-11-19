import { ConfigError } from '../errors.js';
import type { Principal } from '../types.js';
import type { Entitlements } from './types.js';

export interface PolarOptions {
  accessToken: string;
  /** Event name your Polar meter filters on. A function lets each tool send its own event. */
  eventName: string | ((tool: string, feature: string) => string);
  /** Your id for the customer, stored in Polar as the external customer id. Defaults to the org, then the user. */
  externalCustomerId?: (principal: Principal) => string | undefined;
  /**
   * Block calls when the customer's balance on this meter is below the call's
   * units. Polar never blocks usage itself, so leave it unset to bill overage
   * instead of gating.
   */
  gateOnMeterId?: string;
  upgradeUrl?: string | ((principal: Principal) => string | undefined);
  /** `sandbox` uses Polar's sandbox API. */
  server?: 'production' | 'sandbox';
  fetch?: typeof fetch;
}

/** Polar usage-based billing. Successful calls are ingested as events with their units in metadata. */
export function polar(options: PolarOptions): Entitlements {
  if (!options.accessToken) throw new ConfigError('polar requires accessToken');
  const doFetch = options.fetch ?? fetch;
  const base = options.server === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
  const externalId = (p: Principal) => options.externalCustomerId?.(p) ?? p.orgId ?? p.id;
  const upgradeUrl = (p: Principal) => (typeof options.upgradeUrl === 'function' ? options.upgradeUrl(p) : options.upgradeUrl);
  const headers = { authorization: `Bearer ${options.accessToken}`, 'content-type': 'application/json', accept: 'application/json' };

  return {
    name: 'polar',
    async reserve(request, runtime) {
      if (!options.gateOnMeterId) return { allowed: true };
      const url = upgradeUrl(request.principal);
      try {
        const res = await doFetch(`${base}/v1/customers/external/${encodeURIComponent(externalId(request.principal))}/state`, { headers });
        if (res.status === 404) return { allowed: false, reason: 'No subscription found for this account.', ...(url ? { upgradeUrl: url } : {}) };
        if (!res.ok) throw new Error(`Polar customer state returned ${res.status}`);
        const state = (await res.json()) as { active_meters?: Array<{ meter_id?: string; balance?: number }> };
        const meter = state.active_meters?.find((m) => m.meter_id === options.gateOnMeterId);
        if (meter && (meter.balance ?? 0) >= request.units) return { allowed: true, remaining: (meter.balance ?? 0) - request.units };
        return { allowed: false, reason: 'No usage balance left on your plan.', ...(url ? { upgradeUrl: url } : {}) };
      } catch (error) {
        runtime.log.error('polar customer state failed', { error });
        return { allowed: false, reason: 'Could not check your plan right now. Try again shortly.', retryAfterSec: 30 };
      }
    },
    async settle(request, runtime) {
      if (!request.ok || request.units <= 0) return;
      const name = typeof options.eventName === 'function' ? options.eventName(request.tool, request.feature) : options.eventName;
      try {
        const res = await doFetch(`${base}/v1/events/ingest`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            events: [
              {
                name,
                external_customer_id: externalId(request.principal),
                metadata: { units: request.units, tool: request.tool, feature: request.feature, request_id: request.requestId },
              },
            ],
          }),
        });
        if (!res.ok) runtime.log.error('polar event rejected', { status: res.status, body: (await res.text()).slice(0, 300) });
      } catch (error) {
        runtime.log.error('polar ingest failed', { error, tool: request.tool });
      }
    },
  };
}
