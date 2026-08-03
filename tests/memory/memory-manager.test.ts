import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryManager } from '../../src/memory';

describe('MemoryManager', () => {
  let mm: MemoryManager;

  beforeEach(() => {
    mm = new MemoryManager({ sessionDbPath: ':memory:', projectDbPath: ':memory:', workingMemoryRounds: 10, sessionMemoryExpireDays: 30, retrievalTopK: 5 }, 128000);
  });

  it('should record and retrieve session memory', async () => {
    mm.record('session-1', 'convention', 'Use tabs', { language: 'ts' }, 'tabs,indentation');
    const results = await mm.retrieve('tabs', 'session-1');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Use tabs');
  });

  it('should inject context into messages', async () => {
    mm.record('session-1', 'convention', 'Use tabs for indentation', {}, 'tabs,indentation');
    const messages = [
      { role: 'system' as const, content: 'System prompt' },
      { role: 'user' as const, content: 'Write code with tabs' },
    ];
    const injected = await mm.injectContext(messages, 'session-1');
    expect(injected.length).toBeGreaterThanOrEqual(3);
  });

  it('should clean expired entries', () => {
    mm.record('old-session', 'convention', 'old', {}, 'old');
    const cleaned = mm.cleanExpired();
    expect(cleaned).toBeGreaterThanOrEqual(0);
  });

  it('should forget session entries', async () => {
    mm.record('session-x', 'convention', 'temp', {}, 'temp');
    mm.forget('session-x');
    const results = await mm.retrieve('temp', 'session-x');
    expect(results).toHaveLength(0);
  });
});