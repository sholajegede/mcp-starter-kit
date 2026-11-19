import { AuthError } from '../errors.js';
import type { TokenVerifier, VerifiedToken } from '../types.js';

export { jwtVerifier, defaultPrincipal, scopesFromClaims, type JwtVerifierOptions } from './jwt.js';
export { apiKeys, sha256Hex, type ApiKeyOptions, type ApiKeyRecord } from './api-keys.js';
export { introspection, type IntrospectionOptions } from './introspection.js';
export { oidc, kinde, auth0, clerk, workos, okta, keycloak, entra, cognito, supabase, firebase, betterAuth } from './providers.js';
export type { TokenVerifier, VerifiedToken, Principal } from '../types.js';

/**
 * Accept a token if any verifier accepts it, tried in order. Use it to take
 * OAuth tokens from users and API keys from automations on the same server.
 */
export function anyOf(...verifiers: TokenVerifier[]): TokenVerifier {
  return {
    name: verifiers.map((v) => v.name).join('|'),
    authorizationServers: [...new Set(verifiers.flatMap((v) => v.authorizationServers))],
    scopesSupported: [...new Set(verifiers.flatMap((v) => v.scopesSupported ?? []))],
    async verify(token): Promise<VerifiedToken> {
      let last: unknown;
      for (const verifier of verifiers) {
        try {
          return await verifier.verify(token);
        } catch (error) {
          last = error;
        }
      }
      throw last instanceof AuthError ? last : new AuthError('Token rejected by every verifier', { cause: last });
    },
  };
}
