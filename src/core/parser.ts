import type { Action } from '../types';
import type { ChatResponse } from './llm/types';

export interface ParseResult {
  action: Action;
  warnings?: string[];
}

export function parseAction(response: ChatResponse): Action {
  const result = parseActionWithWarnings(response);
  return result.action;
}

export function parseActionWithWarnings(response: ChatResponse): ParseResult {
  const warnings: string[] = [];

  if (response.toolCalls.length > 0) {
    if (response.toolCalls.length > 1) {
      warnings.push('仅执行了第一个工具调用，其余已忽略，请逐一调用工具');
    }
    const tc = response.toolCalls[0];
    try {
      const args = JSON.parse(tc.function.arguments);
      return { action: { type: 'tool_call', tool: tc.function.name, args }, warnings };
    } catch {
      return { action: { type: 'invalid', reason: 'Failed to parse tool call arguments' }, warnings };
    }
  }

  const content = response.content || '';
  const trimmed = content.trim();

  if (!trimmed) {
    return { action: { type: 'invalid', reason: 'Empty response' }, warnings };
  }

  const jsonMatch = trimmed.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (parsed.tool) {
        return { action: { type: 'tool_call', tool: parsed.tool, args: parsed.args || {} }, warnings };
      }
    } catch { /* fall through to next rule */ }
  }

  if (/^(STOP|DONE)$/im.test(trimmed)) {
    return { action: { type: 'stop', reason: trimmed }, warnings };
  }

  const funcMatch = trimmed.match(/^(\w+)\(([\s\S]*)\)$/);
  if (funcMatch) {
    const toolName = funcMatch[1];
    const argsStr = funcMatch[2].trim();
    try {
      const args = JSON.parse(argsStr);
      return { action: { type: 'tool_call', tool: toolName, args }, warnings };
    } catch {
      return { action: { type: 'tool_call', tool: toolName, args: { content: argsStr } }, warnings };
    }
  }

  return { action: { type: 'invalid', reason: trimmed }, warnings };
}