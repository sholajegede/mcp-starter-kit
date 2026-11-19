import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet, type JWTPayload } from 'jose';
import type { StarterServer } from '../src/index.js';

export const ISSUER = 'https://auth.example.test';
export const RESOURCE = 'https://mcp.example.test/mcp';

export async function createIssuer() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const jwks: JSONWebKeySet = { keys: [jwk] };
  const sign = (claims: JWTPayload & Record<string, unknown> = {}, options: { expiresIn?: string | number; issuer?: string; audience?: string } = {}) =>
    new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? RESOURCE)
      .setSubject((claims.sub as string) ?? 'user_1')
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m')
      .sign(privateKey);
  return { jwks, sign };
}

export async function connect(
  server: StarterServer,
  options: { token?: string; era?: 'modern' | 'legacy'; elicit?: (message: string) => { action: 'accept' | 'decline'; content?: Record<string, unknown> } } = {},
) {
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    {
      capabilities: options.elicit ? { elicitation: {} } : {},
      versionNegotiation: { mode: options.era === 'legacy' ? 'legacy' : { pin: '2026-07-28' } },
    },
  );
  if (options.elicit) {
    const elicit = options.elicit;
    client.setRequestHandler('elicitation/create', async (request: { params: { message: string } }) => elicit(request.params.message) as never);
  }
  const transport = new StreamableHTTPClientTransport(new URL(RESOURCE), {
    fetch: (url, init) => server.fetch(new Request(url, init)),
    ...(options.token ? { requestInit: { headers: { authorization: `Bearer ${options.token}` } } } : {}),
  });
  await client.connect(transport);
  return client;
}

export function text(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content.map((c) => c.text ?? '').join('\n');
}
