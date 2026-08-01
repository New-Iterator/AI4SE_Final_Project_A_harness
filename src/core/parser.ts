import type { Action } from '../types';
import type { ChatResponse } from './llm/types';

export function parseAction(response: ChatResponse): Action {
  if (response.toolCalls.length > 0) {
    const tc = response.toolCalls[0];
    try {
      const args = JSON.parse(tc.function.arguments);
      return { type: 'tool_call', tool: tc.function.name, args };
    } catch {
      return { type: 'invalid', reason: 'Failed to parse tool call arguments' };
    }
  }

  if (response.content && response.content.trim().length > 0) {
    return { type: 'stop', reason: response.content };
  }

  return { type: 'invalid', reason: 'Empty response' };
}