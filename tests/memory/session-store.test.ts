import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../../src/memory/session-store';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => { store = new SessionStore(':memory:'); });

  it('should insert and retrieve entries', () => {
    store.insert({ sessionId: 'sess-1', type: 'convention', content: 'Use tabs', metadata: '{}', keywords: 'indentation,tabs', timestamp: Date.now(), confidence: 1.0 });
    const results = store.search('indentation');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Use tabs');
  });

  it('should filter by sessionId', () => {
    store.insert({ sessionId: 'sess-1', type: 'convention', content: 'A', metadata: '{}', keywords: 'a', timestamp: Date.now(), confidence: 1.0 });
    store.insert({ sessionId: 'sess-2', type: 'convention', content: 'B', metadata: '{}', keywords: 'b', timestamp: Date.now(), confidence: 1.0 });
    expect(store.getBySession('sess-1')).toHaveLength(1);
    expect(store.getBySession('sess-1')[0].content).toBe('A');
  });

  it('should delete entries by sessionId', () => {
    store.insert({ sessionId: 'sess-1', type: 'convention', content: 'A', metadata: '{}', keywords: 'a', timestamp: Date.now(), confidence: 1.0 });
    store.deleteSession('sess-1');
    expect(store.getBySession('sess-1')).toHaveLength(0);
  });
});