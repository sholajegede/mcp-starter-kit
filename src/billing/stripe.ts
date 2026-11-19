import { ConfigError } from '../errors.js';
import type { Principal } from '../types.js';
import type { Entitlements } from './types.js';

export interface StripeMeterOptions {
  secretKey: string;
  /** The `event_name` of the Billing Meter to report to. A function lets each tool report to its own meter. */
  eventName: string | ((tool: string, feature: string) => string);
  /** Stripe customer id for a principal, from a claim or your database. Return undefined to skip reporting. */
  customerId: (principal: Principal) => string | undefined | Promise<string | undefined>;
  /** Payload key Stripe uses to find the customer. Defaults to `stripe_customer_id`. */
  customerKey?: string;
  apiBase?: string;
  fetch?: typeof fetch;
}

/**
 * Reports successful tool calls to a Stripe Billing Meter for usage-based
 * pricing. It never blocks a call; pair it with `quota` or `allOf` to gate.
 * Each event carries the request id as its identifier, so retries are not
 * double-counted.
 */
export function stripeMeter(options: StripeMeterOptions): Entitlements {
  if (!options.secretKey) throw new ConfigError('stripeMeter requires secretKey');
  const doFetch = options.fetch ?? fetch;
  const base = (options.apiBase ?? 'https://api.stripe.com').replace(/\/$/, '');

  return {
    name: 'stripe-meter',
    async reserve() {
      return { allowed: true };
    },
    async settle(request, runtime) {
      if (!request.ok || request.units <= 0) return;
      const customer = await options.customerId(request.principal);
      if (!customer) {
        runtime.log.warn('stripe meter skipped: no customer id for principal', { principal: request.principal.id, tool: request.tool });
        return;
      }
      const eventName = typeof options.eventName === 'function' ? options.eventName(request.tool, request.feature) : options.eventName;
      const body = new URLSearchParams({
        event_name: eventName,
        identifier: `${request.requestId}:${request.tool}`,
        timestamp: String(Math.floor(Date.now() / 1000)),
        [`payload[${options.customerKey ?? 'stripe_customer_id'}]`]: customer,
        'payload[value]': String(request.units),
      });
      try {
        const res = await doFetch(`${base}/v1/billing/meter_events`, {
          method: 'POST',
          headers: { authorization: `Bearer ${options.secretKey}`, 'content-type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (!res.ok) runtime.log.error('stripe meter event rejected', { status: res.status, body: await res.text(), tool: request.tool });
      } catch (error) {
        runtime.log.error('stripe meter event failed', { error, tool: request.tool });
      }
    },
  };
}
