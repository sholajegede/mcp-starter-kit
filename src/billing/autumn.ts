import { ConfigError } from '../errors.js';
import type { Principal } from '../types.js';
import type { Entitlements, UsageRequest } from './types.js';

export interface AutumnOptions {
  secretKey: string;
  /** Autumn customer id for a principal. Defaults to the org when there is one, then the user. */
  customerId?: (principal: Principal) => string | undefined;
  /** Autumn feature id for a tool. Defaults to the tool's `feature`, which defaults to its name. */
  featureId?: (tool: string, feature: string) => string;
  upgradeUrl?: string | ((principal: Principal) => string | undefined);
  apiBase?: string;
  fetch?: typeof fetch;
}

/**
 * Autumn. `check` runs before the handler with the call's units as the
 * required balance, and `track` records the units once the call succeeds.
 */
export function autumn(options: AutumnOptions): Entitlements {
  if (!options.secretKey) throw new ConfigError('autumn requires secretKey');
  const doFetch = options.fetch ?? fetch;
  const base = (options.apiBase ?? 'https://api.useautumn.com/v1').replace(/\/$/, '');
  const customer = (p: Principal) => options.customerId?.(p) ?? p.orgId ?? p.id;
  const feature = (r: UsageRequest) => options.featureId?.(r.tool, r.feature) ?? r.feature;
  const upgradeUrl = (p: Principal) => (typeof options.upgradeUrl === 'function' ? options.upgradeUrl(p) : options.upgradeUrl);

  const call = async (path: string, body: Record<string, unknown>) => {
    const res = await doFetch(`${base}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${options.secretKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Autumn ${path} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as Record<string, unknown>;
  };

  return {
    name: 'autumn',
    async reserve(request, runtime) {
      const customerId = customer(request.principal);
      const featureId = feature(request);
      try {
        const result = await call('/check', { customer_id: customerId, feature_id: featureId, required_balance: request.units });
        if (result.allowed === true) return { allowed: true };
        const url = upgradeUrl(request.principal);
        return { allowed: false, reason: `Your plan has no ${featureId} balance left for this action.`, ...(url ? { upgradeUrl: url } : {}) };
      } catch (error) {
        runtime.log.error('autumn check failed', { error, feature: featureId });
        return { allowed: false, reason: 'Could not check your plan right now. Try again shortly.', retryAfterSec: 30 };
      }
    },
    async settle(request, runtime) {
      if (!request.ok || request.units <= 0) return;
      try {
        await call('/track', { customer_id: customer(request.principal), feature_id: feature(request), value: request.units });
      } catch (error) {
        runtime.log.error('autumn track failed', { error, tool: request.tool });
      }
    },
  };
}
