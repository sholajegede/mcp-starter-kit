import { ConfigError } from '../errors.js';
import type { ChatRequest, ChatResponse, ChatUsage, LlmClient } from './types.js';

export type { ChatMessage, ChatRequest, ChatResponse, ChatUsage, LlmClient } from './types.js';

export interface OpenAICompatibleOptions {
  baseURL: string;
  apiKey?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
  provider?: string;
  /** Called after every completion. Use it to track spend per user or tool. */
  onUsage?: (usage: ChatUsage & { model: string; provider: string }) => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * One client for every OpenAI-compatible endpoint: model routers (OpenRouter,
 * Vercel AI Gateway, LiteLLM, Portkey, Cloudflare AI Gateway) and providers
 * that speak the same API. Tools call it through `ctx.llm`, which replaces
 * MCP sampling (deprecated in the 2026-07-28 spec).
 */
export function openAICompatible(options: OpenAICompatibleOptions): LlmClient {
  const base = options.baseURL.replace(/\/$/, '');
  const doFetch = options.fetch ?? fetch;
  const provider = options.provider ?? 'openai-compatible';

  return {
    provider,
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const model = request.model ?? options.defaultModel;
      if (!model) throw new ConfigError(`${provider}: no model given and no defaultModel configured`);

      const body: Record<string, unknown> = { model, messages: request.messages, ...request.extra };
      if (request.temperature !== undefined) body.temperature = request.temperature;
      if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
      if (request.json === true) body.response_format = { type: 'json_object' };
      else if (request.json) body.response_format = { type: 'json_schema', json_schema: { name: request.json.name, schema: request.json.schema, strict: true } };

      const timeout = AbortSignal.timeout(options.timeoutMs ?? 120_000);
      const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
      const res = await doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
          ...options.headers,
        },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) throw new Error(`${provider} returned ${res.status}: ${(await res.text()).slice(0, 500)}`);
      const raw = (await res.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      };
      const usage: ChatUsage = {
        inputTokens: raw.usage?.prompt_tokens ?? 0,
        outputTokens: raw.usage?.completion_tokens ?? 0,
        ...(typeof raw.usage?.cost === 'number' ? { costUsd: raw.usage.cost } : {}),
      };
      const answeredModel = raw.model ?? model;
      options.onUsage?.({ ...usage, model: answeredModel, provider });
      return { text: raw.choices?.[0]?.message?.content ?? '', model: answeredModel, usage, raw };
    },
  };
}

type Preset = Omit<OpenAICompatibleOptions, 'baseURL' | 'provider'> & { apiKey: string };

export const openrouter = (o: Preset & { appName?: string; appUrl?: string }) =>
  openAICompatible({
    ...o,
    baseURL: 'https://openrouter.ai/api/v1',
    provider: 'openrouter',
    headers: { ...(o.appUrl ? { 'HTTP-Referer': o.appUrl } : {}), ...(o.appName ? { 'X-Title': o.appName } : {}), ...o.headers },
  });

export const vercelGateway = (o: Preset) => openAICompatible({ ...o, baseURL: 'https://ai-gateway.vercel.sh/v1', provider: 'vercel-ai-gateway' });

export const cloudflareGateway = (o: Preset & { accountId: string; gatewayId: string }) =>
  openAICompatible({ ...o, baseURL: `https://gateway.ai.cloudflare.com/v1/${o.accountId}/${o.gatewayId}/compat`, provider: 'cloudflare-ai-gateway' });

export const portkey = (o: Preset & { virtualKey?: string }) =>
  openAICompatible({
    ...o,
    baseURL: 'https://api.portkey.ai/v1',
    provider: 'portkey',
    headers: { 'x-portkey-api-key': o.apiKey, ...(o.virtualKey ? { 'x-portkey-virtual-key': o.virtualKey } : {}), ...o.headers },
  });

export const litellm = (o: Omit<OpenAICompatibleOptions, 'provider'>) => openAICompatible({ ...o, provider: 'litellm' });

export const openai = (o: Preset) => openAICompatible({ ...o, baseURL: 'https://api.openai.com/v1', provider: 'openai' });

export const anthropic = (o: Preset) => openAICompatible({ ...o, baseURL: 'https://api.anthropic.com/v1', provider: 'anthropic' });

export const ollama = (o: Omit<OpenAICompatibleOptions, 'provider' | 'baseURL'> & { baseURL?: string } = {}) =>
  openAICompatible({ ...o, baseURL: o.baseURL ?? 'http://127.0.0.1:11434/v1', provider: 'ollama' });

/** Placeholder used when no LLM is configured. Calling it explains what to set up. */
export function noLlm(): LlmClient {
  return {
    provider: 'none',
    async chat() {
      throw new ConfigError('No LLM configured. Pass `llm` to defineServer, e.g. llm: openrouter({ apiKey, defaultModel }).');
    },
  };
}
