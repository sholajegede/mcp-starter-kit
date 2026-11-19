import { AuthError, ConfigError } from '../errors.js';
import { sha256Hex } from './api-keys.js';
import { defaultPrincipal } from './jwt.js';
import type { Principal, TokenVerifier, VerifiedToken } from '../types.js';

export interface IntrospectionOptions {
  /** RFC 7662 introspection endpoint. */
  endpoint: string;
  /** Issuer advertised to clients as the authorization server. */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Only accept tokens whose `aud` includes one of these. */
  audience?: string | string[];
  /** Cache active results for this long, capped at the token's own expiry. Defaults to 60 seconds. */
  cacheTtlSec?: number;
  mapClaims?: (claims: Record<string, unknown>) => Partial<Principal>;
  name?: string;
  fetch?: typeof fetch;
}

/** Opaque access tokens, checked against the provider's introspection endpoint (RFC 7662). */
export function introspection(options: IntrospectionOptions): TokenVerifier {
  if (!options.endpoint || !options.clientId || !options.clientSecret) {
    throw new ConfigError('introspection requires endpoint, clientId and clientSecret');
  }
  const doFetch = options.fetch ?? fetch;
  const ttl = (options.cacheTtlSec ?? 60) * 1000;
  const cache = new Map<string, { value: VerifiedToken; until: number }>();
  const audiences = options.audience === undefined ? [] : Array.isArray(options.audience) ? options.audience : [options.audience];
  const basic = btoa(`${encodeURIComponent(options.clientId)}:${encodeURIComponent(options.clientSecret)}`);

  return {
    name: options.name ?? 'introspection',
    authorizationServers: [options.issuer],
    async verify(token): Promise<VerifiedToken> {
      const cacheKey = await sha256Hex(token);
      const hit = cache.get(cacheKey);
      if (hit && hit.until > Date.now()) return hit.value;

      const res = await doFetch(options.endpoint, {
        method: 'POST',
        headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
      });
      if (!res.ok) throw new AuthError(`Introspection failed with ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      if (body.active !== true) throw new AuthError('Token is not active');
      if (typeof body.sub !== 'string' || typeof body.exp !== 'number') throw new AuthError('Introspection response is missing sub or exp');
      if (typeof body.iss === 'string' && body.iss.replace(/\/$/, '') !== options.issuer.replace(/\/$/, '')) {
        throw new AuthError('Token issuer does not match');
      }
      const aud = body.aud === undefined ? [] : Array.isArray(body.aud) ? (body.aud as string[]) : [String(body.aud)];
      if (audiences.length && !aud.some((a) => audiences.includes(a))) throw new AuthError('Token audience does not match');

      const value: VerifiedToken = {
        principal: { ...defaultPrincipal(body as never), ...options.mapClaims?.(body) },
        expiresAt: body.exp,
        audience: aud,
      };
      cache.set(cacheKey, { value, until: Math.min(Date.now() + ttl, body.exp * 1000) });
      if (cache.size > 10_000) cache.delete(cache.keys().next().value!);
      return value;
    },
  };
}
