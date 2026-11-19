import { ConfigError } from '../errors.js';
import { sha256Hex } from '../auth/api-keys.js';
import type { Principal } from '../types.js';
import type { Entitlements, UsageRequest } from './types.js';

interface KindeEntitlement {
  feature_key: string;
  feature_name?: string;
  entitlement_limit_max?: number | null;
}

export interface KindeBillingOptions {
  /** Your Kinde domain, e.g. `acme.kinde.com` or a custom domain. */
  domain: string;
  /** Kinde feature key for a tool. Defaults to the tool's `feature`, which defaults to its name. */
  featureKey?: (tool: string, feature: string) => string;
  /** Shown to the model when a plan does not include a feature or its limit is reached. */
  upgradeUrl?: string | ((principal: Principal) => string | undefined);
  /**
   * Window for enforcing `entitlement_limit_max` locally, counted in the
   * server's store. Defaults to `month`. Set `false` to only check that the
   * plan includes the feature.
   */
  enforceLimits?: 'day' | 'month' | false;
  /** How long a user's entitlements are cached. Defaults to 60 seconds. */
  cacheTtlSec?: number;
  /**
   * Report usage to Kinde metered billing through the Management API, with an
   * M2M application that has `create:meter_usage`, `read:users` and
   * `read:billing_agreements`.
   */
  meter?: {
    clientId: string;
    clientSecret: string;
    /** Find the agreement to bill. Defaults to the user's agreement for the feature. */
    agreementId?: (principal: Principal, featureKey: string) => Promise<string | undefined>;
  };
  fetch?: typeof fetch;
}

