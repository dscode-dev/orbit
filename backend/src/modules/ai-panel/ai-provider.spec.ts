import { OpenAiCompatibleProvider } from './ai-provider';

describe('OpenAiCompatibleProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps an OpenAI-compatible response without exposing credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'provider-request',
        model: 'orbit-model',
        choices: [
          {
            message: { content: 'analysis result' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    }) as never;
    const provider = new OpenAiCompatibleProvider();
    const result = await provider.execute({
      model: 'orbit-model',
      systemPrompt: 'system',
      userPrompt: 'prompt',
      context: {},
      configuration: {},
      integrationConfiguration: { baseUrl: 'https://ai.example.test/v1' },
      secrets: { apiKey: 'secret-key' },
    });
    expect(result.providerRequestId).toBe('provider-request');
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
    expect(result.output.content).toBe('analysis result');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ai.example.test/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
