import { ConfigError } from '../errors.js';
import type { Store } from './types.js';

/**
 * The handful of commands the store uses. Both ioredis and node-redis (v4+)
 * clients satisfy it as they are, so pass your client straight in.
 */
export type RedisLike =
  | {
      get(key: string): Promise<string | null>;
      set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
      del(key: string): Promise<unknown>;
      incrby(key: string, by: number): Promise<number>;
      pexpire(key: string, ms: number): Promise<unknown>;
    }
  | {
      get(key: string): Promise<string | null>;
      set(key: string, value: string, options?: unknown): Promise<unknown>;
      del(key: string): Promise<unknown>;
      incrBy(key: string, by: number): Promise<number>;
      pExpire(key: string, ms: number): Promise<unknown>;
    };

export function redisStore(client: RedisLike, options: { prefix?: string } = {}): Store {
  const prefix = options.prefix ?? 'mcp:';
  const c = client as Record<string, (...args: unknown[]) => Promise<unknown>>;
  const isIoredis = typeof c.incrby === 'function';
  if (!isIoredis && typeof c.incrBy !== 'function') throw new ConfigError('redisStore needs an ioredis or node-redis client');

  return {
    name: 'redis',
    async get(key) {
      return (await c.get!(prefix + key)) as string | null;
    },
    async set(key, value, opts) {
      if (!opts?.ttlMs) await c.set!(prefix + key, value);
      else if (isIoredis) await c.set!(prefix + key, value, 'PX', opts.ttlMs);
      else await c.set!(prefix + key, value, { PX: opts.ttlMs });
    },
    async delete(key) {
      await c.del!(prefix + key);
    },
    async increment(key, by = 1, opts) {
      const k = prefix + key;
      const value = Number(await (isIoredis ? c.incrby!(k, by) : c.incrBy!(k, by)));
      if (opts?.ttlMs && value === by) await (isIoredis ? c.pexpire!(k, opts.ttlMs) : c.pExpire!(k, opts.ttlMs));
      return value;
    },
  };
}

/**
 * Upstash Redis over its REST API. Uses `fetch` only, so it runs on
 * Cloudflare Workers, Vercel Edge, Deno and Bun as well as Node.
 */
export function upstashStore(options: { url: string; token: string; prefix?: string; fetch?: typeof fetch }): Store {
  const prefix = options.prefix ?? 'mcp:';
  const doFetch = options.fetch ?? fetch;
  const base = options.url.replace(/\/$/, '');

  const pipeline = async (commands: unknown[][]): Promise<unknown[]> => {
    const res = await doFetch(`${base}/multi-exec`, {
      method: 'POST',
      headers: { authorization: `Bearer ${options.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Upstash request failed with ${res.status}`);
    const body = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    return body.map((entry) => {
      if (entry.error) throw new Error(`Upstash error: ${entry.error}`);
      return entry.result;
    });
  };

  const script =
    "local v = redis.call('INCRBY', KEYS[1], ARGV[1]) if v == tonumber(ARGV[1]) and tonumber(ARGV[2]) > 0 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end return v";

  return {
    name: 'upstash',
    async get(key) {
      const [value] = await pipeline([['GET', prefix + key]]);
      return (value as string | null) ?? null;
    },
    async set(key, value, opts) {
      await pipeline([opts?.ttlMs ? ['SET', prefix + key, value, 'PX', opts.ttlMs] : ['SET', prefix + key, value]]);
    },
    async delete(key) {
      await pipeline([['DEL', prefix + key]]);
    },
    async increment(key, by = 1, opts) {
      const [value] = await pipeline([['EVAL', script, 1, prefix + key, by, opts?.ttlMs ?? 0]]);
      return Number(value);
    },
  };
}
