# Changelog

## 2.0.0 (2026-11-19)

A rewrite. 2.0 is a production foundation for MCP servers on the official MCP TypeScript SDK v2 and spec revision `2026-07-28`, with 2025-era clients still served.

### Added

- `defineServer` and `defineTool`, with typed input and output schemas, structured results, tool annotations, and errors that never leak internals to the model.
- Token verification that checks signature, issuer, audience and expiry, with presets for Kinde, Auth0, Clerk, WorkOS, Okta, Keycloak, Entra ID, Cognito, Supabase, Firebase and Better Auth, plus any OpenID Connect provider, RFC 7662 introspection for opaque tokens, hashed API keys, and `anyOf` to accept several.
- OAuth protected resource metadata and `WWW-Authenticate` challenges, so MCP clients find the authorization server on their own.
- Per-tool scopes with step-up challenges, rate limits, user confirmation for destructive tools, timeouts and cancellation.
- Entitlements: plan quotas, Stripe meters, Kinde Billing, Autumn and Polar, combinable with `allOf`. Failed calls are refunded.
- Stores for rate limits and quotas: memory, Postgres, SQLite, MySQL, Redis, Upstash and MongoDB.
- `ctx.llm`, an OpenAI-compatible client with presets for OpenRouter, Vercel AI Gateway, Cloudflare AI Gateway, Portkey, LiteLLM, OpenAI, Anthropic and Ollama, reporting token usage and cost.
- Resources, resource templates and prompts with the same scopes and context as tools.
- OpenTelemetry spans and metrics with the MCP semantic conventions, continuing the client's trace from `traceparent`.
- Runtimes: a web-standard `fetch` handler for Cloudflare Workers, Vercel, Bun and Deno, a Node HTTP server, and stdio.
- `npx mcp-starter-kit`, which generates a project for any combination of runtime, auth provider, database, billing and LLM router, and `npx mcp-starter-kit add tool <name>`.

### Removed

- The 1.x Kinde login page, `save_token` tool, Neon-only database layer and generated CRUD templates. See "Migrating from 1.x" in the README.

### Security

- 1.x decoded access tokens without verifying their signature. 2.0 verifies every token. Anyone who deployed 1.x should rotate credentials those servers could reach and upgrade.

## 1.4.9 (2025-10-11)

Last 1.x release. Deprecated.
