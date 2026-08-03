import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../../src/memory/session-store';
import { SessionRetriever } from '../../src/memory/session-retriever';

describe('SessionRetriever', () => {
  let store: SessionStore;
  let retriever: SessionRetriever;

  beforeEach(() => {
    store = new SessionStore(':memory:');
    retriever = new SessionRetriever(store);
  });

  it('should retrieve entries by keyword match', async () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'Use tabs', metadata: '{}', keywords: 'indentation,tabs', timestamp: 1000, confidence: 1.0 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'Use spaces', metadata: '{}', keywords: 'indentation,spaces', timestamp: 2000, confidence: 1.0 });
    const results = await retriever.retrieve('indentation', 5);
    expect(results).toHaveLength(2);
  });

  it('should respect topK limit', async () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'A', metadata: '{}', keywords: 'a', timestamp: 1000, confidence: 1.0 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'B', metadata: '{}', keywords: 'a', timestamp: 2000, confidence: 1.0 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'C', metadata: '{}', keywords: 'a', timestamp: 3000, confidence: 1.0 });
    const results = await retriever.retrieve('a', 2);
    expect(results).toHaveLength(2);
  });

  it('should filter low confidence entries', async () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'Good', metadata: '{}', keywords: 'rule', timestamp: 1000, confidence: 0.9 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'Bad', metadata: '{}', keywords: 'rule', timestamp: 2000, confidence: 0.3 });
    const results = await retriever.retrieve('rule', 5);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Good');
  });

  it('should filter by sessionId', async () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'S1 entry', metadata: '{}', keywords: 'shared', timestamp: 1000, confidence: 1.0 });
    store.insert({ sessionId: 's2', type: 'convention', content: 'S2 entry', metadata: '{}', keywords: 'shared', timestamp: 2000, confidence: 1.0 });
    const results = await retriever.retrieve('shared', 5, 's1');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('S1 entry');
  });
});