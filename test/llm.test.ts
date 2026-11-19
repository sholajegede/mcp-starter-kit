import { describe, expect, it } from 'vitest';
import { noLlm, openrouter, portkey } from '../src/llm/index.js';

describe('llm routers', () => {
  it('calls OpenRouter with the OpenAI-compatible shape and reports usage', async () => {
    const usage: unknown[] = [];
    let sent: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | undefined;
    const llm = openrouter({
      apiKey: 'or_key',
      defaultModel: 'anthropic/claude-sonnet-4.5',
      appName: 'notes-mcp',
      onUsage: (u) => usage.push(u),
      fetch: (async (url: string, init: RequestInit) => {
        sent = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
        return Response.json({ model: 'anthropic/claude-sonnet-4.5', choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.0001 } });
      }) as never,
    });
    const res = await llm.chat({ messages: [{ role: 'user', content: 'hello' }], json: true, extra: { models: ['openai/gpt-5-mini'] } });
    expect(res.text).toBe('hi');
    expect(sent!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(sent!.headers.authorization).toBe('Bearer or_key');
    expect(sent!.headers['X-Title']).toBe('notes-mcp');
    expect(sent!.body).toMatchObject({ model: 'anthropic/claude-sonnet-4.5', response_format: { type: 'json_object' }, models: ['openai/gpt-5-mini'] });
    expect(usage).toEqual([{ inputTokens: 10, outputTokens: 2, costUsd: 0.0001, model: 'anthropic/claude-sonnet-4.5', provider: 'openrouter' }]);
  });

  it('sends Portkey headers', async () => {
    let headers: Record<string, string> = {};
    const llm = portkey({
      apiKey: 'pk',
      virtualKey: 'vk',
      defaultModel: 'gpt-5-mini',
      fetch: (async (_: string, init: RequestInit) => {
        headers = init.headers as Record<string, string>;
        return Response.json({ choices: [{ message: { content: '' } }] });
      }) as never,
    });
    await llm.chat({ messages: [{ role: 'user', content: 'x' }] });
    expect(headers).toMatchObject({ 'x-portkey-api-key': 'pk', 'x-portkey-virtual-key': 'vk' });
  });

  it('surfaces router errors', async () => {
    const llm = openrouter({ apiKey: 'k', defaultModel: 'm', fetch: (async () => new Response('quota exceeded', { status: 429 })) as never });
    await expect(llm.chat({ messages: [] })).rejects.toThrow('openrouter returned 429: quota exceeded');
  });

  it('explains how to configure a model when none is set', async () => {
    await expect(noLlm().chat({ messages: [] })).rejects.toThrow(/Pass `llm` to defineServer/);
  });
});
