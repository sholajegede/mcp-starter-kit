import type { ProjectOptions } from './choices.js';

type Files = Record<string, string>;

interface EnvVar {
  name: string;
  example: string;
  comment: string;
  optional?: boolean;
}

const VERSIONS = {
  zod: '^4.2.0',
  '@opentelemetry/api': '^1.9.0',
  '@modelcontextprotocol/node': '^2.1.0',
  pg: '^8.16.0',
  '@types/pg': '^8.15.0',
  '@libsql/client': '^0.15.0',
  mysql2: '^3.14.0',
  ioredis: '^5.6.0',
  '@upstash/redis': '^1.35.0',
  mongodb: '^6.17.0',
  tsx: '^4.20.0',
  typescript: '^5.9.0',
  '@types/node': '^22.0.0',
  vitest: '^3.2.0',
  '@modelcontextprotocol/client': '^2.4.0',
  wrangler: '^4.40.0',
  '@cloudflare/workers-types': '^4.20250101.0',
  '@types/bun': '^1.2.0',
  vercel: '^48.0.0',
};

const authEnv: Record<ProjectOptions['auth'], EnvVar[]> = {
  kinde: [{ name: 'KINDE_DOMAIN', example: 'your-business.kinde.com', comment: 'Your Kinde domain (Settings > Details)' }],
  auth0: [{ name: 'AUTH0_DOMAIN', example: 'your-tenant.us.auth0.com', comment: 'Auth0 tenant domain. Create an API whose identifier is MCP_PUBLIC_URL' }],
  clerk: [{ name: 'CLERK_ISSUER', example: 'https://clerk.your-app.com', comment: 'Clerk Frontend API URL. Enable JWT access tokens for OAuth applications' }],
  workos: [{ name: 'WORKOS_AUTHKIT_DOMAIN', example: 'your-app.authkit.app', comment: 'AuthKit domain (Authentication > AuthKit)' }],
  okta: [
    { name: 'OKTA_DOMAIN', example: 'your-org.okta.com', comment: 'Okta domain' },
    { name: 'OKTA_AUTH_SERVER_ID', example: 'default', comment: 'Custom authorization server id', optional: true },
  ],
  entra: [
    { name: 'ENTRA_TENANT_ID', example: '00000000-0000-0000-0000-000000000000', comment: 'Directory (tenant) ID' },
    { name: 'ENTRA_AUDIENCE', example: 'api://your-mcp-server', comment: 'Application ID URI of the API registration' },
  ],
  keycloak: [
    { name: 'KEYCLOAK_URL', example: 'https://auth.your-company.com', comment: 'Keycloak base URL' },
    { name: 'KEYCLOAK_REALM', example: 'your-realm', comment: 'Realm name' },
  ],
  cognito: [
    { name: 'COGNITO_REGION', example: 'us-east-1', comment: 'User pool region' },
    { name: 'COGNITO_USER_POOL_ID', example: 'us-east-1_AbCdEfGhI', comment: 'User pool ID' },
    { name: 'COGNITO_CLIENT_ID', example: 'your-app-client-id', comment: 'App client allowed to call this server' },
  ],
  supabase: [{ name: 'SUPABASE_URL', example: 'https://your-project.supabase.co', comment: 'Project URL (uses the JWKS of asymmetric signing keys)' }],
  firebase: [{ name: 'FIREBASE_PROJECT_ID', example: 'your-project-id', comment: 'Firebase project ID' }],
  'better-auth': [{ name: 'BETTER_AUTH_URL', example: 'https://your-app.com/api/auth', comment: 'Better Auth base URL including the auth path' }],
  oidc: [{ name: 'OIDC_ISSUER', example: 'https://auth.your-company.com', comment: 'Issuer URL. The JWKS is discovered from it' }],
  'api-keys': [{ name: 'MCP_API_KEY_SHA256', example: '', comment: 'SHA-256 of the API key. Generate one with: npm run create-key' }],
  none: [],
};

const storeEnv: Record<ProjectOptions['store'], EnvVar[]> = {
  postgres: [{ name: 'DATABASE_URL', example: 'postgres://user:password@host:5432/db?sslmode=require', comment: 'Postgres connection string' }],
  sqlite: [
    { name: 'DATABASE_URL', example: 'file:local.db', comment: 'libsql:// URL for Turso, or file:local.db locally' },
    { name: 'DATABASE_AUTH_TOKEN', example: '', comment: 'Turso auth token', optional: true },
  ],
  mysql: [{ name: 'DATABASE_URL', example: 'mysql://user:password@host:3306/db', comment: 'MySQL connection string' }],
  mongo: [{ name: 'MONGODB_URL', example: 'mongodb+srv://user:password@cluster.mongodb.net/app', comment: 'MongoDB connection string with the database name' }],
  redis: [{ name: 'REDIS_URL', example: 'redis://localhost:6379', comment: 'Redis connection string' }],
  upstash: [
    { name: 'UPSTASH_REDIS_REST_URL', example: 'https://your-db.upstash.io', comment: 'Upstash REST URL' },
    { name: 'UPSTASH_REDIS_REST_TOKEN', example: '', comment: 'Upstash REST token' },
  ],
  memory: [],
};

const billingEnv: Record<ProjectOptions['billing'], EnvVar[]> = {
  none: [],
  quota: [{ name: 'UPGRADE_URL', example: 'https://your-app.com/pricing', comment: 'Shown to users who reach their limit', optional: true }],
  stripe: [
    { name: 'UPGRADE_URL', example: 'https://your-app.com/pricing', comment: 'Shown to users who reach their limit', optional: true },
    { name: 'STRIPE_SECRET_KEY', example: 'sk_test_...', comment: 'Stripe secret key' },
    { name: 'STRIPE_METER_EVENT', example: 'mcp_tool_calls', comment: 'Event name of your Stripe Billing Meter' },
  ],
  kinde: [{ name: 'UPGRADE_URL', example: 'https://your-app.com/pricing', comment: 'Shown to users whose plan lacks a feature', optional: true }],
  autumn: [
    { name: 'AUTUMN_SECRET_KEY', example: 'am_sk_test_...', comment: 'Autumn secret key. Feature ids default to tool names' },
    { name: 'UPGRADE_URL', example: 'https://your-app.com/pricing', comment: 'Shown to users who run out', optional: true },
  ],
  polar: [
    { name: 'POLAR_ACCESS_TOKEN', example: 'polar_oat_...', comment: 'Polar organization access token' },
    { name: 'POLAR_EVENT_NAME', example: 'mcp_tool_call', comment: 'Event name your Polar meter filters on' },
    { name: 'POLAR_SERVER', example: 'sandbox', comment: 'sandbox or production', optional: true },
  ],
};

