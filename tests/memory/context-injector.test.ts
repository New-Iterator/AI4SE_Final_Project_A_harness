import { describe, it, expect } from 'vitest';
import { ContextInjector } from '../../src/memory/context-injector';
import { SessionRetriever } from '../../src/memory/session-retriever';
import { SessionStore } from '../../src/memory/session-store';
import { WorkingMemory } from '../../src/memory/working-memory';
import type { Message } from '../../src/types';

describe('ContextInjector', () => {
  it('should inject retrieved memory into messages', async () => {
    const store = new SessionStore(':memory:');
    store.insert({ sessionId: 's1', type: 'convention', content: 'Use tabs', metadata: '{}', keywords: 'tabs,indentation', timestamp: Date.now(), confidence: 1.0 });
    const retriever = new SessionRetriever(store);
    const wm = new WorkingMemory(10);
    const injector = new ContextInjector(retriever, wm);
    const messages: Message[] = [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Write code with tabs indentation' },
    ];
    const result = await injector.inject(messages, 's1');
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[1].role).toBe('system');
    expect(result[1].content).toContain('Use tabs');
  });

  it('should return original messages when no memory matches', async () => {
    const store = new SessionStore(':memory:');
    const retriever = new SessionRetriever(store);
    const wm = new WorkingMemory(10);
    const injector = new ContextInjector(retriever, wm);
    const messages: Message[] = [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Hello' },
    ];
    const result = await injector.inject(messages, 's1');
    expect(result).toEqual(messages);
  });
});