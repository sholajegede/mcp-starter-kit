/**
 * Small key-value contract the kit needs for rate limits, quotas and
 * idempotency. Every adapter must make `increment` atomic.
 */
export interface Store {
  readonly name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ttlMs?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  /**
   * Atomically add `by` to the counter at `key` and return the new value.
   * When the key does not exist (or has expired) the counter starts from zero
   * and `ttlMs`, if given, sets its expiry. Later increments keep that expiry.
   */
  increment(key: string, by?: number, options?: { ttlMs?: number }): Promise<number>;
}