const llmEnv: Record<ProjectOptions['llm'], EnvVar[]> = {
  none: [],
  openrouter: [{ name: 'OPENROUTER_API_KEY', example: 'sk-or-...', comment: 'OpenRouter API key' }],
  vercel: [{ name: 'AI_GATEWAY_API_KEY', example: '', comment: 'Vercel AI Gateway key' }],
  cloudflare: [
    { name: 'CLOUDFLARE_ACCOUNT_ID', example: '', comment: 'Cloudflare account ID' },
    { name: 'CLOUDFLARE_GATEWAY_ID', example: '', comment: 'AI Gateway name' },
    { name: 'CLOUDFLARE_AI_GATEWAY_TOKEN', example: '', comment: 'Gateway or provider token' },
  ],
  portkey: [
    { name: 'PORTKEY_API_KEY', example: '', comment: 'Portkey API key' },
    { name: 'PORTKEY_VIRTUAL_KEY', example: '', comment: 'Portkey virtual key', optional: true },
  ],
  litellm: [
    { name: 'LITELLM_BASE_URL', example: 'http://localhost:4000/v1', comment: 'LiteLLM proxy URL' },
    { name: 'LITELLM_API_KEY', example: '', comment: 'LiteLLM virtual key', optional: true },
  ],
  openai: [{ name: 'OPENAI_API_KEY', example: 'sk-...', comment: 'OpenAI API key' }],
  anthropic: [{ name: 'ANTHROPIC_API_KEY', example: 'sk-ant-...', comment: 'Anthropic API key' }],
  ollama: [{ name: 'OLLAMA_BASE_URL', example: 'http://127.0.0.1:11434/v1', comment: 'Ollama URL', optional: true }],
};

const defaultModel: Record<ProjectOptions['llm'], string> = {
  none: '',
  openrouter: 'anthropic/claude-haiku-4.5',
  vercel: 'anthropic/claude-haiku-4.5',
  cloudflare: 'openai/gpt-5-mini',
  portkey: 'gpt-5-mini',
  litellm: 'gpt-5-mini',
  openai: 'gpt-5-mini',
  anthropic: 'claude-haiku-4-5',
  ollama: 'llama3.2',
};

function authCode(o: ProjectOptions): { imports: string[]; expr: string } {
  const aud = 'publicUrl';
  const map: Record<ProjectOptions['auth'], [string, string]> = {
    kinde: ['kinde', `kinde({ domain: env('KINDE_DOMAIN'), audience: ${aud} })`],
    auth0: ['auth0', `auth0({ domain: env('AUTH0_DOMAIN'), audience: ${aud} })`],
    clerk: ['clerk', `clerk({ issuer: env('CLERK_ISSUER') })`],
    workos: ['workos', `workos({ domain: env('WORKOS_AUTHKIT_DOMAIN'), audience: ${aud} })`],
    okta: ['okta', `okta({ domain: env('OKTA_DOMAIN'), authorizationServerId: optionalEnv('OKTA_AUTH_SERVER_ID') ?? 'default', audience: ${aud} })`],
    entra: ['entra', `entra({ tenantId: env('ENTRA_TENANT_ID'), audience: env('ENTRA_AUDIENCE') })`],
    keycloak: ['keycloak', `keycloak({ url: env('KEYCLOAK_URL'), realm: env('KEYCLOAK_REALM'), audience: ${aud} })`],
    cognito: ['cognito', `cognito({ region: env('COGNITO_REGION'), userPoolId: env('COGNITO_USER_POOL_ID'), clientIds: [env('COGNITO_CLIENT_ID')] })`],
    supabase: ['supabase', `supabase({ url: env('SUPABASE_URL') })`],
    firebase: ['firebase', `firebase({ projectId: env('FIREBASE_PROJECT_ID') })`],
    'better-auth': ['betterAuth', `betterAuth({ baseURL: env('BETTER_AUTH_URL'), audience: ${aud} })`],
    oidc: ['oidc', `oidc({ issuer: env('OIDC_ISSUER'), audience: ${aud} })`],
    'api-keys': ['apiKeys', `apiKeys({ keys: [{ id: 'default', sha256: env('MCP_API_KEY_SHA256'), scopes: ['*'] }] })`],
    none: ['', 'undefined'],
  };
  const [fn, expr] = map[o.auth];
  return { imports: fn ? [`import { ${fn} } from 'mcp-starter-kit/auth';`] : [], expr };
}

