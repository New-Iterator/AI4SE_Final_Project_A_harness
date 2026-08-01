import type { LLMProvider, ChatRequest, ChatResponse } from './types';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = 'gpt-4o', baseUrl?: string) {
    if (!apiKey) throw new Error('OpenAI API key is required');
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl || 'https://api.openai.com/v1';
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = {
      model: this.model,
      messages: request.messages.map(m => ({
        role: m.role, content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.name ? { name: m.name } : {}),
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      })),
      tools: request.tools.length > 0 ? request.tools : undefined,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }; finish_reason: string }> };
    const choice = data.choices[0];
    return {
      content: choice.message.content || null,
      toolCalls: choice.message.tool_calls?.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.function.name, arguments: tc.function.arguments } })) || [],
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason === 'length' ? 'length' : 'stop',
    };
  }

  supportsToolCalling(): boolean { return true; }
}