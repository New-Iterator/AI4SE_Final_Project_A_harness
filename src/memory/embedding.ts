import { createHash } from 'crypto';

const EMBEDDING_DIM = 128;

export interface EmbeddingProvider {
  embed(text: string): Promise<Float32Array>;
  readonly dimensions: number;
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIM;

  async embed(text: string): Promise<Float32Array> {
    const buffer = new Float32Array(EMBEDDING_DIM);
    const hash = createHash('sha256').update(text).digest();
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      const byteIdx = i % hash.length;
      buffer[i] = ((hash[byteIdx] / 255) * 2 - 1) * 0.3;
    }
    return buffer;
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIM;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small', baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async embed(text: string): Promise<Float32Array> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI Embedding API 错误: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as any;
    return new Float32Array(data.data[0].embedding);
  }
}

export function createEmbeddingProvider(
  mode: 'mock' | 'openai',
  apiKey?: string,
  model?: string
): EmbeddingProvider {
  if (mode === 'openai' && apiKey) {
    return new OpenAIEmbeddingProvider(apiKey, model);
  }
  return new MockEmbeddingProvider();
}