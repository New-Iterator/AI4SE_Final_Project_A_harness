import type { ProjectStore, ProjectMemoryEntry } from './project-store';

export class ProjectRetriever {
  private store: ProjectStore;

  constructor(store: ProjectStore) {
    this.store = store;
  }

  async retrieve(queryEmbedding: Float32Array, topK: number = 3): Promise<ProjectMemoryEntry[]> {
    const entries = this.store.getAll();
    if (entries.length === 0) return [];

    const scored = entries.map(entry => {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      return { entry, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK).map(s => s.entry);
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    const minLen = Math.min(a.length, b.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < minLen; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}