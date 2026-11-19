import { describe, expect, it } from 'vitest';
import { allOf, quota, stripeMeter } from '../src/billing/index.js';
import { createLogger } from '../src/logger.js';
import { memoryStore } from '../src/store/index.js';
import type { Principal } from '../src/types.js';

const log = createLogger({ level: 'silent' });
const user = (over: Partial<Principal> = {}): Principal => ({ id: 'u1', kind: 'user', scopes: [], claims: {}, ...over });
const req = (principal: Principal, units = 1, feature = 'search') => ({ principal, tool: feature, feature, units, requestId: crypto.randomUUID() });

describe('quota', () => {
  it('uses per-feature limits and pools by org when asked', async () => {
    const runtime = { store: memoryStore(), log };
    const q = quota({ by: 'org', plans: { free: { units: 100, features: { search: 2 } } } });
    const a = user({ id: 'a', orgId: 'o1' });
    const b = user({ id: 'b', orgId: 'o1' });
    expect((await q.reserve(req(a), runtime)).allowed).toBe(true);
    expect((await q.reserve(req(b), runtime)).allowed).toBe(true);
    expect((await q.reserve(req(a), runtime)).allowed).toBe(false);
    expect((await q.reserve(req(a, 1, 'export'), runtime)).allowed).toBe(true);
  });

  it('reads the plan from a lookup', async () => {
    const runtime = { store: memoryStore(), log };
    const q = quota({ plans: { free: { units: 0 }, team: { units: 5 } }, planOf: async (p) => (p.id === 'paid' ? 'team' : undefined) });
    expect((await q.reserve(req(user()), runtime)).allowed).toBe(false);
    expect((await q.reserve(req(user({ id: 'paid' })), runtime)).allowed).toBe(true);
  });

  it('refuses a call bigger than the whole allowance', async () => {
    const q = quota({ plans: { free: { units: 3 } } });
    const decision = await q.reserve(req(user(), 10), { store: memoryStore(), log });
    expect(decision).toMatchObject({ allowed: false, reason: expect.stringContaining('needs 10 units') });
  });

  it('rejects an unknown default plan', () => {
    expect(() => quota({ plans: { pro: { units: 1 } } })).toThrow(/defaultPlan "free"/);
  });
});

describe('stripeMeter', () => {
  it('reports successful calls with an idempotent identifier', async () => {
    const bodies: URLSearchParams[] = [];
    const meter = stripeMeter({
      secretKey: 'sk_test',
      eventName: 'mcp_calls',
      customerId: (p) => p.claims.stripe as string | undefined,
      fetch: (async (url: string, init: RequestInit) => {
        expect(url).toBe('https://api.stripe.com/v1/billing/meter_events');
        bodies.push(init.body as URLSearchParams);
        return new Response('{}');
      }) as never,
    });
    const runtime = { store: memoryStore(), log };
    const r = req(user({ claims: { stripe: 'cus_1' } }), 3);
    await meter.settle({ ...r, ok: true }, runtime);
    await meter.settle({ ...r, ok: false }, runtime);
    expect(bodies).toHaveLength(1);
    expect(Object.fromEntries(bodies[0]!)).toMatchObject({ event_name: 'mcp_calls', 'payload[stripe_customer_id]': 'cus_1', 'payload[value]': '3', identifier: `${r.requestId}:search` });
  });
});

describe('allOf', () => {
  it('releases earlier reservations when a later adapter denies', async () => {
    const runtime = { store: memoryStore(), log };
    const first = quota({ plans: { free: { units: 1 } } });
    const deny = quota({ plans: { free: { units: 0 } }, store: memoryStore() });
    const both = allOf(first, deny);
    expect((await both.reserve(req(user()), runtime)).allowed).toBe(false);
    expect((await first.reserve(req(user()), runtime)).allowed).toBe(true);
  });
});
