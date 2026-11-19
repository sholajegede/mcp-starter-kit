import type { JWTPayload } from 'jose';
import { ConfigError } from '../errors.js';
import { jwtVerifier, type JwtVerifierOptions } from './jwt.js';
import type { TokenVerifier } from '../types.js';

type Common = Pick<JwtVerifierOptions, 'mapClaims' | 'validate' | 'scopesSupported' | 'clockToleranceSec' | 'fetch' | 'jwks'>;

const https = (host: string) => (/^https?:\/\//.test(host) ? host.replace(/\/$/, '') : `https://${host.replace(/\/$/, '')}`);

function required(value: string | undefined, name: string, provider: string): string {
  if (!value) throw new ConfigError(`${provider}: ${name} is required`);
  return value;
}

/** Any OpenID Connect provider: Zitadel, Logto, Descope, Stytch, Scalekit, FusionAuth, Authentik, Ory and the rest. */
export function oidc(options: JwtVerifierOptions): TokenVerifier {
  return jwtVerifier({ name: 'oidc', ...options });
}

/** Kinde. `domain` is your business domain, e.g. `acme.kinde.com` or a custom domain. */
export function kinde(options: Common & { domain: string; audience?: string | string[] }): TokenVerifier {
  const issuer = https(required(options.domain, 'domain', 'kinde'));
  return jwtVerifier({ name: 'kinde', issuer, jwksUri: `${issuer}/.well-known/jwks.json`, ...options });
}

/** Auth0. `audience` is the API identifier you created for the MCP server. */
export function auth0(options: Common & { domain: string; audience: string | string[] }): TokenVerifier {
  const issuer = `${https(required(options.domain, 'domain', 'auth0'))}/`;
  return jwtVerifier({ name: 'auth0', issuer, jwksUri: `${issuer}.well-known/jwks.json`, ...options });
}

/** Clerk. `issuer` is your Frontend API URL, e.g. `https://clerk.acme.com`. Enable JWT access tokens for OAuth apps. */
export function clerk(options: Common & { issuer: string; audience?: string | string[]; authorizedParties?: string[] }): TokenVerifier {
  const issuer = https(required(options.issuer, 'issuer', 'clerk'));
  const parties = options.authorizedParties;
  const userValidate = options.validate;
  return jwtVerifier({
    name: 'clerk',
    jwksUri: `${issuer}/.well-known/jwks.json`,
    ...options,
    issuer,
    validate: async (claims: JWTPayload) => {
      if (parties?.length && !parties.includes(String(claims.azp ?? ''))) throw new Error('Token azp is not an authorized party');
      await userValidate?.(claims);
    },
  });
}

/** WorkOS AuthKit. `domain` is your AuthKit domain, e.g. `acme.authkit.app`. */
export function workos(options: Common & { domain: string; audience?: string | string[] }): TokenVerifier {
  const issuer = https(required(options.domain, 'domain', 'workos'));
  return jwtVerifier({ name: 'workos', issuer, jwksUri: `${issuer}/oauth2/jwks`, ...options });
}

/** Okta. Uses the `default` custom authorization server unless you name another. */
export function okta(options: Common & { domain: string; authorizationServerId?: string; audience: string | string[] }): TokenVerifier {
  const issuer = `${https(required(options.domain, 'domain', 'okta'))}/oauth2/${options.authorizationServerId ?? 'default'}`;
  return jwtVerifier({ name: 'okta', issuer, jwksUri: `${issuer}/v1/keys`, ...options });
}

/** Keycloak. */
export function keycloak(options: Common & { url: string; realm: string; audience?: string | string[] }): TokenVerifier {
  const issuer = `${https(required(options.url, 'url', 'keycloak'))}/realms/${required(options.realm, 'realm', 'keycloak')}`;
  return jwtVerifier({ name: 'keycloak', issuer, jwksUri: `${issuer}/protocol/openid-connect/certs`, ...options });
}

/** Microsoft Entra ID (v2 tokens). `audience` is the application ID URI or client ID of the API registration. */
export function entra(options: Common & { tenantId: string; audience: string | string[] }): TokenVerifier {
  const tenant = required(options.tenantId, 'tenantId', 'entra');
  const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  const userMap = options.mapClaims;
  return jwtVerifier({
    name: 'entra',
    jwksUri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
    ...options,
    issuer,
    mapClaims: (claims) => {
      const c = claims as Record<string, unknown>;
      const roles = Array.isArray(c.roles) ? (c.roles as string[]) : [];
      const scopes = typeof c.scp === 'string' ? c.scp.split(' ') : [];
      return {
        id: typeof c.oid === 'string' ? c.oid : claims.sub!,
        scopes: [...scopes, ...roles],
        ...(typeof c.tid === 'string' ? { orgId: c.tid } : {}),
        ...(typeof c.preferred_username === 'string' ? { email: c.preferred_username } : {}),
        ...userMap?.(claims),
      };
    },
  });
}

/** Amazon Cognito access tokens. Cognito puts the app client in `client_id`, not `aud`. */
export function cognito(options: Common & { region: string; userPoolId: string; clientIds?: string[] }): TokenVerifier {
  const issuer = `https://cognito-idp.${required(options.region, 'region', 'cognito')}.amazonaws.com/${required(options.userPoolId, 'userPoolId', 'cognito')}`;
  const userValidate = options.validate;
  return jwtVerifier({
    name: 'cognito',
    jwksUri: `${issuer}/.well-known/jwks.json`,
    ...options,
    issuer,
    validate: async (claims) => {
      if (claims.token_use !== 'access') throw new Error('Expected a Cognito access token');
      if (options.clientIds?.length && !options.clientIds.includes(String(claims.client_id ?? ''))) {
        throw new Error('Token client_id is not allowed');
      }
      await userValidate?.(claims);
    },
  });
}

/**
 * Supabase Auth. Projects on asymmetric signing keys verify through JWKS.
 * Older projects that still sign with the shared JWT secret pass `jwtSecret`.
 */
export function supabase(options: Common & { url: string; audience?: string | string[]; jwtSecret?: string }): TokenVerifier {
  const base = https(required(options.url, 'url', 'supabase'));
  const issuer = `${base}/auth/v1`;
  const { jwtSecret, ...rest } = options;
  return jwtVerifier({
    name: 'supabase',
    audience: 'authenticated',
    ...(jwtSecret ? { secret: jwtSecret } : { jwksUri: `${issuer}/.well-known/jwks.json` }),
    ...rest,
    issuer,
  });
}

/** Firebase Authentication ID tokens. */
export function firebase(options: Common & { projectId: string }): TokenVerifier {
  const projectId = required(options.projectId, 'projectId', 'firebase');
  return jwtVerifier({
    name: 'firebase',
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    jwksUri: 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    algorithms: ['RS256'],
    ...options,
  });
}

/** Better Auth with the JWT or OAuth provider plugin. `baseURL` includes the auth path, e.g. `https://app.com/api/auth`. */
export function betterAuth(options: Common & { baseURL: string; issuer?: string; audience?: string | string[] }): TokenVerifier {
  const base = https(required(options.baseURL, 'baseURL', 'betterAuth'));
  return jwtVerifier({ name: 'better-auth', issuer: options.issuer ?? base, jwksUri: `${base}/jwks`, ...options });
}
