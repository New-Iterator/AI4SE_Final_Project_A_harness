import { describe, it, expect } from 'vitest';
import { validateFeedback } from '../../src/core/feedback';
import type { ToolResult } from '../../src/types';

describe('validateFeedback', () => {
  it('should return pass for all tests passing', () => {
    const result: ToolResult = { tool: 'run_test', stdout: '3 passed, 0 failed', stderr: '', exitCode: 0, success: true };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('pass');
    expect(fb.shouldStop).toBe(true);
  });

  it('should return fail for failed tests', () => {
    const result: ToolResult = { tool: 'run_test', stdout: '1 passed, 2 failed', stderr: '', exitCode: 1, success: false };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('fail');
    expect(fb.shouldStop).toBe(false);
  });

  it('should return neutral for non-test tools', () => {
    const result: ToolResult = { tool: 'write_file', stdout: 'ok', stderr: '', exitCode: 0, success: true };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('neutral');
    expect(fb.shouldStop).toBe(false);
  });

  it('should parse Jest output', () => {
    const stdout = `PASS  src/test.ts
  + add(1, 2) should return 3
FAIL  src/calc.test.ts
  x multiply(2, 3) should return 6
    Expected: 6, Received: 5
Tests: 1 passed, 1 failed, 2 total`;
    const result: ToolResult = { tool: 'run_test', stdout, stderr: '', exitCode: 1, success: false };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('fail');
    expect(fb.failures).toBeDefined();
    expect(fb.failures!.length).toBeGreaterThan(0);
  });

  it('should parse Mocha output', () => {
    const stdout = `  passing (2)
  failing (1)
  1) Calculator should multiply correctly:
     Error: expected 5 to equal 6`;
    const result: ToolResult = { tool: 'run_test', stdout, stderr: '', exitCode: 1, success: false };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('fail');
  });

  it('should return neutral for empty stdout', () => {
    const result: ToolResult = { tool: 'run_test', stdout: '', stderr: '', exitCode: 0, success: true };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('neutral');
  });
});