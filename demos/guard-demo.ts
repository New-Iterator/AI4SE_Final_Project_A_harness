import { checkGuard } from '../src/core/guard';
import type { Action } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('=== 护栏演示 ===');

const dangerousAction: Action = { type: 'tool_call', tool: 'shell', args: { command: 'rm -rf /' } };
const result = checkGuard(dangerousAction, '/workspace');
assert(result.requiresApproval === true, 'rm -rf / requires approval');
assert(result.blocked === false, 'rm -rf / is not blocked');
assert(result.reason?.includes('rm -rf') ?? false, 'reason mentions rm -rf');

const safeAction: Action = { type: 'tool_call', tool: 'shell', args: { command: 'npm test' } };
const result2 = checkGuard(safeAction, '/workspace');
assert(result2.requiresApproval === false, 'npm test does not require approval');
assert(result2.blocked === false, 'npm test is not blocked');

const outsideWrite: Action = { type: 'tool_call', tool: 'write_file', args: { filePath: '/etc/passwd' } };
const result3 = checkGuard(outsideWrite, '/workspace');
assert(result3.blocked === true, 'write outside workspace is blocked');

const insideWrite: Action = { type: 'tool_call', tool: 'write_file', args: { filePath: '/workspace/test.ts' } };
const result4 = checkGuard(insideWrite, '/workspace');
assert(result4.blocked === false, 'write inside workspace is allowed');

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);