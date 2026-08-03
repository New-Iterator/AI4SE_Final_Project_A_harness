import type { SessionRetriever } from './session-retriever';
import type { ProjectRetriever } from './project-retriever';
import type { EmbeddingProvider } from './embedding';
import type { WorkingMemory } from './working-memory';
import type { Message } from '../types';
import { Compressor } from './compressor';

const CHARS_PER_TOKEN = 4;
const MAX_ENTRY_CONTENT = 2000;

export class ContextInjector {
  private sessionRetriever: SessionRetriever;
  private projectRetriever: ProjectRetriever;
  private embeddingProvider: EmbeddingProvider;
  private workingMemory: WorkingMemory;
  private compressor: Compressor;
  private maxContextTokens: number;

  constructor(
    sessionRetriever: SessionRetriever,
    projectRetriever: ProjectRetriever,
    embeddingProvider: EmbeddingProvider,
    workingMemory: WorkingMemory,
    maxContextTokens: number = 128000,
    private workingMemoryRounds: number = 10
  ) {
    this.sessionRetriever = sessionRetriever;
    this.projectRetriever = projectRetriever;
    this.embeddingProvider = embeddingProvider;
    this.workingMemory = workingMemory;
    this.compressor = new Compressor();
    this.maxContextTokens = maxContextTokens;
  }

  async inject(messages: Message[], sessionId: string, currentFilePath?: string): Promise<Message[]> {
    let result = [...messages];

    const lastUserMsg = [...result].reverse().find(m => m.role === 'user');
    if (!lastUserMsg || !lastUserMsg.content) return result;

    const query = lastUserMsg.content;

    try {
      const l2Entries = await this.sessionRetriever.retrieve(query, 5, sessionId);
      if (l2Entries.length > 0) {
        const l2Content = l2Entries
          .map(e => `[${e.type}] ${truncateContent(e.content)}`)
          .join('\n');
        result = this.insertMemoryMessage(result, `项目会话记忆:\n${l2Content}`);
      }
    } catch {
      // L2 retrieval failed, skip and continue with L3
    }

    try {
      const searchText = currentFilePath ? `${currentFilePath} ${query}` : query;
      const l3Embedding = await this.embeddingProvider.embed(searchText);
      const l3Entries = await this.projectRetriever.retrieve(l3Embedding, 3);
      if (l3Entries.length > 0) {
        const l3Content = l3Entries
          .map(e => `[${e.type}] ${e.path}: ${truncateContent(e.content)}`)
          .join('\n');
        result = this.insertMemoryMessage(result, `项目级记忆:\n${l3Content}`);
      }
    } catch {
      // L3 retrieval failed, only L2 results are injected
    }

    const estimatedTokens = this.estimateTokens(result);
    if (estimatedTokens > this.maxContextTokens) {
      result = this.compressor.compress(result, this.maxContextTokens, 'truncate', this.workingMemoryRounds);
    }

    return result;
  }

  private insertMemoryMessage(messages: Message[], content: string): Message[] {
    const memoryMsg: Message = {
      role: 'system',
      content,
    };
    const result = [...messages];
    let lastUserIdx = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    const insertAt = lastUserIdx >= 0 ? lastUserIdx : 0;
    result.splice(insertAt, 0, memoryMsg);
    return result;
  }

  private estimateTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + (m.content ? m.content.length / CHARS_PER_TOKEN : 0), 0);
  }
}

function truncateContent(content: string): string {
  if (content.length <= MAX_ENTRY_CONTENT) return content;
  return content.slice(0, MAX_ENTRY_CONTENT) + '...(truncated)';
}