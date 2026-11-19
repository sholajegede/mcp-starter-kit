import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { anyOf, apiKeys, auth0, entra, introspection, jwtVerifier, kinde, sha256Hex, supabase } from '../src/auth/index.js';
import { AuthError } from '../src/errors.js';
import { createIssuer, ISSUER, RESOURCE } from './helpers.js';

describe('jwtVerifier', async () => {
  const { jwks, sign } = await createIssuer();
  const verifier = jwtVerifier({ issuer: ISSUER, audience: RESOURCE, jwks });

  it('accepts a valid token and maps claims', async () => {
    const token = await sign({ sub: 'user_1', email: 'a@b.co', given_name: 'Ada', family_name: 'L', org_code: 'org_9', scope: 'notes:read notes:write', plan: 'pro' });
    const { principal, expiresAt, audience } = await verifier.verify(token);
    expect(principal).toMatchObject({ id: 'user_1', kind: 'user', email: 'a@b.co', name: 'Ada L', orgId: 'org_9', plan: 'pro' });
    expect(principal.scopes).toEqual(['notes:read', 'notes:write']);
    expect(audience).toEqual([RESOURCE]);
    expect(expiresAt).toBeGreaterThan(Date.now() / 1000);
  });

  it('merges scope, scp and permissions claims', async () => {
    const token = await sign({ scp: ['a'], permissions: ['b', 'a'], scope: 'c' });
    expect((await verifier.verify(token)).principal.scopes.sort()).toEqual(['a', 'b', 'c']);
  });

  it('rejects a token for another audience', async () => {
    const token = await sign({}, { audience: 'https://other.api' });
    await expect(verifier.verify(token)).rejects.toThrow(/aud/);
  });

  it('rejects a token from another issuer', async () => {
    const token = await sign({}, { issuer: 'https://evil.test' });
    await expect(verifier.verify(token)).rejects.toThrow(/iss/);
  });

  it('rejects an expired token', async () => {
    const token = await sign({}, { expiresIn: Math.floor(Date.now() / 1000) - 120 });
    await expect(verifier.verify(token)).rejects.toThrow('Token expired');
  });

  it('rejects a forged signature', async () => {
    const other = await createIssuer();
    const token = await other.sign();
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an unsigned token', async () => {
    const [h, p] = (await sign()).split('.');
    const none = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${p}.`;
    await expect(verifier.verify(none)).rejects.toBeInstanceOf(AuthError);
    expect(h).toBeTruthy();
  });

  it('runs custom validation', async () => {
    const strict = jwtVerifier({ issuer: ISSUER, audience: RESOURCE, jwks, validate: (c) => { if (c.org_code !== 'org_1') throw new Error('wrong org'); } });
    await expect(strict.verify(await sign({ org_code: 'org_2' }))).rejects.toThrow('wrong org');
    await expect(strict.verify(await sign({ org_code: 'org_1' }))).resolves.toBeTruthy();
  });

  it('discovers the JWKS from OpenID configuration', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer: 'https://disc.test', jwks_uri: 'https://disc.test/keys' });
      if (url === 'https://disc.test/keys') return Response.json(jwks);
      return new Response('nope', { status: 404 });
    }) as typeof fetch;
    const discovered = jwtVerifier({ issuer: 'https://disc.test', audience: RESOURCE, fetch: fakeFetch });
    const token = await sign({}, { issuer: 'https://disc.test' });
    await expect(discovered.verify(token)).resolves.toBeTruthy();
    expect(calls).toContain('https://disc.test/.well-known/openid-configuration');
  });

  it('verifies HS256 tokens with a shared secret', async () => {
    const secret = 'a-very-long-shared-secret-for-tests-only';
    const hs = jwtVerifier({ issuer: ISSUER, secret, audience: 'authenticated' });
    const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience('authenticated').setSubject('u').setExpirationTime('5m').sign(new TextEncoder().encode(secret));
    expect((await hs.verify(token)).principal.id).toBe('u');
  });
});

describe('provider presets', () => {
  it('builds issuers from domains', () => {
    expect(kinde({ domain: 'acme.kinde.com' }).authorizationServers).toEqual(['https://acme.kinde.com']);
    expect(auth0({ domain: 'acme.us.auth0.com', audience: RESOURCE }).authorizationServers).toEqual(['https://acme.us.auth0.com/']);
    expect(supabase({ url: 'https://ref.supabase.co' }).authorizationServers).toEqual(['https://ref.supabase.co/auth/v1']);
  });

  it('maps Entra roles and tenant', async () => {
    const { jwks, sign } = await createIssuer();
    const v = entra({ tenantId: 'tid-1', audience: RESOURCE, jwks });
    const token = await sign({ oid: 'oid-1', tid: 'tid-1', scp: 'Files.Read', roles: ['Admin'] }, { issuer: 'https://login.microsoftonline.com/tid-1/v2.0' });
    const { principal } = await v.verify(token);
    expect(principal).toMatchObject({ id: 'oid-1', orgId: 'tid-1' });
    expect(principal.scopes).toEqual(['Files.Read', 'Admin']);
  });
});

describe('apiKeys', async () => {
  const key = 'mcp_live_abc123';
  const verifier = apiKeys({ prefix: 'mcp_live_', keys: [{ id: 'svc_1', sha256: await sha256Hex(key), scopes: ['notes:read'], plan: 'team' }] });

  it('accepts a known key', async () => {
    const { principal } = await verifier.verify(key);
    expect(principal).toMatchObject({ id: 'svc_1', kind: 'api_key', plan: 'team', scopes: ['notes:read'] });
  });

  it('rejects unknown keys and wrong prefixes', async () => {
    await expect(verifier.verify('mcp_live_nope')).rejects.toThrow('not recognised');
    await expect(verifier.verify('sk_abc')).rejects.toThrow('prefix');
  });

  it('refuses plaintext keys in config', () => {
    expect(() => apiKeys({ keys: [{ id: 'x', sha256: 'plaintext' }] })).toThrow(/SHA-256/);
  });
});

describe('introspection', () => {
  it('accepts active tokens and caches them', async () => {
    let calls = 0;
    const fakeFetch = (async (_: unknown, init?: RequestInit) => {
      calls++;
      expect(String(init?.body)).toContain('token=opaque');
      return Response.json({ active: true, sub: 'u1', exp: Math.floor(Date.now() / 1000) + 300, scope: 'a b', iss: ISSUER, aud: RESOURCE });
    }) as typeof fetch;
    const v = introspection({ endpoint: `${ISSUER}/introspect`, issuer: ISSUER, clientId: 'c', clientSecret: 's', audience: RESOURCE, fetch: fakeFetch });
    expect((await v.verify('opaque')).principal.scopes).toEqual(['a', 'b']);
    await v.verify('opaque');
    expect(calls).toBe(1);
  });

  it('rejects inactive tokens', async () => {
    const v = introspection({ endpoint: 'https://x/introspect', issuer: ISSUER, clientId: 'c', clientSecret: 's', fetch: (async () => Response.json({ active: false })) as typeof fetch });
    await expect(v.verify('t')).rejects.toThrow('not active');
  });
});

describe('anyOf', async () => {
  const { jwks, sign } = await createIssuer();
  const key = 'k_123';
  const v = anyOf(jwtVerifier({ issuer: ISSUER, audience: RESOURCE, jwks }), apiKeys({ keys: [{ id: 'bot', sha256: await sha256Hex(key) }] }));

  it('accepts either credential', async () => {
    expect((await v.verify(await sign())).principal.kind).toBe('user');
    expect((await v.verify(key)).principal.kind).toBe('api_key');
    await expect(v.verify('garbage')).rejects.toBeInstanceOf(AuthError);
    expect(v.authorizationServers).toEqual([ISSUER]);
  });
});
