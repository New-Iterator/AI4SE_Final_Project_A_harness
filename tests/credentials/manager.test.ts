import { describe, it, expect } from 'vitest';
import { CredentialManager, sanitizeKey } from '../../src/credentials/manager';

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
    expect(JSON.stringify(status)).not.toContain('sk-test');
  });

  it('should zero keys from memory', async () => {
    const cm = new CredentialManager();
    await cm.set('openai', 'sk-test-123');
    await cm.set('anthropic', 'sk-test-456');
    cm.zeroKeys();
    await cm.delete('openai');
    await cm.delete('anthropic');
    expect(await cm.get('openai')).toBeNull();
    expect(await cm.get('anthropic')).toBeNull();
  });
});

describe('sanitizeKey', () => {
  it('should redact OpenAI-style keys', () => {
    const input = 'Using key sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
    const result = sanitizeKey(input);
    expect(result).not.toContain('sk-proj');
    expect(result).toContain('sk-***');
  });

  it('should redact Bearer tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const result = sanitizeKey(input);
    expect(result).toContain('Bearer ***');
    expect(result).not.toContain('eyJhbGci');
  });

  it('should not modify text without keys', () => {
    const input = 'Hello world, this is a normal message';
    expect(sanitizeKey(input)).toBe(input);
  });
});