const https = (host: string) => (/^https?:\/\//.test(host) ? host.replace(/\/$/, '') : `https://${host.replace(/\/$/, '')}`);

function findAgreementId(value: unknown): string | undefined {
  if (typeof value === 'string') return value.startsWith('agreement_') ? value : undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAgreementId(item);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.agreement_id === 'string') return record.agreement_id;
    if (typeof record.id === 'string' && record.id.startsWith('agreement_')) return record.id;
    for (const nested of Object.values(record)) {
      const found = findAgreementId(nested);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Kinde Billing. Checks the caller's plan through the Kinde Account API with
 * their own access token, so no extra credentials are needed to gate tools.
 * Add `meter` to also report usage for metered features.
 */
export function kindeBilling(options: KindeBillingOptions): Entitlements {
  const base = https(options.domain);
  const doFetch = options.fetch ?? fetch;
  const ttl = (options.cacheTtlSec ?? 60) * 1000;
  const cache = new Map<string, { until: number; value: Promise<KindeEntitlement[]> }>();
  const period = options.enforceLimits === undefined ? 'month' : options.enforceLimits;

  const upgradeUrl = (p: Principal) => (typeof options.upgradeUrl === 'function' ? options.upgradeUrl(p) : options.upgradeUrl);
  const keyFor = (r: UsageRequest) => options.featureKey?.(r.tool, r.feature) ?? r.feature;

  const load = async (token: string): Promise<KindeEntitlement[]> => {
    const all: KindeEntitlement[] = [];
    let after: string | undefined;
    for (let page = 0; page < 20; page++) {
      const url = new URL(`${base}/account_api/v1/entitlements`);
      url.searchParams.set('page_size', '100');
      if (after) url.searchParams.set('starting_after', after);
      const res = await doFetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
      if (!res.ok) throw new Error(`Kinde Account API returned ${res.status}`);
      const body = (await res.json()) as {
        data?: { entitlements?: KindeEntitlement[] };
        metadata?: { has_more?: boolean; next_page_starting_after?: string };
      };
      all.push(...(body.data?.entitlements ?? []));
      if (!body.metadata?.has_more || !body.metadata.next_page_starting_after) break;
      after = body.metadata.next_page_starting_after;
    }
    return all;
  };

  const entitlements = async (token: string) => {
    const key = await sha256Hex(token);
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    const value = load(token);
    cache.set(key, { until: Date.now() + ttl, value });
    value.catch(() => cache.delete(key));
    if (cache.size > 5000) cache.delete(cache.keys().next().value!);
    return value;
  };

  const windowKey = (r: UsageRequest, featureKey: string) => {
    const now = new Date().toISOString();
    return `kinde:${r.principal.id}:${featureKey}:${period === 'day' ? now.slice(0, 10) : now.slice(0, 7)}`;
  };

  let m2m: { token: string; until: number } | undefined;
  const managementToken = async () => {
    if (m2m && m2m.until > Date.now()) return m2m.token;
    const res = await doFetch(`${base}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: options.meter!.clientId,
        client_secret: options.meter!.clientSecret,
        audience: `${base}/api`,
      }),
    });
    if (!res.ok) throw new Error(`Kinde M2M token request returned ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_in?: number };
    m2m = { token: body.access_token, until: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 60) * 1000 };
    return m2m.token;
  };

  const management = async (path: string, init: RequestInit = {}) => {
    const res = await doFetch(`${base}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await managementToken()}`, accept: 'application/json', 'content-type': 'application/json', ...init.headers },
    });
    if (!res.ok) throw new Error(`Kinde Management API ${path.split('?')[0]} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<unknown>;
  };

  const agreements = new Map<string, string>();
  const defaultAgreement = async (principal: Principal, featureKey: string) => {
    const cacheKey = `${principal.id}:${featureKey}`;
    const cached = agreements.get(cacheKey);
    if (cached) return cached;
    const user = (await management(`/api/v1/user?id=${encodeURIComponent(principal.id)}&expand=billing`)) as {
      billing?: { customer_id?: string };
    };
    const customerId = user.billing?.customer_id;
    if (!customerId) return undefined;
    const list = await management(
      `/api/v1/billing/agreements?customer_id=${encodeURIComponent(customerId)}&feature_code=${encodeURIComponent(featureKey)}`,
    );
    const id = findAgreementId(list);
    if (id) agreements.set(cacheKey, id);
    return id;
  };

  if (options.meter && (!options.meter.clientId || !options.meter.clientSecret)) {
    throw new ConfigError('kindeBilling: meter needs clientId and clientSecret');
  }

  return {
    name: 'kinde-billing',
    async reserve(request, runtime) {
      if (!request.token) {
        return { allowed: false, reason: 'Billing check needs a Kinde access token, and this request has none.' };
      }
      const featureKey = keyFor(request);
      let list: KindeEntitlement[];
      try {
        list = await entitlements(request.token);
      } catch (error) {
        runtime.log.error('kinde entitlements lookup failed', { error });
        return { allowed: false, reason: 'Could not check your plan right now. Try again shortly.', retryAfterSec: 30 };
      }
      const entitlement = list.find((e) => e.feature_key === featureKey);
      const url = upgradeUrl(request.principal);
      if (!entitlement) {
        return { allowed: false, reason: `Your plan does not include ${featureKey}.`, ...(url ? { upgradeUrl: url } : {}) };
      }
      const max = entitlement.entitlement_limit_max;
      if (period === false || max === null || max === undefined) return { allowed: true };
      const key = windowKey(request, featureKey);
      const used = await runtime.store.increment(key, request.units, { ttlMs: (period === 'day' ? 2 : 32) * 86_400_000 });
      if (used > max) {
        await runtime.store.increment(key, -request.units);
        return {
          allowed: false,
          reason: `You have used all ${max} ${entitlement.feature_name ?? featureKey} included in your plan this ${period}.`,
          ...(url ? { upgradeUrl: url } : {}),
        };
      }
      return { allowed: true, remaining: max - used };
    },
    async settle(request, runtime) {
      const featureKey = keyFor(request);
      if (!request.ok) {
        if (period !== false && request.token) {
          const list = await entitlements(request.token).catch(() => []);
          const max = list.find((e) => e.feature_key === featureKey)?.entitlement_limit_max;
          if (max !== null && max !== undefined) await runtime.store.increment(windowKey(request, featureKey), -request.units);
        }
        return;
      }
      if (!options.meter || request.units <= 0) return;
      try {
        const agreementId = await (options.meter.agreementId ?? defaultAgreement)(request.principal, featureKey);
        if (!agreementId) {
          runtime.log.warn('kinde meter skipped: no billing agreement found', { principal: request.principal.id, feature: featureKey });
          return;
        }
        await management('/api/v1/billing/meter_usage', {
          method: 'POST',
          body: JSON.stringify({
            customer_agreement_id: agreementId,
            billing_feature_code: featureKey,
            meter_value: String(request.units),
            meter_type_code: 'delta',
          }),
        });
      } catch (error) {
        runtime.log.error('kinde meter usage failed', { error, feature: featureKey });
      }
    },
  };
}