function storeCode(o: ProjectOptions): { file: string; deps: string[]; devDeps: string[] } {
  const libsql = o.runtime === 'cloudflare' || o.runtime === 'vercel' ? '@libsql/client/web' : '@libsql/client';
  const header = `import type { Store } from 'mcp-starter-kit';\nimport type { NotesRepository } from '../notes/types.js';\n`;
  const sqlNotes = (dialect: 'postgres' | 'sqlite' | 'mysql') => {
    const p = (n: number) => (dialect === 'postgres' ? `$${n}` : '?');
    const idType = dialect === 'mysql' ? 'VARCHAR(64)' : 'TEXT';
    const ownerType = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT';
    const created = dialect === 'postgres' ? 'TIMESTAMPTZ NOT NULL DEFAULT now()' : dialect === 'mysql' ? 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' : "TEXT NOT NULL DEFAULT (datetime('now'))";
    return `
const schema = \`CREATE TABLE IF NOT EXISTS notes (
  id ${idType} PRIMARY KEY,
  tenant ${ownerType} NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at ${created}
)\`;

let migrated: Promise<unknown> | undefined;
const ready = () => (migrated ??= query(schema, []));

export function notesRepository(tenant: string): NotesRepository {
  return {
    async search(text) {
      await ready();
      const rows = await query('SELECT id, title, body FROM notes WHERE tenant = ${p(1)} AND (LOWER(title) LIKE ${p(2)} OR LOWER(body) LIKE ${p(3)}) ORDER BY created_at DESC LIMIT 50', [tenant, \`%\${text.toLowerCase()}%\`, \`%\${text.toLowerCase()}%\`]);
      return rows as Array<{ id: string; title: string; body: string }>;
    },
    async get(id) {
      await ready();
      const rows = (await query('SELECT id, title, body FROM notes WHERE tenant = ${p(1)} AND id = ${p(2)}', [tenant, id])) as Array<{ id: string; title: string; body: string }>;
      return rows[0];
    },
    async create(title, body) {
      await ready();
      const id = crypto.randomUUID();
      await query('INSERT INTO notes (id, tenant, title, body) VALUES (${p(1)}, ${p(2)}, ${p(3)}, ${p(4)})', [id, tenant, title, body]);
      return { id, title, body };
    },
    async remove(id) {
      await ready();
      const before = await this.get(id);
      if (!before) return false;
      await query('DELETE FROM notes WHERE tenant = ${p(1)} AND id = ${p(2)}', [tenant, id]);
      return true;
    },
  };
}
`;
  };

  switch (o.store) {
    case 'postgres':
      return {
        deps: ['pg'],
        devDeps: ['@types/pg'],
        file: `import pg from 'pg';
import { sqlStore } from 'mcp-starter-kit/store';
${header}import { env } from '../env.js';

let pool: pg.Pool | undefined;
const query = async (sql: string, params: unknown[]) =>
  (await (pool ??= new pg.Pool({ connectionString: env('DATABASE_URL'), max: 5 })).query(sql, params)).rows as unknown[];

export const createStore = (): Store => sqlStore({ dialect: 'postgres', query });
${sqlNotes('postgres')}`,
      };
    case 'sqlite':
      return {
        deps: ['@libsql/client'],
        devDeps: [],
        file: `import { createClient } from '${libsql}';
import { sqlStore } from 'mcp-starter-kit/store';
${header}import { env, optionalEnv } from '../env.js';

let db: ReturnType<typeof createClient> | undefined;
const query = async (sql: string, args: unknown[]) =>
  (await (db ??= createClient({ url: env('DATABASE_URL'), authToken: optionalEnv('DATABASE_AUTH_TOKEN') })).execute({ sql, args: args as never })).rows as unknown[];

export const createStore = (): Store => sqlStore({ dialect: 'sqlite', query });
${sqlNotes('sqlite')}`,
      };
    case 'mysql':
      return {
        deps: ['mysql2'],
        devDeps: [],
        file: `import mysql from 'mysql2/promise';
import { sqlStore } from 'mcp-starter-kit/store';
${header}import { env } from '../env.js';

let pool: mysql.Pool | undefined;
const query = async (sql: string, params: unknown[]) =>
  (await (pool ??= mysql.createPool({ uri: env('DATABASE_URL'), connectionLimit: 5 })).query(sql, params))[0] as unknown[];

export const createStore = (): Store => sqlStore({ dialect: 'mysql', query });
${sqlNotes('mysql')}`,
      };
    case 'mongo':
      return {
        deps: ['mongodb'],
        devDeps: [],
        file: `import { MongoClient } from 'mongodb';
import { mongoStore } from 'mcp-starter-kit/store';
${header}import { env } from '../env.js';

let client: MongoClient | undefined;
const db = () => (client ??= new MongoClient(env('MONGODB_URL'))).db();
const notesCollection = () => db().collection<{ _id: string; tenant: string; title: string; body: string; createdAt: Date }>('notes');

export const createStore = (): Store => mongoStore(db().collection('mcp_kv'));

const escape = (text: string) => text.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');

export function notesRepository(tenant: string): NotesRepository {
  const view = (d: { _id: string; title: string; body: string }) => ({ id: d._id, title: d.title, body: d.body });
  return {
    async search(text) {
      const pattern = new RegExp(escape(text), 'i');
      const docs = await notesCollection().find({ tenant, $or: [{ title: pattern }, { body: pattern }] }).sort({ createdAt: -1 }).limit(50).toArray();
      return docs.map(view);
    },
    async get(id) {
      const doc = await notesCollection().findOne({ _id: id, tenant });
      return doc ? view(doc) : undefined;
    },
    async create(title, body) {
      const id = crypto.randomUUID();
      await notesCollection().insertOne({ _id: id, tenant, title, body, createdAt: new Date() });
      return { id, title, body };
    },
    async remove(id) {
      return (await notesCollection().deleteOne({ _id: id, tenant })).deletedCount === 1;
    },
  };
}
`,
      };
    case 'redis':
      return {
        deps: ['ioredis'],
        devDeps: [],
        file: `import { Redis } from 'ioredis';
import { redisStore } from 'mcp-starter-kit/store';
${header}import { env } from '../env.js';

let client: Redis | undefined;
const redis = () => (client ??= new Redis(env('REDIS_URL')));

export const createStore = (): Store => redisStore(redis());

export function notesRepository(tenant: string): NotesRepository {
  const key = \`notes:\${tenant}\`;
  const all = async () => Object.values(await redis().hgetall(key)).map((v) => JSON.parse(v) as { id: string; title: string; body: string });
  return {
    async search(text) {
      const q = text.toLowerCase();
      return (await all()).filter((n) => \`\${n.title} \${n.body}\`.toLowerCase().includes(q)).slice(0, 50);
    },
    async get(id) {
      const raw = await redis().hget(key, id);
      return raw ? JSON.parse(raw) : undefined;
    },
    async create(title, body) {
      const note = { id: crypto.randomUUID(), title, body };
      await redis().hset(key, note.id, JSON.stringify(note));
      return note;
    },
    async remove(id) {
      return (await redis().hdel(key, id)) === 1;
    },
  };
}
`,
      };
    case 'upstash':
      return {
        deps: ['@upstash/redis'],
        devDeps: [],
        file: `import { Redis } from '@upstash/redis';
import { upstashStore } from 'mcp-starter-kit/store';
${header}import { env } from '../env.js';

let client: Redis | undefined;
const redis = () => (client ??= new Redis({ url: env('UPSTASH_REDIS_REST_URL'), token: env('UPSTASH_REDIS_REST_TOKEN') }));

export const createStore = (): Store => upstashStore({ url: env('UPSTASH_REDIS_REST_URL'), token: env('UPSTASH_REDIS_REST_TOKEN') });

export function notesRepository(tenant: string): NotesRepository {
  const key = \`notes:\${tenant}\`;
  type Note = { id: string; title: string; body: string };
  const all = async () => Object.values((await redis().hgetall<Record<string, Note>>(key)) ?? {});
  return {
    async search(text) {
      const q = text.toLowerCase();
      return (await all()).filter((n) => \`\${n.title} \${n.body}\`.toLowerCase().includes(q)).slice(0, 50);
    },
    async get(id) {
      return (await redis().hget<Note>(key, id)) ?? undefined;
    },
    async create(title, body) {
      const note = { id: crypto.randomUUID(), title, body };
      await redis().hset(key, { [note.id]: note });
      return note;
    },
    async remove(id) {
      return (await redis().hdel(key, id)) === 1;
    },
  };
}
`,
      };
    case 'memory':
      return {
        deps: [],
        devDeps: [],
        file: `import { memoryStore } from 'mcp-starter-kit/store';
import type { Store } from 'mcp-starter-kit';
export { memoryNotesRepository as notesRepository } from '../notes/memory.js';

export const createStore = (): Store => memoryStore();
`,
      };
  }
}

