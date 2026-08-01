import { describe, it, expect } from 'vitest';
import { CredentialManager } from '../../src/credentials/manager';

describe('CredentialManager', () => {
  it('should store and retrieve keys in memory', () => {
    const cm = new CredentialManager();
    cm.set('openai', 'sk-test-123');
    expect(cm.has('openai')).toBe(true);
    expect(cm.get('openai')).toBe('sk-test-123');
  });

  it('should return null for missing key', () => {
    const cm = new CredentialManager();
    expect(cm.get('unknown')).toBeNull();
  });

  it('should delete keys', () => {
    const cm = new CredentialManager();
    cm.set('openai', 'sk-test');
    cm.delete('openai');
    expect(cm.has('openai')).toBe(false);
  });

  it('should report status without exposing keys', () => {
    const cm = new CredentialManager();
    cm.set('openai', 'sk-test');
    const status = cm.status();
    expect(status['openai']).toBe('configured');
    expect(status['anthropic']).toBe('not configured');
    expect(JSON.stringify(status)).not.toContain('sk-test');
  });
});