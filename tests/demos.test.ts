import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Mechanism Demos', () => {
  it('should run guard demo successfully', () => {
    const output = execSync('npx tsx demos/guard-demo.ts', { encoding: 'utf-8' });
    expect(output).toContain('通过');
    expect(output).toContain('护栏');
  }, 15000);

  it('should run feedback demo successfully', () => {
    const output = execSync('npx tsx demos/feedback-demo.ts', { encoding: 'utf-8' });
    expect(output).toContain('通过');
    expect(output).toContain('反馈');
  }, 15000);

  it('should run memory demo successfully', () => {
    const output = execSync('npx tsx demos/memory-demo.ts', { encoding: 'utf-8' });
    expect(output).toContain('通过');
    expect(output).toContain('记忆');
  }, 15000);
});