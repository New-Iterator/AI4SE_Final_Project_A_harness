import { describe, it, expect } from 'vitest';
import { ContextInjector } from '../../src/memory/context-injector';
import { SessionRetriever } from '../../src/memory/session-retriever';
import { SessionStore } from '../../src/memory/session-store';
import { ProjectStore } from '../../src/memory/project-store';
import { ProjectRetriever } from '../../src/memory/project-retriever';
import { MockEmbeddingProvider } from '../../src/memory/embedding';
import { WorkingMemory } from '../../src/memory/working-memory';
import type { Message } from '../../src/types';

describe('ContextInjector', () => {
  function createInjector() {
    const sessionStore = new SessionStore(':memory:');
    const sessionRetriever = new SessionRetriever(sessionStore);
    const projectStore = new ProjectStore(':memory:');
    const projectRetriever = new ProjectRetriever(projectStore);
    const embedding = new MockEmbeddingProvider();
    const wm = new WorkingMemory(10);
    return { injector: new ContextInjector(sessionRetriever, projectRetriever, embedding, wm, 128000), sessionStore };
  }

  it('should inject retrieved session memory into messages', async () => {
    const { injector, sessionStore } = createInjector();
    sessionStore.insert({ sessionId: 's1', type: 'convention', content: 'Use tabs', metadata: '{}', keywords: 'tabs,indentation', timestamp: Date.now(), confidence: 1.0 });
    const messages: Message[] = [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Write code with tabs indentation' },
    ];
    const result = await injector.inject(messages, 's1');
    expect(result.length).toBeGreaterThanOrEqual(3);
    const l2Msg = result.find(m => m.content?.includes('项目会话记忆'));
    expect(l2Msg).toBeDefined();
    expect(l2Msg!.content).toContain('Use tabs');
  });

  it('should return original messages when no memory matches', async () => {
    const { injector } = createInjector();
    const messages: Message[] = [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Hello' },
    ];
    const result = await injector.inject(messages, 's1');
    expect(result.length).toBe(2);
  });
});