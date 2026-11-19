import type { Store } from './types.js';

interface Entry {
  value: string;
  expiresAt: number | null;
}

/**
 * In-process store. Right for stdio servers, tests and single-instance
 * deployments. State is lost on restart and is not shared between instances.
 */
export function memoryStore(options: { maxEntries?: number } = {}): Store {
  const maxEntries = options.maxEntries ?? 50_000;
  const map = new Map<string, Entry>();

  const live = (key: string): Entry | undefined => {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      map.delete(key);
      return undefined;
    }
    return entry;
  };

  const put = (key: string, entry: Entry) => {
    map.delete(key);
    map.set(key, entry);
    if (map.size > maxEntries) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) map.delete(oldest);
    }
  };

  return {
    name: 'memory',
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, opts) {
      put(key, { value, expiresAt: opts?.ttlMs ? Date.now() + opts.ttlMs : null });
    },
    async delete(key) {
      map.delete(key);
    },
    async increment(key, by = 1, opts) {
      const entry = live(key);
      if (!entry) {
        put(key, { value: String(by), expiresAt: opts?.ttlMs ? Date.now() + opts.ttlMs : null });
        return by;
      }
      const next = Number(entry.value) + by;
      entry.value = String(next);
      return next;
    },
  };
}
