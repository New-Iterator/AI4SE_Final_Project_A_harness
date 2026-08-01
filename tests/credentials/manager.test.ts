import { describe, it, expect } from 'vitest';
import { CredentialManager } from '../../src/credentials/manager';

describe('CredentialManager', () => {
  it('should store and retrieve keys in memory', async () => {
    const cm = new CredentialManager();
    await cm.set('openai', 'sk-test-123');
    expect(await cm.get('openai')).toBe('sk-test-123');
  });

  it('should return null for missing key', async () => {
    const cm = new CredentialManager();
    expect(await cm.get('unknown')).toBeNull();
  });

  it('should delete keys', async () => {
    const cm = new CredentialManager();
    await cm.set('openai', 'sk-test');
    await cm.delete('openai');
    expect(await cm.get('openai')).toBeNull();
  });

  it('should report status without exposing keys', async () => {
    const cm = new CredentialManager();
    await cm.set('openai', 'sk-test');
    const status = await cm.status();
    expect(status['openai']).toBe('configured');
    expect(status['anthropic']).toBe('not configured');
    expect(JSON.stringify(status)).not.toContain('sk-test');
  });
});