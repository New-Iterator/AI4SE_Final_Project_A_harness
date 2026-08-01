import { describe, it, expect } from 'vitest';
import { MockLLMProvider } from '../../src/core/llm/mock';
import type { ChatRequest } from '../../src/core/llm/types';

const TOOLS = [{ type: 'function' as const, function: { name: 'read_file', description: 'Read', parameters: {} } }];

function req(content: string): ChatRequest {
  return { messages: [{ role: 'user', content }], tools: TOOLS };
}

describe('MockLLMProvider', () => {
  it('should return scripted responses in order', async () => {
    const mock = new MockLLMProvider('script', [
      { inputContains: 'hello', response: { content: 'Hi!', toolCalls: [], finishReason: 'stop' as const } },
      { inputContains: 'test', response: { content: 'Testing', toolCalls: [], finishReason: 'stop' as const } },
    ]);
    expect((await mock.chat(req('hello world'))).content).toBe('Hi!');
    expect((await mock.chat(req('run test'))).content).toBe('Testing');
  });

  it('should return tool_call responses', async () => {
    const mock = new MockLLMProvider('script', [{
      inputContains: 'write',
      response: {
        content: null,
        toolCalls: [{ id: 'call_1', type: 'function' as const, function: { name: 'write_file', arguments: '{"path":"test.ts","content":"code"}' } }],
        finishReason: 'tool_calls' as const,
      },
    }]);
    const r = await mock.chat(req('write a file'));
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].function.name).toBe('write_file');
  });

  it('should throw when script exhausted', async () => {
    const mock = new MockLLMProvider('script', []);
    await expect(mock.chat(req('hello'))).rejects.toThrow('Mock script exhausted');
  });

  it('should support replay mode', async () => {
    const recorded = [
      { content: 'First', toolCalls: [], finishReason: 'stop' as const },
      { content: 'Second', toolCalls: [], finishReason: 'stop' as const },
    ];
    const mock = new MockLLMProvider('replay', recorded);
    expect((await mock.chat(req('any'))).content).toBe('First');
    expect((await mock.chat(req('any'))).content).toBe('Second');
  });

  it('should throw when no script entry matches', async () => {
    const mock = new MockLLMProvider('script', [
      { inputContains: 'nomatch', response: { content: 'x', toolCalls: [], finishReason: 'stop' as const } },
    ]);
    await expect(mock.chat(req('something else'))).rejects.toThrow('No mock script entry matches');
  });

  it('supportsToolCalling should return true', () => {
    expect(new MockLLMProvider('script', []).supportsToolCalling()).toBe(true);
  });
});