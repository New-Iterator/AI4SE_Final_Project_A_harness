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

  it('should search by sessionId', () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'S1 content', metadata: '{}', keywords: 'keyword', timestamp: Date.now(), confidence: 1.0 });
    store.insert({ sessionId: 's2', type: 'convention', content: 'S2 content', metadata: '{}', keywords: 'keyword', timestamp: Date.now(), confidence: 1.0 });
    const results = store.searchBySession('keyword', 's1');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('S1 content');
  });

  it('should delete by id', () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'To delete', metadata: '{}', keywords: 'delete', timestamp: Date.now(), confidence: 1.0 });
    const results = store.search('delete');
    expect(results).toHaveLength(1);
    store.deleteById(results[0].id!);
    expect(store.search('delete')).toHaveLength(0);
  });

  it('should clean expired entries', () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'Old', metadata: '{}', keywords: 'old', timestamp: Date.now() - 100 * 24 * 60 * 60 * 1000, confidence: 1.0 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'New', metadata: '{}', keywords: 'new', timestamp: Date.now(), confidence: 1.0 });
    const cleaned = store.cleanExpired(30);
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(store.search('old')).toHaveLength(0);
    expect(store.search('new')).toHaveLength(1);
  });
});