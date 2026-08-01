import { describe, it, expect } from 'vitest';
import { runLoop } from '../../src/core/loop';
import { MockLLMProvider } from '../../src/core/llm/mock';
import { ToolRegistry } from '../../src/tools/registry';
import type { Config } from '../../src/config/types';
import type { Tool } from '../../src/tools/types';
import type { ToolResult } from '../../src/types';

class FakeWriteFileTool implements Tool {
  definition = { type: 'function' as const, function: { name: 'write_file', description: 'Write file', parameters: { type: 'object', properties: { filePath: { type: 'string' }, content: { type: 'string' } }, required: ['filePath', 'content'] } } };
  async execute(): Promise<ToolResult> { return { tool: 'write_file', stdout: 'ok', stderr: '', exitCode: 0, success: true }; }
}

class FakeRunTestTool implements Tool {
  definition = { type: 'function' as const, function: { name: 'run_test', description: 'Run tests', parameters: { type: 'object', properties: {} } } };
  async execute(): Promise<ToolResult> { return { tool: 'run_test', stdout: '3 passed, 0 failed', stderr: '', exitCode: 0, success: true }; }
}

const config: Config = {
  llm: { provider: 'mock', model: 'mock', maxTokens: 4096, temperature: 0.1 },
  loop: { maxIterations: 10, maxContextTokens: 128000, maxConsecutiveFailures: 3 },
  tools: { workspaceRoot: '/tmp/test', allowedCommands: [], blockedPatterns: [] },
  memory: { sessionDbPath: ':memory:', projectDbPath: ':memory:', workingMemoryRounds: 10, sessionMemoryExpireDays: 30, retrievalTopK: 5 },
};

describe('runLoop', () => {
  it('should complete a simple task with mock LLM', async () => {
    const mock = new MockLLMProvider('script', [
      {
        inputContains: 'run test',
        response: { content: null, toolCalls: [{ id: 'c1', type: 'function' as const, function: { name: 'write_file', arguments: '{"filePath":"test.ts","content":"code"}' } }], finishReason: 'tool_calls' as const },
      },
      {
        inputContains: 'write_file',
        response: { content: null, toolCalls: [{ id: 'c2', type: 'function' as const, function: { name: 'run_test', arguments: '{}' } }], finishReason: 'tool_calls' as const },
      },
      {
        inputContains: 'Executed',
        response: { content: 'All tests pass!', toolCalls: [], finishReason: 'stop' as const },
      },
    ]);
    const registry = new ToolRegistry();
    registry.register(new FakeWriteFileTool());
    registry.register(new FakeRunTestTool());
    const result = await runLoop('run test', config, mock, registry);
    expect(result.success).toBe(true);
    expect(result.iterations).toBeGreaterThanOrEqual(2);
  });

  it('should stop after max iterations', async () => {
    const mock = new MockLLMProvider('script', Array.from({ length: 15 }, (_, i) => ({
      inputContains: '',
      response: { content: null, toolCalls: [{ id: 'c1', type: 'function' as const, function: { name: 'noop', arguments: '{}' } }], finishReason: 'tool_calls' as const },
    })));
    const registry = new ToolRegistry();
    const result = await runLoop('task', config, mock, registry);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('max_iterations');
  });
});