function billingCode(o: ProjectOptions): { imports: string[]; expr: string | undefined } {
  const plans = `plans: {
      free: { units: 100, per: 'month' },
      pro: { units: Infinity },
    },
    upgradeUrl: optionalEnv('UPGRADE_URL'),`;
  switch (o.billing) {
    case 'none':
      return { imports: [], expr: undefined };
    case 'quota':
      return { imports: ["import { quota } from 'mcp-starter-kit/billing';"], expr: `quota({\n    ${plans}\n  })` };
    case 'stripe':
      return {
        imports: ["import { allOf, quota, stripeMeter } from 'mcp-starter-kit/billing';"],
        expr: `allOf(
    quota({
      ${plans.replace(/\n {4}/g, '\n      ')}
    }),
    stripeMeter({
      secretKey: env('STRIPE_SECRET_KEY'),
      eventName: env('STRIPE_METER_EVENT'),
      customerId: (principal) => principal.claims.stripe_customer_id as string | undefined,
    }),
  )`,
      };
    case 'kinde':
      return {
        imports: ["import { kindeBilling } from 'mcp-starter-kit/billing';"],
        expr: `kindeBilling({ domain: env('KINDE_DOMAIN'), upgradeUrl: optionalEnv('UPGRADE_URL') })`,
      };
    case 'autumn':
      return {
        imports: ["import { autumn } from 'mcp-starter-kit/billing';"],
        expr: `autumn({ secretKey: env('AUTUMN_SECRET_KEY'), upgradeUrl: optionalEnv('UPGRADE_URL') })`,
      };
    case 'polar':
      return {
        imports: ["import { polar } from 'mcp-starter-kit/billing';"],
        expr: `polar({
    accessToken: env('POLAR_ACCESS_TOKEN'),
    eventName: env('POLAR_EVENT_NAME'),
    server: optionalEnv('POLAR_SERVER') === 'production' ? 'production' : 'sandbox',
  })`,
      };
  }
}

function llmCode(o: ProjectOptions): { imports: string[]; expr: string | undefined } {
  const model = `optionalEnv('LLM_MODEL') ?? '${defaultModel[o.llm]}'`;
  const map: Record<Exclude<ProjectOptions['llm'], 'none'>, [string, string]> = {
    openrouter: ['openrouter', `openrouter({ apiKey: env('OPENROUTER_API_KEY'), defaultModel: ${model} })`],
    vercel: ['vercelGateway', `vercelGateway({ apiKey: env('AI_GATEWAY_API_KEY'), defaultModel: ${model} })`],
    cloudflare: [
      'cloudflareGateway',
      `cloudflareGateway({ accountId: env('CLOUDFLARE_ACCOUNT_ID'), gatewayId: env('CLOUDFLARE_GATEWAY_ID'), apiKey: env('CLOUDFLARE_AI_GATEWAY_TOKEN'), defaultModel: ${model} })`,
    ],
    portkey: ['portkey', `portkey({ apiKey: env('PORTKEY_API_KEY'), virtualKey: optionalEnv('PORTKEY_VIRTUAL_KEY'), defaultModel: ${model} })`],
    litellm: ['litellm', `litellm({ baseURL: env('LITELLM_BASE_URL'), apiKey: optionalEnv('LITELLM_API_KEY'), defaultModel: ${model} })`],
    openai: ['openai', `openai({ apiKey: env('OPENAI_API_KEY'), defaultModel: ${model} })`],
    anthropic: ['anthropic', `anthropic({ apiKey: env('ANTHROPIC_API_KEY'), defaultModel: ${model} })`],
    ollama: ['ollama', `ollama({ baseURL: optionalEnv('OLLAMA_BASE_URL'), defaultModel: ${model} })`],
  };
  if (o.llm === 'none') return { imports: [], expr: undefined };
  const [fn, expr] = map[o.llm];
  return { imports: [`import { ${fn} } from 'mcp-starter-kit/llm';`], expr };
}

