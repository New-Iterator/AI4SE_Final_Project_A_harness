import type { SessionStore } from './session-store';
import type { SessionMemoryEntry } from './types';

const MIN_CONFIDENCE = 0.5;

export class SessionRetriever {
  private store: SessionStore;

  constructor(store: SessionStore) {
    this.store = store;
  }

  async retrieve(query: string, topK: number = 5, sessionId?: string): Promise<SessionMemoryEntry[]> {
    const keywords = extractKeywords(query);
    const allResults: SessionMemoryEntry[] = [];

    for (const keyword of keywords) {
      const results = sessionId
        ? this.store.searchBySession(keyword, sessionId, topK * 2)
        : this.store.search(keyword, topK * 2);
      for (const r of results) {
        if (!allResults.find(e => e.id === r.id)) {
          allResults.push(r);
        }
      }
    }

    return allResults
      .filter(e => e.confidence >= MIN_CONFIDENCE)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, topK);
  }
}

function extractKeywords(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 1);
  return [...new Set(words)];
}