import { AuthError, ConfigError } from '../errors.js';
import type { Principal, TokenVerifier, VerifiedToken } from '../types.js';

export interface ApiKeyRecord {
  /** Stable id for the key holder. Becomes `principal.id`. */
  id: string;
  /** SHA-256 hex digest of the key. Store this, never the key itself. */
  sha256: string;
  scopes?: string[];
  orgId?: string;
  plan?: string;
  name?: string;
  /** Seconds since epoch. */
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface ApiKeyOptions {
  /** A fixed list, or a function that finds a key by its SHA-256 digest (database, KV, secret manager). */
  keys: ApiKeyRecord[] | ((sha256: string) => Promise<ApiKeyRecord | null | undefined>);
  /** Only accept keys that start with this prefix, e.g. `mcp_live_`. */
  prefix?: string;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Static or database-backed API keys. Use for server-to-server callers and
 * agents that cannot run an OAuth flow. Keys are matched by digest, so the
 * raw key never needs to be stored.
 */
export function apiKeys(options: ApiKeyOptions): TokenVerifier {
  if (Array.isArray(options.keys)) {
    for (const record of options.keys) {
      if (!/^[0-9a-f]{64}$/.test(record.sha256)) throw new ConfigError(`apiKeys: key "${record.id}" needs a lowercase hex SHA-256 digest`);
    }
  }

  const find = async (digest: string): Promise<ApiKeyRecord | undefined> => {
    if (typeof options.keys === 'function') return (await options.keys(digest)) ?? undefined;
    let match: ApiKeyRecord | undefined;
    for (const record of options.keys) if (timingSafeEqualHex(record.sha256, digest)) match = record;
    return match;
  };

  return {
    name: 'api-key',
    authorizationServers: [],
    async verify(token): Promise<VerifiedToken> {
      if (options.prefix && !token.startsWith(options.prefix)) throw new AuthError('API key has the wrong prefix');
      const record = await find(await sha256Hex(token));
      if (!record) throw new AuthError('API key is not recognised');
      const now = Math.floor(Date.now() / 1000);
      if (record.expiresAt !== undefined && record.expiresAt <= now) throw new AuthError('API key expired');
      const principal: Principal = {
        id: record.id,
        kind: 'api_key',
        scopes: record.scopes ?? [],
        claims: record.metadata ?? {},
      };
      if (record.orgId) principal.orgId = record.orgId;
      if (record.plan) principal.plan = record.plan;
      if (record.name) principal.name = record.name;
      return { principal, expiresAt: record.expiresAt ?? now + 3600, audience: [] };
    },
  };
}
