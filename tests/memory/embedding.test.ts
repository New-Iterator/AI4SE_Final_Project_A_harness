import { describe, it, expect } from 'vitest';
import { MockEmbeddingProvider, createEmbeddingProvider } from '../../src/memory/embedding';

describe('MockEmbeddingProvider', () => {
  it('should generate deterministic embedding for same text', async () => {
    const provider = new MockEmbeddingProvider();
    const a = await provider.embed('hello');
    const b = await provider.embed('hello');
    expect(a.length).toBe(128);
    expect(b.length).toBe(128);
    expect(a).toEqual(b);
  });

  it('should generate different embeddings for different text', async () => {
    const provider = new MockEmbeddingProvider();
    const a = await provider.embed('hello');
    const b = await provider.embed('world');
    let different = false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) { different = true; break; }
    }
    expect(different).toBe(true);
  });

  it('should create mock provider by default', () => {
    const provider = createEmbeddingProvider('mock');
    expect(provider).toBeInstanceOf(MockEmbeddingProvider);
  });
});