import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

describe('CLI', () => {
  it('should have build output', () => {
    expect(existsSync('dist/src/index.js')).toBe(true);
  });

  it('should export harness CLI program', () => {
    const content = readFileSync('dist/src/index.js', 'utf-8');
    expect(content).toContain('harness');
    expect(content).toContain('run');
    expect(content).toContain('key');
    expect(content).toContain('web');
  });
});