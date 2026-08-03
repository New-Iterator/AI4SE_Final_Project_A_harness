import type { SessionRetriever } from './session-retriever';
import type { ProjectRetriever } from './project-retriever';
import type { EmbeddingProvider } from './embedding';
import type { WorkingMemory } from './working-memory';
import type { Message } from '../types';
import { Compressor } from './compressor';

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
    maxContextTokens: number = 128000
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

    const l2Entries = await this.sessionRetriever.retrieve(query, 5, sessionId);
    if (l2Entries.length > 0) {
      const l2Content = l2Entries
        .map(e => `[${e.type}] ${e.content}`)
        .join('\n');
      result = this.insertMemoryMessage(result, `项目会话记忆:\n${l2Content}`);
    }

    const searchText = currentFilePath ? `${currentFilePath} ${query}` : query;
    const l3Embedding = await this.embeddingProvider.embed(searchText);
    const l3Entries = await this.projectRetriever.retrieve(l3Embedding, 3);
    if (l3Entries.length > 0) {
      const l3Content = l3Entries
        .map(e => `[${e.type}] ${e.path}: ${e.content}`)
        .join('\n');
      result = this.insertMemoryMessage(result, `项目级记忆:\n${l3Content}`);
    }

    result = this.compressor.compress(result, this.maxContextTokens, 'truncate');

    return result;
  }

  private insertMemoryMessage(messages: Message[], content: string): Message[] {
    const memoryMsg: Message = {
      role: 'system',
      content,
    };
    const systemIdx = messages.findIndex(m => m.role === 'system');
    const insertAt = systemIdx >= 0 ? systemIdx + 1 : 0;
    const result = [...messages];
    result.splice(insertAt, 0, memoryMsg);
    return result;
  }
}