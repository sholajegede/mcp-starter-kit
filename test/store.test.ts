import { PGlite } from '@electric-sql/pglite';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { memoryStore, redisStore, sqlStore, upstashStore, type Store } from '../src/store/index.js';

function contract(name: string, make: () => Promise<Store> | Store) {
  describe(`${name} store`, () => {
    it('sets, gets and deletes', async () => {
      const store = await make();
      expect(await store.get('k')).toBeNull();
      await store.set('k', 'v');
      expect(await store.get('k')).toBe('v');
      await store.set('k', 'v2');
      expect(await store.get('k')).toBe('v2');
      await store.delete('k');
      expect(await store.get('k')).toBeNull();
    });

    it('expires values', async () => {
      const store = await make();
      await store.set('t', 'v', { ttlMs: 30 });
      expect(await store.get('t')).toBe('v');
      await new Promise((r) => setTimeout(r, 60));
      expect(await store.get('t')).toBeNull();
    });

    it('increments atomically and keeps the first expiry', async () => {
      const store = await make();
      const results = await Promise.all(Array.from({ length: 20 }, () => store.increment('c', 1, { ttlMs: 5000 })));
      expect(results.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      expect(await store.increment('c', 5)).toBe(25);
      expect(await store.increment('c', -5)).toBe(20);
    });

    it('restarts an expired counter', async () => {
      const store = await make();
      await store.increment('e', 3, { ttlMs: 30 });
      await new Promise((r) => setTimeout(r, 60));
      expect(await store.increment('e', 1, { ttlMs: 1000 })).toBe(1);
    });
  });
}

contract('memory', () => memoryStore());

contract('sqlite', () => {
  const db = new DatabaseSync(':memory:');
  return sqlStore({ dialect: 'sqlite', query: async (sql, params) => db.prepare(sql).all(...(params as never[])) });
});

contract('postgres', async () => {
  const db = new PGlite();
  return sqlStore({ dialect: 'postgres', query: async (sql, params) => (await db.query(sql, params)).rows });
});

function fakeRedis(flavor: 'ioredis' | 'node-redis') {
  const data = new Map<string, { v: string; exp: number | null }>();
  const live = (k: string) => {
    const e = data.get(k);
    if (e && e.exp !== null && e.exp <= Date.now()) data.delete(k);
    return data.get(k);
  };
  const incr = async (k: string, by: number) => {
    const e = live(k);
    const v = Number(e?.v ?? 0) + by;
    data.set(k, { v: String(v), exp: e?.exp ?? null });
    return v;
  };
  const expire = async (k: string, ms: number) => {
    const e = live(k);
    if (e) e.exp = Date.now() + ms;
  };
  const base = {
    get: async (k: string) => live(k)?.v ?? null,
    del: async (k: string) => data.delete(k),
  };
  if (flavor === 'ioredis') {
    return { ...base, set: async (k: string, v: string, px?: string, ms?: number) => void data.set(k, { v, exp: px ? Date.now() + ms! : null }), incrby: incr, pexpire: expire };
  }
  return { ...base, set: async (k: string, v: string, o?: { PX?: number }) => void data.set(k, { v, exp: o?.PX ? Date.now() + o.PX : null }), incrBy: incr, pExpire: expire };
}

contract('redis (ioredis)', () => redisStore(fakeRedis('ioredis')));
contract('redis (node-redis)', () => redisStore(fakeRedis('node-redis')));

describe('upstash store', () => {
  it('sends pipelined REST commands', async () => {
    const sent: unknown[] = [];
    const store = upstashStore({
      url: 'https://x.upstash.io',
      token: 't',
      fetch: (async (url: string, init: RequestInit) => {
        expect(url).toBe('https://x.upstash.io/multi-exec');
        expect((init.headers as Record<string, string>).authorization).toBe('Bearer t');
        const commands = JSON.parse(String(init.body));
        sent.push(...commands);
        return Response.json(commands.map(() => ({ result: 7 })));
      }) as never,
    });
    expect(await store.increment('k', 2, { ttlMs: 1000 })).toBe(7);
    expect(sent[0]).toEqual(['EVAL', expect.stringContaining('INCRBY'), 1, 'mcp:k', 2, 1000]);
  });
});
