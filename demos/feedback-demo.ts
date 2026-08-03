import { runLoop } from '../src/core/loop';
import { MockLLMProvider } from '../src/core/llm/mock';
import { ToolRegistry } from '../src/tools/registry';
import { writeFileTool } from '../src/tools/write-file';
import { shellTool } from '../src/tools/shell';
import type { Config } from '../src/config/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

async function main() {
  console.log('=== 反馈闭环演示（mock LLM 完整 3 轮循环）===');

  const mock = new MockLLMProvider('script', [
    { inputContains: '反馈闭环演示', response: { content: null, toolCalls: [{ id: 'c1', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ filePath: 'demo_test.ts', content: 'export function add(a:number,b:number){return a-b}' }) } }], finishReason: 'tool_calls' } },
    { inputContains: '反馈闭环演示', response: { content: null, toolCalls: [{ id: 'c2', type: 'function', function: { name: 'shell', arguments: JSON.stringify({ command: 'echo [ERROR] Expected:6 Received:5' }) } }], finishReason: 'tool_calls' } },
    { inputContains: 'Expected:6', response: { content: null, toolCalls: [{ id: 'c3', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ filePath: 'demo_test.ts', content: 'export function add(a:number,b:number){return a+b}' }) } }], finishReason: 'tool_calls' } },
    { inputContains: '反馈闭环演示', response: { content: 'STOP', toolCalls: [], finishReason: 'stop' } },
  ]);

  const registry = new ToolRegistry();
  registry.register(writeFileTool);
  registry.register(shellTool);

  const config: Config = {
    llm: { provider: 'mock', model: 'mock', maxTokens: 4096, temperature: 0.1 },
    loop: { maxIterations: 10, maxContextTokens: 128000, maxConsecutiveFailures: 3 },
    tools: { workspaceRoot: process.cwd(), allowedCommands: [], blockedPatterns: [] },
    memory: { sessionDbPath: '.harness/session.db', projectDbPath: '.harness/project.db', workingMemoryRounds: 10, sessionMemoryExpireDays: 30, retrievalTopK: 5 },
  };

  const result = await runLoop('反馈闭环演示', config, mock, registry);

  assert(result.success === true, '反馈闭环最终成功');
  assert(result.iterations >= 3, `至少执行了 3 轮（实际 ${result.iterations} 轮）`);

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });