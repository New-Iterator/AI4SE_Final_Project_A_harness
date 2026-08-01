import { validateFeedback } from '../src/core/feedback';
import type { ToolResult } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('=== 反馈演示 ===');

const failResult: ToolResult = {
  tool: 'run_test',
  stdout: `FAIL  src/calc.test.ts
  x multiply(2, 3) should return 6
    Expected: 6
    Received: 5
Tests: 1 failed, 1 total`,
  stderr: '',
  exitCode: 1,
  success: false,
};

const fb = validateFeedback(failResult);
assert(fb.verdict === 'fail', 'verdict is fail');
assert(fb.shouldStop === false, 'shouldStop is false');
assert(fb.failures !== undefined, 'failures array exists');
assert(fb.failures!.length > 0, 'failures array is non-empty');
assert(fb.failures![0].testName.includes('multiply'), 'test name is parsed');

const passResult: ToolResult = {
  tool: 'run_test', stdout: '3 passed, 0 failed', stderr: '', exitCode: 0, success: true,
};
const fb2 = validateFeedback(passResult);
assert(fb2.verdict === 'pass', 'verdict is pass');
assert(fb2.shouldStop === true, 'shouldStop is true');

const neutralResult: ToolResult = {
  tool: 'write_file', stdout: 'ok', stderr: '', exitCode: 0, success: true,
};
const fb3 = validateFeedback(neutralResult);
assert(fb3.verdict === 'neutral', 'verdict is neutral');
assert(fb3.shouldStop === false, 'shouldStop is false for neutral');

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);