function envExample(o: ProjectOptions): string {
  const groups: Array<[string, EnvVar[]]> = [
    [
      'Server',
      [
        { name: 'MCP_PUBLIC_URL', example: 'http://localhost:3000/mcp', comment: 'Public URL of the MCP endpoint. Use your https URL in production' },
        { name: 'LOG_LEVEL', example: 'info', comment: 'debug, info, warn or error', optional: true },
      ],
    ],
    ['Auth', authEnv[o.auth]],
    ['Database', storeEnv[o.store]],
    ['Billing', billingEnv[o.billing]],
    ['LLM', [...llmEnv[o.llm], ...(o.llm !== 'none' ? [{ name: 'LLM_MODEL', example: defaultModel[o.llm], comment: 'Model id in the router naming', optional: true }] : [])]],
  ];
  return (
    groups
      .filter(([, vars]) => vars.length)
      .map(([title, vars]) => `# ${title}\n${vars.map((v) => `# ${v.comment}${v.optional ? ' (optional)' : ''}\n${v.optional ? '# ' : ''}${v.name}=${v.example}`).join('\n')}`)
      .join('\n\n') + '\n'
  );
}

function serverFile(o: ProjectOptions): string {
  const auth = authCode(o);
  const billing = billingCode(o);
  const llm = llmCode(o);
  const usesEnv = /\benv\(/.test([billing.expr, llm.expr, auth.expr].join(' '));
  const imports = [
    "import { defineServer, type ServerConfig } from 'mcp-starter-kit';",
    "import { openTelemetry } from 'mcp-starter-kit/otel';",
    ...auth.imports,
    ...billing.imports,
    ...llm.imports,
    `import { ${usesEnv ? 'env, optionalEnv' : 'optionalEnv'} } from './env.js';`,
    "import { createStore, notesRepository } from './db/index.js';",
    "import { prompts } from './prompts.js';",
    "import { resources } from './resources.js';",
    "import { tools, type Services } from './tools/index.js';",
  ];

  return `${imports.join('\n')}

export type Overrides = Partial<ServerConfig<Services>>;

export function createServer(overrides: Overrides = {}) {
  const publicUrl = optionalEnv('MCP_PUBLIC_URL') ?? 'http://localhost:3000/mcp';
  const has = (key: keyof Overrides) => key in overrides;

  return defineServer<Services>({
    name: '${o.name}',
    version: '0.1.0',
    instructions: 'Notes are private to the signed-in user or their organization. Search before creating to avoid duplicates.',
    publicUrl,
    ${o.auth === 'none' ? 'allowAnonymous: true,' : `auth: has('auth') ? overrides.auth : ${auth.expr},`}
    store: has('store') ? overrides.store : createStore(),
    ${billing.expr ? `entitlements: has('entitlements') ? overrides.entitlements : ${billing.expr},` : ''}
    ${llm.expr ? `llm: has('llm') ? overrides.llm : ${llm.expr},` : ''}
    services: (principal) => ({ notes: notesRepository(principal.orgId ?? principal.id) }),
    tools,
    resources,
    prompts,
    telemetry: openTelemetry(),
    logLevel: (optionalEnv('LOG_LEVEL') as 'info' | undefined) ?? 'info',
    http: { allowedHosts: [new URL(publicUrl).hostname, 'localhost', '127.0.0.1'] },
    ...overrides,
  });
}
`.replace(/\n {4}\n/g, '\n');
}

function toolsFiles(o: ProjectOptions): Files {
  const files: Files = {};
  files['src/tools/whoami.ts'] = `import { defineTool } from 'mcp-starter-kit';
import { z } from 'zod';

export const whoami = defineTool({
  name: 'whoami',
  title: 'Who am I',
  description: 'Show the signed-in identity, organization, plan and scopes this server sees for the current caller.',
  output: z.object({
    id: z.string(),
    kind: z.string(),
    email: z.string().nullable(),
    orgId: z.string().nullable(),
    plan: z.string().nullable(),
    scopes: z.array(z.string()),
  }),
  annotations: { readOnlyHint: true },
  cost: 0,
  handler: (_input, { principal }) => ({
    id: principal.id,
    kind: principal.kind,
    email: principal.email ?? null,
    orgId: principal.orgId ?? null,
    plan: principal.plan ?? null,
    scopes: principal.scopes,
  }),
});
`;
  files['src/tools/notes.ts'] = `import { ToolError } from 'mcp-starter-kit';
import { z } from 'zod';
import { tool } from './tool.js';

const Note = z.object({ id: z.string(), title: z.string(), body: z.string() });

export const searchNotes = tool({
  name: 'search_notes',
  title: 'Search notes',
  description: 'Find notes whose title or body contains the query. Returns up to 50 matches, newest first.',
  input: z.object({ query: z.string().min(1).describe('Text to look for') }),
  output: z.object({ notes: z.array(Note) }),
  annotations: { readOnlyHint: true },
  cost: 0,
  handler: async ({ query }, ctx) => ({ notes: await ctx.services.notes.search(query) }),
});

export const createNote = tool({
  name: 'create_note',
  title: 'Create note',
  description: 'Save a new note. Fails if a note with the same title exists.',
  input: z.object({
    title: z.string().min(1).max(200),
    body: z.string().max(20_000),
  }),
  output: Note,
  rateLimit: { limit: 30, window: '1m' },
  handler: async ({ title, body }, ctx) => {
    const existing = await ctx.services.notes.search(title);
    if (existing.some((n) => n.title.toLowerCase() === title.toLowerCase())) {
      throw new ToolError(\`A note titled "\${title}" already exists. Pick another title or update the existing note.\`);
    }
    return ctx.services.notes.create(title, body);
  },
});

export const deleteNote = tool({
  name: 'delete_note',
  title: 'Delete note',
  description: 'Delete a note permanently. The user is asked to confirm first.',
  input: z.object({ id: z.string() }),
  annotations: { destructiveHint: true, idempotentHint: true },
  cost: 0,
  confirm: ({ id }) => \`Delete note \${id}? This cannot be undone.\`,
  handler: async ({ id }, ctx) => {
    if (!(await ctx.services.notes.remove(id))) throw new ToolError(\`No note with id \${id}.\`);
    return \`Deleted note \${id}.\`;
  },
});
`;
  files['src/tools/tool.ts'] = `import { createTool } from 'mcp-starter-kit';
import type { NotesRepository } from '../notes/types.js';

export interface Services {
  notes: NotesRepository;
}

export const tool = createTool<Services>();
`;
  if (o.llm !== 'none') {
    files['src/tools/summarize.ts'] = `import { ToolError } from 'mcp-starter-kit';
import { z } from 'zod';
import { tool } from './tool.js';

export const summarizeNote = tool({
  name: 'summarize_note',
  title: 'Summarize note',
  description: 'Summarize a note in three sentences using the configured model.',
  input: z.object({ id: z.string() }),
  annotations: { readOnlyHint: true, openWorldHint: true },
  cost: 5,
  timeoutMs: 60_000,
  handler: async ({ id }, ctx) => {
    const note = await ctx.services.notes.get(id);
    if (!note) throw new ToolError(\`No note with id \${id}.\`);
    const { text } = await ctx.llm.chat({
      messages: [
        { role: 'system', content: 'Summarize the note in at most three sentences. Keep names, numbers and dates.' },
        { role: 'user', content: \`# \${note.title}\\n\\n\${note.body}\` },
      ],
      signal: ctx.signal,
    });
    return text;
  },
});
`;
  }
  const entries = ['whoami', 'searchNotes', 'createNote', 'deleteNote', ...(o.llm !== 'none' ? ['summarizeNote'] : [])];
  files['src/tools/index.ts'] = `import type { AnyTool } from 'mcp-starter-kit';
import { createNote, deleteNote, searchNotes } from './notes.js';
${o.llm !== 'none' ? "import { summarizeNote } from './summarize.js';\n" : ''}import { whoami } from './whoami.js';
// mcp-starter-kit:imports

export type { Services } from './tool.js';

export const tools: AnyTool[] = [
${entries.map((e) => `  ${e},`).join('\n')}
  // mcp-starter-kit:tools
];
`;
  return files;
}

function runtimeFiles(o: ProjectOptions): { files: Files; scripts: Record<string, string>; deps: string[]; devDeps: string[] } {
  const stdio = `import { serveStdio } from 'mcp-starter-kit/stdio';
import { createServer } from './server.js';

await serveStdio(createServer());
`;
  switch (o.runtime) {
    case 'node':
      return {
        files: {
          'src/http.ts': `import { listen } from 'mcp-starter-kit/node';
import { createServer } from './server.js';

await listen(createServer(), { port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '127.0.0.1' });
`,
          'src/stdio.ts': stdio,
          Dockerfile: `FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/http.js"]
`,
          '.dockerignore': 'node_modules\ndist\n.env\n.env.*\n',
        },
        scripts: {
          dev: 'tsx watch --env-file-if-exists=.env src/http.ts',
          stdio: 'tsx --env-file-if-exists=.env src/stdio.ts',
          build: 'tsc -p tsconfig.build.json',
          start: 'node --env-file-if-exists=.env dist/http.js',
        },
        deps: ['@modelcontextprotocol/node'],
        devDeps: ['tsx'],
      };
    case 'cloudflare':
      return {
        files: {
          'src/worker.ts': `import { createServer } from './server.js';

let server: ReturnType<typeof createServer> | undefined;

export default {
  fetch(request: Request): Promise<Response> {
    server ??= createServer();
    return server.fetch(request);
  },
};
`,
          'wrangler.jsonc': `{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "${o.name}",
  "main": "src/worker.ts",
  "compatibility_date": "2026-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "vars": {
    "MCP_PUBLIC_URL": "https://${o.name}.your-subdomain.workers.dev/mcp"
  }
}
`,
        },
        scripts: { dev: 'wrangler dev', deploy: 'wrangler deploy', 'cf-typegen': 'wrangler types' },
        deps: [],
        devDeps: ['wrangler'],
      };
    case 'vercel':
      return {
        files: {
          'api/index.ts': `import { createServer } from '../src/server.js';

let server: ReturnType<typeof createServer> | undefined;
const handle = (request: Request) => (server ??= createServer()).fetch(request);

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
`,
          'vercel.json': `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
`,
        },
        scripts: { dev: 'vercel dev', deploy: 'vercel deploy --prod' },
        deps: [],
        devDeps: ['vercel'],
      };
    case 'bun':
      return {
        files: {
          'src/http.ts': `import { createServer } from './server.js';

const server = createServer();
const port = Number(process.env.PORT ?? 3000);

Bun.serve({ port, hostname: process.env.HOST ?? '127.0.0.1', fetch: server.fetch });
server.log.info('listening', { url: \`http://localhost:\${port}/mcp\` });
`,
          'src/stdio.ts': stdio,
        },
        scripts: { dev: 'bun --watch src/http.ts', stdio: 'bun src/stdio.ts', start: 'bun src/http.ts' },
        deps: [],
        devDeps: ['@types/bun'],
      };
    case 'deno':
      return {
        files: {
          'src/http.ts': `import { createServer } from './server.js';

declare const Deno: { serve(options: { port: number; hostname: string }, handler: (request: Request) => Promise<Response>): unknown };

const server = createServer();
Deno.serve({ port: Number(process.env.PORT ?? 3000), hostname: process.env.HOST ?? '127.0.0.1' }, server.fetch);
`,
          'src/stdio.ts': stdio,
          'deno.json': `{
  "nodeModulesDir": "auto",
  "tasks": {
    "dev": "deno run --env-file=.env -A --watch src/http.ts",
    "stdio": "deno run --env-file=.env -A src/stdio.ts",
    "start": "deno run --env-file=.env -A src/http.ts"
  }
}
`,
        },
        scripts: { dev: 'deno task dev', stdio: 'deno task stdio', start: 'deno task start' },
        deps: [],
        devDeps: [],
      };
  }
}

function readme(o: ProjectOptions, scripts: Record<string, string>): string {
  const run = o.runtime === 'cloudflare' ? 'npm run dev' : 'npm run dev';
  const localUrl = o.runtime === 'cloudflare' ? 'http://localhost:8787/mcp' : 'http://localhost:3000/mcp';
  const hasStdio = 'stdio' in scripts;
  const secrets =
    o.runtime === 'cloudflare'
      ? '\nWrangler reads local values from `.dev.vars`, so copy `.env` there for `wrangler dev`. In production, add each value with `npx wrangler secret put NAME`.\n'
      : o.runtime === 'vercel'
        ? '\nIn production, add each value in the Vercel project settings under Environment Variables, or with `vercel env add`.\n'
        : '';
  const authNote =
    o.auth === 'none'
      ? 'This server has no authentication, so anyone who can reach it can call every tool. Keep it on localhost, or add a provider with the `auth` option in `src/server.ts`.'
      : o.auth === 'api-keys'
        ? 'Callers send an API key as a bearer token. Create one with `npm run create-key`: it prints the key once and the SHA-256 digest that goes in `MCP_API_KEY_SHA256`.'
        : 'MCP clients sign users in with your provider using OAuth. The server publishes `/.well-known/oauth-protected-resource`, which tells clients where to log in, and checks every token against your provider\'s keys. Register `MCP_PUBLIC_URL` as the API audience (or resource) with your provider so tokens are issued for this server.';

  return `# ${o.name}

An MCP server built on [mcp-starter-kit](https://github.com/sholajegede/mcp-starter-kit). It ships with a notes example to replace with your own: the tools \`search_notes\`, \`create_note\`, \`delete_note\` (asks the user to confirm), \`whoami\`${o.llm !== 'none' ? ' and `summarize_note` (calls a model)' : ''}, a \`notes://{id}\` resource, and a \`weekly_review\` prompt.

\`\`\`
client ──▶ ${o.runtime} ──▶ auth (${o.auth}) ──▶ scopes, rate limits${o.billing !== 'none' ? `, ${o.billing} billing` : ''} ──▶ tools ──▶ ${o.store}
\`\`\`

## Run it

\`\`\`bash
cp .env.example .env
${o.runtime === 'deno' ? 'deno install' : o.runtime === 'bun' ? 'bun install' : 'npm install'}
${run}
\`\`\`

Fill in \`.env\` before starting. Every variable is described in \`.env.example\`.
${secrets}
The MCP endpoint is \`${localUrl}\`. Check it with the MCP Inspector:

\`\`\`bash
npx @modelcontextprotocol/inspector
\`\`\`

## Authentication

${authNote}

## Connect a client

Claude Code:

\`\`\`bash
claude mcp add --transport http ${o.name} ${localUrl}
\`\`\`

Cursor (\`~/.cursor/mcp.json\`) and VS Code (\`.vscode/mcp.json\`, under \`servers\` with \`"type": "http"\`):

\`\`\`json
{ "mcpServers": { "${o.name}": { "url": "${localUrl}" } } }
\`\`\`

In Claude and ChatGPT, add the deployed URL as a custom connector.
${
  hasStdio
    ? `
For clients that start servers as a local process, use stdio. The credential comes from the environment:

\`\`\`json
{
  "mcpServers": {
    "${o.name}": {
      "command": "npm",
      "args": ["run", "--silent", "stdio", "--prefix", "/absolute/path/to/${o.name}"]${o.auth !== 'none' ? `,
      "env": { "MCP_ACCESS_TOKEN": "<access token or API key>" }` : ''}
    }
  }
}
\`\`\`
`
    : ''
}
## Add a tool

\`\`\`bash
npx mcp-starter-kit add tool create_invoice
\`\`\`

This creates \`src/tools/create-invoice.ts\` and registers it. Tools get typed input, \`ctx.principal\`, \`ctx.services\`${o.llm !== 'none' ? ', `ctx.llm`' : ''} and options for scopes, rate limits, cost and confirmation.

## Observability

Logs are JSON lines on stderr. Every tool call, resource read and prompt render is also an OpenTelemetry span with the MCP semantic conventions, plus an \`mcp.server.operation.duration\` histogram. They cost nothing until you register an OpenTelemetry SDK with an exporter for your backend, and when a client sends a \`traceparent\`, the span joins its trace.

## Test

\`\`\`bash
npm test
\`\`\`

The tests run the real server in-process with the official MCP client and an in-memory notes repository, so they need no database or credentials.
${o.runtime === 'node' ? '\n## Deploy\n\n`npm run build` compiles to `dist/`. The Dockerfile builds a production image that listens on port 3000; set `MCP_PUBLIC_URL` to the public https URL.\n' : o.runtime === 'cloudflare' || o.runtime === 'vercel' ? '\n## Deploy\n\n```bash\nnpm run deploy\n```\n\nSet `MCP_PUBLIC_URL` to the deployed https URL ending in `/mcp`.\n' : ''}`;
}

export function generateProject(o: ProjectOptions, kitVersion: string): Files {
  const store = storeCode(o);
  const rt = runtimeFiles(o);
  const files: Files = { ...toolsFiles(o), ...rt.files };

  files['src/env.ts'] = `export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

export function env(name: string): string {
  const value = optionalEnv(name);
  if (value === undefined) throw new Error(\`Missing environment variable \${name}. See .env.example.\`);
  return value;
}
`;
  files['src/server.ts'] = serverFile(o);
  files['src/resources.ts'] = `import { defineResourceTemplate, ToolError, type AnyResource } from 'mcp-starter-kit';
import type { Services } from './tools/index.js';

export const resources: AnyResource[] = [
  defineResourceTemplate<Services>({
    name: 'note',
    title: 'Note',
    description: 'A single note as Markdown, addressed by its id.',
    uriTemplate: 'notes://{id}',
    mimeType: 'text/markdown',
    read: async ({ id }, ctx) => {
      const note = await ctx.services.notes.get(id ?? '');
      if (!note) throw new ToolError(\`No note with id \${id}.\`);
      return \`# \${note.title}\\n\\n\${note.body}\`;
    },
  }),
];
`;
  files['src/prompts.ts'] = `import { definePrompt, type AnyPrompt } from 'mcp-starter-kit';
import { z } from 'zod';

export const prompts: AnyPrompt[] = [
  definePrompt({
    name: 'weekly_review',
    title: 'Weekly review',
    description: 'Review recent notes on a topic and list open decisions.',
    args: z.object({ topic: z.string().describe('What to review, e.g. "launch"') }),
    render: ({ topic }) =>
      \`Search my notes for "\${topic}" with search_notes, then list the decisions that are still open, who owns each one, and what is blocking it.\`,
  }),
];
`;
  files['src/db/index.ts'] = store.file;
  files['src/notes/types.ts'] = `export interface Note {
  id: string;
  title: string;
  body: string;
}

export interface NotesRepository {
  search(text: string): Promise<Note[]>;
  get(id: string): Promise<Note | undefined>;
  create(title: string, body: string): Promise<Note>;
  remove(id: string): Promise<boolean>;
}
`;
  files['src/notes/memory.ts'] = `import type { Note, NotesRepository } from './types.js';

const tenants = new Map<string, Map<string, Note>>();

export function memoryNotesRepository(tenant: string): NotesRepository {
  const notes = tenants.get(tenant) ?? new Map<string, Note>();
  tenants.set(tenant, notes);
  return {
    async search(text) {
      const q = text.toLowerCase();
      return [...notes.values()].filter((n) => \`\${n.title} \${n.body}\`.toLowerCase().includes(q)).reverse().slice(0, 50);
    },
    async get(id) {
      return notes.get(id);
    },
    async create(title, body) {
      const note = { id: crypto.randomUUID(), title, body };
      notes.set(note.id, note);
      return note;
    },
    async remove(id) {
      return notes.delete(id);
    },
  };
}
`;
  files['test/tools.test.ts'] = `import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { memoryStore } from 'mcp-starter-kit/store';
import { describe, expect, it } from 'vitest';
import { memoryNotesRepository } from '../src/notes/memory.js';
import { createServer } from '../src/server.js';

async function connect() {
  const notes = memoryNotesRepository(crypto.randomUUID());
  const server = createServer({
    auth: undefined,
    allowAnonymous: true,
    store: memoryStore(),
    entitlements: undefined,
    llm: undefined,
    logLevel: 'silent',
    services: () => ({ notes }),
  });
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), { fetch: (url, init) => server.fetch(new Request(url, init)) }));
  return client;
}

describe('${o.name}', () => {
  it('creates and finds notes', async () => {
    const client = await connect();
    const created = await client.callTool({ name: 'create_note', arguments: { title: 'Launch plan', body: 'Ship on Friday' } });
    expect(created.isError).toBeFalsy();
    const found = await client.callTool({ name: 'search_notes', arguments: { query: 'friday' } });
    expect((found.structuredContent as { notes: unknown[] }).notes).toHaveLength(1);
  });

  it('serves notes as resources and renders the review prompt', async () => {
    const client = await connect();
    const created = await client.callTool({ name: 'create_note', arguments: { title: 'Pricing', body: 'Decide on tiers' } });
    const { id } = created.structuredContent as { id: string };
    const { contents } = await client.readResource({ uri: \`notes://\${id}\` });
    expect((contents[0] as { text: string }).text).toContain('# Pricing');
    const prompt = await client.getPrompt({ name: 'weekly_review', arguments: { topic: 'pricing' } });
    expect(prompt.messages).toHaveLength(1);
  });

  it('refuses duplicate titles with a message the model can act on', async () => {
    const client = await connect();
    await client.callTool({ name: 'create_note', arguments: { title: 'Launch plan', body: 'a' } });
    const again = await client.callTool({ name: 'create_note', arguments: { title: 'launch plan', body: 'b' } });
    expect(again.isError).toBe(true);
  });
});
`;

  const deps: Record<string, string> = { 'mcp-starter-kit': `^${kitVersion}`, zod: VERSIONS.zod, '@opentelemetry/api': VERSIONS['@opentelemetry/api'] };
  for (const d of [...store.deps, ...rt.deps]) deps[d] = VERSIONS[d as keyof typeof VERSIONS];
  const devDeps: Record<string, string> = {
    '@modelcontextprotocol/client': VERSIONS['@modelcontextprotocol/client'],
    '@types/node': VERSIONS['@types/node'],
    typescript: VERSIONS.typescript,
    vitest: VERSIONS.vitest,
  };
  for (const d of [...store.devDeps, ...rt.devDeps]) devDeps[d] = VERSIONS[d as keyof typeof VERSIONS];

  const scripts: Record<string, string> = {
    ...rt.scripts,
    test: 'vitest run',
    typecheck: 'tsc --noEmit',
    ...(o.auth === 'api-keys' ? { 'create-key': 'node scripts/create-key.mjs' } : {}),
  };
  const sort = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));

  files['package.json'] =
    JSON.stringify(
      {
        name: o.name,
        version: '0.1.0',
        private: true,
        type: 'module',
        engines: { node: '>=22' },
        scripts,
        dependencies: sort(deps),
        devDependencies: sort(devDeps),
      },
      null,
      2,
    ) + '\n';

  const types = o.runtime === 'bun' ? ['node', 'bun'] : ['node'];
  files['tsconfig.json'] =
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2023', 'DOM', 'DOM.Iterable'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noUncheckedIndexedAccess: true,
          skipLibCheck: true,
          verbatimModuleSyntax: true,
          types,
          outDir: 'dist',
        },
        include: ['src', 'test', ...(o.runtime === 'vercel' ? ['api'] : [])],
      },
      null,
      2,
    ) + '\n';
  if (o.runtime === 'node') {
    files['tsconfig.build.json'] = JSON.stringify({ extends: './tsconfig.json', compilerOptions: { rootDir: 'src' }, include: ['src'] }, null, 2) + '\n';
  }

  if (o.auth === 'api-keys') {
    files['scripts/create-key.mjs'] = `import { createHash, randomBytes } from 'node:crypto';

const key = \`mcp_\${randomBytes(24).toString('base64url')}\`;
const sha256 = createHash('sha256').update(key).digest('hex');

console.log(\`API key (store it now, it is not shown again):\\n  \${key}\\n\\nMCP_API_KEY_SHA256=\${sha256}\`);
`;
  }

  files['.env.example'] = envExample(o);
  files['.gitignore'] = `node_modules/\ndist/\n.env\n.env.*\n!.env.example\n.dev.vars\n.wrangler/\n.vercel/\n*.db\n`;
  files['README.md'] = readme(o, scripts);
  return files;
}

export function toolFile(name: string): { path: string; exportName: string; content: string } {
  const exportName = name.replace(/[-_.]+([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  const file = name.replace(/_/g, '-');
  return {
    path: `src/tools/${file}.ts`,
    exportName,
    content: `import { z } from 'zod';
import { tool } from './tool.js';

export const ${exportName} = tool({
  name: '${name}',
  title: '${name.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase())}',
  description: 'Describe what this tool does and when the model should call it.',
  input: z.object({
    id: z.string().describe('What this field means'),
  }),
  output: z.object({
    ok: z.boolean(),
  }),
  handler: async ({ id }, ctx) => {
    ctx.log.info('${name} called', { id });
    return { ok: true };
  },
});
`,
  };
}
