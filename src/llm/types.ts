export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Model id in the router's naming, e.g. `anthropic/claude-sonnet-4.5` on OpenRouter. Falls back to the client default. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask for JSON back. Pass a JSON Schema to request structured output where the router supports it. */
  json?: boolean | { name: string; schema: Record<string, unknown> };
  /** Router-specific fields merged into the request body (provider routing, fallbacks, caching). */
  extra?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  /** Cost in USD when the router reports it. */
  costUsd?: number;
}

export interface ChatResponse {
  text: string;
  model: string;
  usage: ChatUsage;
  raw: unknown;
}

export interface LlmClient {
  readonly provider: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}
