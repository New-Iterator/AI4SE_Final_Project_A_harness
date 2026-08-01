import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Shell tool', () => {
  it('should execute a simple command', () => {
    const result = execSync('echo hello', { encoding: 'utf-8' }).trim();
    expect(result).toBe('hello');
  });
});