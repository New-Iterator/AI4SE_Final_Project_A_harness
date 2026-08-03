import { describe, it, expect } from 'vitest';
import { parseAction } from '../../src/core/parser';
import type { ChatResponse } from '../../src/core/llm/types';

describe('parseAction', () => {
  it('should parse tool_call response', () => {
    const response: ChatResponse = {
      content: null,
      toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'write_file', arguments: '{"path":"test.ts","content":"hello"}' } }],
      finishReason: 'tool_calls',
    };
    const action = parseAction(response);
    expect(action.type).toBe('tool_call');
    expect(action.tool).toBe('write_file');
    expect(action.args).toEqual({ path: 'test.ts', content: 'hello' });
  });

  it('should parse stop response with DONE keyword', () => {
    const response: ChatResponse = { content: 'DONE', toolCalls: [], finishReason: 'stop' };
    const action = parseAction(response);
    expect(action.type).toBe('stop');
    expect(action.reason).toBe('DONE');
  });

  it('should return invalid for empty response', () => {
    const response: ChatResponse = { content: null, toolCalls: [], finishReason: 'stop' };
    const action = parseAction(response);
    expect(action.type).toBe('invalid');
  });

  it('should handle malformed JSON in tool call arguments', () => {
    const response: ChatResponse = {
      content: null,
      toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'write_file', arguments: 'not json' } }],
      finishReason: 'tool_calls',
    };
    const action = parseAction(response);
    expect(action.type).toBe('invalid');
  });

  it('should parse the first tool call when multiple', () => {
    const response: ChatResponse = {
      content: null,
      toolCalls: [
        { id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } },
        { id: 'call_2', type: 'function', function: { name: 'write_file', arguments: '{"path":"b.ts","content":"x"}' } },
      ],
      finishReason: 'tool_calls',
    };
    const action = parseAction(response);
    expect(action.type).toBe('tool_call');
    expect(action.tool).toBe('read_file');
  });
});