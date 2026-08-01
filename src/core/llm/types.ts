import type { Message, ToolCall } from '../../types';

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatRequest {
  messages: Message[];
  tools: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface LLMProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  supportsToolCalling(): boolean;
}