# mcp-starter-kit

A production foundation for Model Context Protocol servers. You write the tools. The kit handles who is calling, what they are allowed to do, how much they have used, and where the server runs.

It sits on the official MCP TypeScript SDK (v2, spec revision `2026-07-28`, with 2025-era clients still served) and stays out of your stack: any OAuth or OIDC provider, any database, any billing system, any runtime.

> Version 2 is a rewrite. 1.x generated a Kinde + Neon CRUD app for Cursor and is deprecated. See [Migrating from 1.x](#migrating-from-1x).

## Why it exists

Getting a demo MCP server to answer `tools/list` takes ten minutes. Getting one ready for real users takes much longer, because the work that matters sits around the tools:

- verifying tokens properly (signature, issuer, audience, expiry) and publishing the OAuth metadata MCP clients look for
- knowing which tenant a call belongs to and passing that to your database layer
- per-tool scopes, rate limits and usage quotas that hold across instances
- asking the user before a destructive action runs
- keeping internal errors away from the model while still giving it messages it can act on
- calling an LLM from inside a tool now that sampling is deprecated
- running the same server over stdio for local clients and over HTTP behind a load balancer

The kit does those things once, with adapters, so the same server code works with Kinde or Auth0 or Entra, with Postgres or Redis or Mongo, on Node or Cloudflare Workers.

## How a tool call flows

```
MCP client (Claude, ChatGPT, Cursor, VS Code, an agent)
   │  Authorization: Bearer <token>
   ▼
┌──────────────────────────── mcp-starter-kit ────────────────────────────┐
│ auth adapter        verify token, map claims to a Principal              │
│                     (Kinde, Auth0, Clerk, WorkOS, Okta, Entra, Keycloak, │
│                      Cognito, Supabase, Firebase, Better Auth, any OIDC, │
│                      opaque tokens, API keys)                            │
│ scope check         per tool; OAuth clients get a step-up challenge      │
│ confirmation        destructive tools ask the user first                 │
│ rate limit          per user, per org or global, in the shared store     │
│ entitlements        quotas, Stripe, Kinde, Autumn, Polar, or your own    │
│ your handler        typed input, ctx.services, ctx.llm, ctx.progress     │
│ result              structured output, safe errors, usage settled        │
└──────────────────────────────────────────────────────────────────────────┘
   │                     │                      │
 store adapter       LLM router             runtime
 memory, Postgres,   OpenRouter, Vercel     stdio, Node HTTP, Workers,
 SQLite, MySQL,      AI Gateway, LiteLLM,   Bun, Deno, Vercel, any
 Redis, Upstash,     Portkey, Cloudflare,   fetch-based host
 Mongo               OpenAI, Anthropic
```

## Start a project

```bash
npx mcp-starter-kit my-server
```

The generator asks where the server runs, who signs users in, which database you use, how you limit or charge for usage, and whether tools call a model. It then writes a working project for that combination: the server, a notes toolset to replace with your own, database code for your store, entry points for your runtime (with a Dockerfile, `wrangler.jsonc` or `vercel.json` where they apply), an `.env.example` that lists only the variables your choices need, a README and tests.

Skip the questions by passing everything as flags:

```bash
npx mcp-starter-kit my-server --runtime cloudflare --auth workos --store upstash --billing stripe --llm openrouter -y
```

| Flag | Choices |
| --- | --- |
| `--runtime` | `node`, `cloudflare`, `vercel`, `bun`, `deno` |
| `--auth` | `kinde`, `auth0`, `clerk`, `workos`, `okta`, `entra`, `keycloak`, `cognito`, `supabase`, `firebase`, `better-auth`, `oidc`, `api-keys`, `none` |
| `--store` | `postgres`, `sqlite`, `mysql`, `mongo`, `redis`, `upstash`, `memory` |
| `--billing` | `none`, `quota`, `stripe`, `kinde`, `autumn`, `polar` |
| `--llm` | `none`, `openrouter`, `vercel`, `cloudflare`, `portkey`, `litellm`, `openai`, `anthropic`, `ollama` |

Combinations that cannot work are refused with the reason, for example raw Redis on Cloudflare Workers, which cannot open TCP connections.

Inside a generated project, add a tool with:

```bash
npx mcp-starter-kit add tool create_invoice
```

## Install into an existing project

```bash
npm install mcp-starter-kit zod
# only for the Node HTTP runtime
npm install @modelcontextprotocol/node
```

Node 22 or later. Bun, Deno and Workers work through the `fetch` handler.

## A server in one file

```ts
import { z } from 'zod';
import { defineServer, defineTool, ToolError } from 'mcp-starter-kit';
import { kinde } from 'mcp-starter-kit/auth';
import { quota } from 'mcp-starter-kit/billing';

export const server = defineServer({
  name: 'invoices',
  version: '1.0.0',
  publicUrl: 'https://mcp.acme.com/mcp',
  auth: kinde({ domain: 'acme.kinde.com', audience: 'https://mcp.acme.com/mcp' }),
  entitlements: quota({ plans: { free: { units: 100, per: 'month' }, pro: { units: Infinity } } }),
  tools: [
    defineTool({
      name: 'create_invoice',
      description: 'Create a draft invoice for a customer.',
      input: z.object({ customerId: z.string(), amountCents: z.number().int().positive() }),
      output: z.object({ id: z.string(), status: z.literal('draft') }),
      scopes: ['invoices:write'],
      rateLimit: { limit: 20, window: '1m' },
      handler: async ({ customerId, amountCents }, ctx) => {
        if (amountCents > 10_000_000) throw new ToolError('Invoices over $100,000 need manual approval.');
        return { id: `inv_${crypto.randomUUID()}`, status: 'draft' };
      },
    }),
  ],
});
```

Serve it wherever it needs to run:

```ts
// Node
import { listen } from 'mcp-starter-kit/node';
await listen(server, { port: 3000 });

// stdio, for Claude Desktop, Cursor, VS Code and Claude Code
import { serveStdio } from 'mcp-starter-kit/stdio';
await serveStdio(server);

// Cloudflare Workers, Bun, Deno, Vercel, Netlify
export default { fetch: server.fetch };
```

A fuller example with services, an LLM call and a confirmation step is in [`examples/notes`](examples/notes).

## Authentication

Every adapter returns the same `Principal`: `id`, `kind`, `email`, `name`, `orgId`, `scopes`, `plan`, `clientId` and the raw `claims`. Tools never see provider-specific shapes.

| Adapter | Use it for |
| --- | --- |
| `kinde`, `auth0`, `clerk`, `workos`, `okta`, `keycloak`, `entra`, `cognito`, `supabase`, `firebase`, `betterAuth` | Presets that know each provider's issuer, key set and claim layout |
| `oidc` / `jwtVerifier` | Any other OpenID Connect or OAuth 2.1 provider. The key set is discovered from the issuer |
| `introspection` | Opaque access tokens checked against an RFC 7662 endpoint, with caching |
| `apiKeys` | Server-to-server callers and agents. Keys are matched by SHA-256 digest, so you never store the raw key |
| `anyOf(a, b)` | Accept more than one, e.g. OAuth for people and API keys for automations |

Set the verifier's `audience` to your `publicUrl`. A token minted for a different API is then refused, which is the check most hand-rolled MCP servers skip.

Over HTTP the server publishes `/.well-known/oauth-protected-resource` and answers unauthenticated requests with a `WWW-Authenticate` header that points at it, so MCP clients can find your authorization server and run the OAuth flow on their own. Scopes listed on your tools are advertised there too.

Over stdio the credential comes from the environment (`MCP_ACCESS_TOKEN` or `MCP_API_KEY`) and is verified before the server starts. With no `auth` configured, a stdio server runs as a local principal holding every scope, since the process belongs to the user who launched it. HTTP refuses traffic until you configure `auth` or set `allowAnonymous: true`.

## Tools

```ts
defineTool({
  name: 'delete_project',
  description: 'Delete a project and everything in it.',
  input: z.object({ projectId: z.string() }),
  annotations: { destructiveHint: true },
  scopes: ['projects:admin'],
  confirm: ({ projectId }) => `Delete project ${projectId}? This cannot be undone.`,
  cost: 0,
  timeoutMs: 30_000,
  handler: async ({ projectId }, ctx) => { /* ... */ },
});
```

| Option | What it does |
| --- | --- |
| `input`, `output` | Zod (or any Standard Schema) schemas. Input is validated before your handler runs; output becomes `structuredContent` |
| `scopes` | Required OAuth scopes. Missing ones return a scope challenge so the client can ask the user for more access |
| `confirm` | Asks the user through elicitation before running. If the client cannot ask, the tool does not run |
| `rateLimit` | `{ limit, window, by }` where `by` is `principal`, `org` or `global` |
| `cost`, `feature` | Units charged to the caller's entitlements. Defaults to 1. A failed call is refunded |
| `timeoutMs` | Aborts the handler and returns a timeout result. `ctx.signal` aborts too |

Handlers return a plain value, a string, or a full `CallToolResult`. Throw `ToolError` for messages the model should see ("A note with that title already exists"). Any other error is logged with a reference id and the model gets a generic message, so stack traces and connection strings never leak.

The handler context:

| Field | |
| --- | --- |
| `ctx.principal` | Who is calling |
| `ctx.services` | Whatever your `services(principal)` factory returns: a tenant-scoped database client, an SDK, a repository. Built once per request, only when a tool runs |
| `ctx.llm` | The configured LLM client |
| `ctx.store` | The shared key-value store |
| `ctx.progress(n, total, message)` | Progress notifications for long work |
| `ctx.signal`, `ctx.log`, `ctx.requestId` | Cancellation, a structured logger bound to this call, and the reference id |

Use `createTool<Services>()` instead of `defineTool` to get `ctx.services` typed.

## Resources and prompts

Resources give the client read-only context it can load by URI. Prompts are templates users pick from the client's menu. Both get the same context, scopes and error handling as tools.

```ts
import { defineResourceTemplate, definePrompt } from 'mcp-starter-kit';

defineServer({
  resources: [
    defineResourceTemplate({
      name: 'invoice',
      uriTemplate: 'invoices://{id}',
      mimeType: 'application/json',
      scopes: ['invoices:read'],
      read: async ({ id }, ctx) => JSON.stringify(await ctx.services.invoices.get(id)),
    }),
  ],
  prompts: [
    definePrompt({
      name: 'chase_overdue',
      args: z.object({ customerId: z.string() }),
      render: ({ customerId }) => `List overdue invoices for ${customerId} and draft a polite reminder.`,
    }),
  ],
});
```

`defineResource` takes a fixed `uri`. Templates can add `list` so clients can browse what exists.

## Your database

The kit does not wrap your database. Create your client the way you already do (Drizzle, Prisma, Kysely, Mongoose, the Supabase or Convex client) and hand it to tools through `services`:

```ts
defineServer({
  services: (principal) => ({ db: drizzle(pool), tenantId: principal.orgId ?? principal.id }),
  // ...
});
```

The kit's own state (rate limits, quotas) lives in a small `Store`, and an adapter exists for whatever you already run:

| Adapter | Backends |
| --- | --- |
| `memoryStore()` | stdio servers, tests, single instances |
| `sqlStore({ dialect, query })` | Postgres (Neon, Supabase, RDS, Vercel), SQLite (libSQL, Turso, D1), MySQL (PlanetScale, RDS). You pass a `query` function from your existing client |
| `redisStore(client)` | ioredis or node-redis |
| `upstashStore({ url, token })` | Upstash over REST, for edge runtimes |
| `mongoStore(collection)` | MongoDB |

Counters are atomic in every adapter, so limits hold when you run more than one instance.

## Billing and entitlements

| Adapter | |
| --- | --- |
| `quota({ plans, planOf, by, upgradeUrl })` | Units per plan per day, month, custom window or lifetime. Per-feature limits. Pool usage per user or per org. The plan comes from a `plan` claim, your database, or a lookup you supply |
| `stripeMeter({ secretKey, eventName, customerId })` | Reports successful calls to a Stripe Billing Meter for usage-based pricing. The request id is the event identifier, so retries are not double-counted |
| `kindeBilling({ domain, meter })` | Kinde Billing. Checks the caller's plan through the Kinde Account API with their own token, enforces `entitlement_limit_max`, and with `meter` reports usage to the customer's agreement through the Management API |
| `autumn({ secretKey })` | Autumn. Checks the customer's balance for the feature before the call and tracks the units after it |
| `polar({ accessToken, eventName, gateOnMeterId })` | Polar usage billing. Ingests an event per successful call. With `gateOnMeterId`, blocks calls when the customer's meter balance is too low |
| `allOf(a, b)` | Combine them, e.g. gate with `quota` and bill with `stripeMeter` |

When a caller is over their limit the model receives the reason and your upgrade link, so it can tell the user what to do. Write your own adapter by implementing `reserve` and `settle`.

## LLM calls inside tools

The `2026-07-28` spec deprecates sampling and recommends calling model providers directly. `ctx.llm` is one OpenAI-compatible client with presets for the common routers:

```ts
import { openrouter } from 'mcp-starter-kit/llm';

defineServer({
  llm: openrouter({
    apiKey: process.env.OPENROUTER_API_KEY!,
    defaultModel: 'anthropic/claude-haiku-4.5',
    onUsage: ({ model, inputTokens, outputTokens, costUsd }) => { /* record spend */ },
  }),
});
```

Presets: `openrouter`, `vercelGateway`, `cloudflareGateway`, `portkey`, `litellm`, `openai`, `anthropic`, `ollama`, plus `openAICompatible` for anything else. `onUsage` reports tokens and, where the router returns it, cost, so you can track LLM spend per user and per tool.

## Running behind a gateway

The HTTP handler follows the stateless `2026-07-28` model: no sessions and no sticky routing, so any instance can answer any request. That means it works behind MCP gateways (agentgateway, ContextForge, Docker MCP Gateway) and ordinary load balancers without extra setup. For browser-based clients, list their origins in `http.corsOrigins`. On a public domain, set `http.allowedHosts`.

## Observability

Logs are JSON lines on stderr, never stdout, so they cannot corrupt the stdio stream.

For traces and metrics, pass `telemetry: openTelemetry()` from `mcp-starter-kit/otel`. Every tool call, resource read and prompt render becomes a span named with the MCP semantic conventions (`tools/call create_invoice`), with the outcome, units charged and tenant as attributes, plus an `mcp.server.operation.duration` histogram. When the client sends a `traceparent` in `_meta`, the span joins the client's trace, so one trace covers the agent, the tool and anything the tool calls. Register whichever OpenTelemetry SDK and exporter you already use; `@opentelemetry/api` is the only dependency.

`hooks.onToolStart`, `onToolEnd` and `onToolError` give you one place to send audit events wherever you keep them.

## Testing

```bash
npm test
```

The suite runs the server end to end with the official MCP client over HTTP, Node and stdio, in both protocol eras. Store adapters run against real SQLite and Postgres (through PGlite). The generator is checked across every valid combination of choices, including that each project's `.env.example` lists every variable its code reads. CI also generates seven real projects that between them cover every runtime, database and billing option, installs them against the packed kit, and runs their typecheck and tests.

## Migrating from 1.x

1.x scaffolded a project with a Kinde login page, a copy-your-token step and generated CRUD tools. 2.x replaces all of it, and `npx mcp-starter-kit` now generates a v2 project:

- The login page and `save_token` tool are gone. MCP clients now run OAuth themselves using the metadata the server publishes. Use the `kinde` adapter with your domain.
- The Neon-specific database layer is gone. Use your own client through `services`, and `sqlStore` with your Neon pool for quotas.
- Free-tier counting moves to `quota`.

1.x had a token verification flaw: it decoded tokens without checking their signature. If you deployed it, rotate anything those servers could reach and move to 2.x.

## License

MIT
