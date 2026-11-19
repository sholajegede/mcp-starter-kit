export const AUTH = [
  { value: 'kinde', label: 'Kinde' },
  { value: 'auth0', label: 'Auth0' },
  { value: 'clerk', label: 'Clerk' },
  { value: 'workos', label: 'WorkOS AuthKit' },
  { value: 'okta', label: 'Okta' },
  { value: 'entra', label: 'Microsoft Entra ID' },
  { value: 'keycloak', label: 'Keycloak' },
  { value: 'cognito', label: 'Amazon Cognito' },
  { value: 'supabase', label: 'Supabase Auth' },
  { value: 'firebase', label: 'Firebase Auth' },
  { value: 'better-auth', label: 'Better Auth' },
  { value: 'oidc', label: 'Other OpenID Connect provider' },
  { value: 'api-keys', label: 'API keys only' },
  { value: 'none', label: 'None (local development only)' },
] as const;

export const STORE = [
  { value: 'postgres', label: 'Postgres', hint: 'Neon, Supabase, RDS, Vercel Postgres' },
  { value: 'sqlite', label: 'SQLite / libSQL', hint: 'local file or Turso' },
  { value: 'mysql', label: 'MySQL', hint: 'PlanetScale, RDS' },
  { value: 'mongo', label: 'MongoDB', hint: 'Atlas or self-hosted' },
  { value: 'redis', label: 'Redis', hint: 'any Redis server' },
  { value: 'upstash', label: 'Upstash Redis', hint: 'REST, works on the edge' },
  { value: 'memory', label: 'In memory', hint: 'prototypes and stdio tools' },
] as const;

export const BILLING = [
  { value: 'none', label: 'None' },
  { value: 'quota', label: 'Plan quotas', hint: 'free and pro limits in your store' },
  { value: 'stripe', label: 'Plan quotas + Stripe usage billing' },
  { value: 'kinde', label: 'Kinde Billing', hint: 'needs Kinde auth' },
] as const;

export const LLM = [
  { value: 'none', label: 'None' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'vercel', label: 'Vercel AI Gateway' },
  { value: 'cloudflare', label: 'Cloudflare AI Gateway' },
  { value: 'portkey', label: 'Portkey' },
  { value: 'litellm', label: 'LiteLLM proxy' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama (local)' },
] as const;

export const RUNTIME = [
  { value: 'node', label: 'Node.js', hint: 'HTTP + stdio, any host or container' },
  { value: 'cloudflare', label: 'Cloudflare Workers' },
  { value: 'vercel', label: 'Vercel Functions' },
  { value: 'bun', label: 'Bun', hint: 'HTTP + stdio' },
  { value: 'deno', label: 'Deno', hint: 'HTTP + stdio, Deno Deploy' },
] as const;

export type Auth = (typeof AUTH)[number]['value'];
export type StoreChoice = (typeof STORE)[number]['value'];
export type Billing = (typeof BILLING)[number]['value'];
export type Llm = (typeof LLM)[number]['value'];
export type Runtime = (typeof RUNTIME)[number]['value'];

export interface ProjectOptions {
  name: string;
  auth: Auth;
  store: StoreChoice;
  billing: Billing;
  llm: Llm;
  runtime: Runtime;
}

export const DEFAULTS: Omit<ProjectOptions, 'name'> = {
  auth: 'kinde',
  store: 'postgres',
  billing: 'quota',
  llm: 'none',
  runtime: 'node',
};

export function isChoice<T extends readonly { value: string }[]>(list: T, value: unknown): value is T[number]['value'] {
  return typeof value === 'string' && list.some((c) => c.value === value);
}

export function validateOptions(o: ProjectOptions): string | undefined {
  if (!/^[a-z0-9][a-z0-9-_.]{0,213}$/.test(o.name)) return 'Project name must be a valid npm package name (lowercase, no spaces).';
  if (o.billing === 'kinde' && o.auth !== 'kinde') return 'Kinde Billing needs Kinde auth.';
  if ((o.billing === 'quota' || o.billing === 'stripe') && o.auth === 'none') return 'Billing needs an auth provider so usage can be tied to a user.';
  if (o.runtime === 'cloudflare' && o.store === 'redis') return 'Cloudflare Workers cannot open raw Redis connections. Use Upstash instead.';
  if (o.runtime === 'cloudflare' && o.store === 'mongo') return 'Cloudflare Workers cannot open MongoDB driver connections. Pick Postgres, SQLite (Turso) or Upstash.';
  if ((o.runtime === 'cloudflare' || o.runtime === 'vercel') && o.store === 'memory') return 'Serverless instances do not share memory. Pick a database so limits hold across instances.';
  return undefined;
}
