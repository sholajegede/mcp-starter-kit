import {
  createLocalJWKSet,
  createRemoteJWKSet,
  customFetch,
  errors as joseErrors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { AuthError, ConfigError } from '../errors.js';
import type { Principal, TokenVerifier, VerifiedToken } from '../types.js';

export interface JwtVerifierOptions {
  /** Expected `iss` claim. Also advertised to clients as the authorization server. */
  issuer: string;
  /**
   * Expected `aud`. For MCP this should be your server's public URL, so a token
   * minted for another API cannot be replayed here. Leave unset only when the
   * provider cannot put a resource in `aud`, and then use `validate` instead.
   */
  audience?: string | string[];
  /** JWKS endpoint. Discovered from the issuer's OpenID configuration when omitted. */
  jwksUri?: string;
  /** A fixed key set, for tests or air-gapped setups. */
  jwks?: JSONWebKeySet;
  /** Shared secret for HS256 tokens (legacy Supabase projects, custom issuers). */
  secret?: string;
  algorithms?: string[];
  /** Accepted clock skew. Defaults to 30 seconds. */
  clockToleranceSec?: number;
  /** Override the default claim mapping. Fields you return replace the defaults. */
  mapClaims?: (claims: JWTPayload) => Partial<Principal>;
  /** Extra checks. Throw to reject the token. */
  validate?: (claims: JWTPayload) => void | Promise<void>;
  /** Provider label for logs. */
  name?: string;
  scopesSupported?: string[];
  /** Override the authorization server advertised to clients, when it differs from the issuer. */
  authorizationServer?: string;
  fetch?: typeof fetch;
}

const discoveryCache = new Map<string, Promise<string>>();

async function discoverJwksUri(issuer: string, doFetch: typeof fetch): Promise<string> {
  const base = issuer.replace(/\/$/, '');
  const candidates = [`${base}/.well-known/openid-configuration`, `${base}/.well-known/oauth-authorization-server`];
  for (const url of candidates) {
    try {
      const res = await doFetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) continue;
      const doc = (await res.json()) as { jwks_uri?: string; issuer?: string };
      if (doc.jwks_uri) return doc.jwks_uri;
    } catch {
      continue;
    }
  }
  throw new ConfigError(`Could not discover a jwks_uri for issuer ${issuer}. Pass jwksUri explicitly.`);
}

/** Verifies JWT access tokens from any OpenID Connect or OAuth 2.1 provider. */
export function jwtVerifier(options: JwtVerifierOptions): TokenVerifier {
  if (!options.issuer) throw new ConfigError('jwtVerifier requires an issuer');
  if (options.secret && (options.jwks || options.jwksUri)) throw new ConfigError('Pass either secret or a key set, not both');
  const doFetch = options.fetch ?? fetch;

  let keyPromise: Promise<JWTVerifyGetKey | Uint8Array> | undefined;
  const key = () => {
    keyPromise ??= (async () => {
      if (options.secret) return new TextEncoder().encode(options.secret);
      if (options.jwks) return createLocalJWKSet(options.jwks);
      const uri =
        options.jwksUri ??
        (await (discoveryCache.get(options.issuer) ??
          discoveryCache.set(options.issuer, discoverJwksUri(options.issuer, doFetch)).get(options.issuer)!));
      return createRemoteJWKSet(new URL(uri), options.fetch ? { [customFetch]: options.fetch as never } : {});
    })().catch((error) => {
      keyPromise = undefined;
      discoveryCache.delete(options.issuer);
      throw error;
    });
    return keyPromise;
  };

  const algorithms = options.algorithms ?? (options.secret ? ['HS256'] : undefined);

  return {
    name: options.name ?? 'jwt',
    authorizationServers: [options.authorizationServer ?? options.issuer],
    ...(options.scopesSupported ? { scopesSupported: options.scopesSupported } : {}),
    async verify(token: string): Promise<VerifiedToken> {
      const k = await key();
      let payload: JWTPayload;
      try {
        const verifyOptions = {
          issuer: options.issuer,
          ...(options.audience ? { audience: options.audience } : {}),
          ...(algorithms ? { algorithms } : {}),
          clockTolerance: options.clockToleranceSec ?? 30,
          requiredClaims: ['exp', 'sub'],
        };
        ({ payload } =
          k instanceof Uint8Array ? await jwtVerify(token, k, verifyOptions) : await jwtVerify(token, k, verifyOptions));
      } catch (error) {
        throw new AuthError(describeJoseError(error), { cause: error });
      }
      if (options.validate) {
        try {
          await options.validate(payload);
        } catch (error) {
          throw new AuthError(error instanceof Error ? error.message : 'Token rejected', { cause: error });
        }
      }
      const principal = { ...defaultPrincipal(payload), ...options.mapClaims?.(payload) };
      return {
        principal,
        expiresAt: payload.exp!,
        audience: payload.aud === undefined ? [] : Array.isArray(payload.aud) ? payload.aud : [payload.aud],
      };
    },
  };
}

function describeJoseError(error: unknown): string {
  if (error instanceof joseErrors.JWTExpired) return 'Token expired';
  if (error instanceof joseErrors.JWTClaimValidationFailed) return `Token claim "${error.claim}" is invalid`;
  if (error instanceof joseErrors.JWSSignatureVerificationFailed) return 'Token signature is invalid';
  if (error instanceof joseErrors.JWKSNoMatchingKey) return 'Token was signed with an unknown key';
  if (error instanceof joseErrors.JOSEAlgNotAllowed) return 'Token algorithm is not allowed';
  return 'Token is invalid';
}

export function scopesFromClaims(claims: JWTPayload): string[] {
  const out = new Set<string>();
  for (const name of ['scope', 'scp', 'permissions', 'scopes']) {
    const value = claims[name];
    if (typeof value === 'string') value.split(/\s+/).filter(Boolean).forEach((s) => out.add(s));
    else if (Array.isArray(value)) value.filter((s): s is string => typeof s === 'string').forEach((s) => out.add(s));
  }
  return [...out];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function defaultPrincipal(claims: JWTPayload): Principal {
  const c = claims as Record<string, unknown>;
  const org = c.o as { id?: unknown } | undefined;
  const fullName = [str(c.given_name), str(c.family_name)].filter(Boolean).join(' ');
  const clientId = str(c.azp) ?? str(c.client_id) ?? str(c.cid);
  const isClient = clientId !== undefined && clientId === claims.sub;
  const principal: Principal = {
    id: claims.sub!,
    kind: isClient ? 'client' : 'user',
    scopes: scopesFromClaims(claims),
    claims: c,
  };
  const email = str(c.email);
  const name = str(c.name) ?? (fullName || undefined);
  const orgId = str(c.org_id) ?? str(c.org_code) ?? str(org?.id) ?? str(c.organization_id);
  const plan = str(c.plan);
  if (email) principal.email = email;
  if (name) principal.name = name;
  if (orgId) principal.orgId = orgId;
  if (plan) principal.plan = plan;
  if (clientId) principal.clientId = clientId;
  return principal;
}
