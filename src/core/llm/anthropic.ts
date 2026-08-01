import type { LLMProvider, ChatRequest, ChatResponse } from './types';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    if (!apiKey) throw new Error('Anthropic API key is required');
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const systemMsg = request.messages.find(m => m.role === 'system');
    const messages = request.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content || '' }));

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens || 4096,
      messages,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      ...(request.tools.length > 0 ? { tools: request.tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })) } : {}),
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>; stop_reason: string };
    const textContent = data.content.find(c => c.type === 'text');
    const toolUses = data.content.filter(c => c.type === 'tool_use');
    return {
      content: textContent?.text || null,
      toolCalls: toolUses.map(tu => ({ id: tu.id || '', type: 'function' as const, function: { name: tu.name || '', arguments: JSON.stringify(tu.input || {}) } })),
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : data.stop_reason === 'max_tokens' ? 'length' : 'stop',
    };
  }

  supportsToolCalling(): boolean { return true; }
}