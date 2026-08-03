import type { MemoryConfig } from '../config/types';
import type { Message } from '../types';
import type { SessionMemoryEntry } from './types';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { WorkingMemory } from './working-memory';
import { SessionStore } from './session-store';
import { SessionRetriever } from './session-retriever';
import { ProjectStore } from './project-store';
import { ProjectRetriever } from './project-retriever';
import { ContextInjector } from './context-injector';
import { Compressor } from './compressor';
import { createEmbeddingProvider, type EmbeddingProvider } from './embedding';

export class MemoryManager {
  private workingMemory: WorkingMemory;
  private sessionStore: SessionStore;
  private sessionRetriever: SessionRetriever;
  private projectStore: ProjectStore;
  private projectRetriever: ProjectRetriever;
  private embeddingProvider: EmbeddingProvider;
  private contextInjector: ContextInjector;
  private compressor: Compressor;
  private expireDays: number;

  constructor(config: MemoryConfig, maxContextTokens: number = 128000) {
    this.workingMemory = new WorkingMemory(config.workingMemoryRounds);
    mkdirSync(dirname(config.sessionDbPath), { recursive: true });
    this.sessionStore = new SessionStore(config.sessionDbPath);
    this.sessionRetriever = new SessionRetriever(this.sessionStore);
    mkdirSync(dirname(config.projectDbPath), { recursive: true });
    this.projectStore = new ProjectStore(config.projectDbPath);
    this.projectRetriever = new ProjectRetriever(this.projectStore);
    this.embeddingProvider = createEmbeddingProvider('mock');
    this.contextInjector = new ContextInjector(
      this.sessionRetriever,
      this.projectRetriever,
      this.embeddingProvider,
      this.workingMemory,
      maxContextTokens,
      config.workingMemoryRounds
    );
    this.compressor = new Compressor();
    this.expireDays = config.sessionMemoryExpireDays;
  }

  record(sessionId: string, type: SessionMemoryEntry['type'], content: string, metadata: Record<string, unknown> = {}, keywords: string = ''): void {
    this.sessionStore.insert({
      sessionId,
      type,
      content,
      metadata: JSON.stringify(metadata),
      keywords: keywords || extractBasicKeywords(content),
      timestamp: Date.now(),
      confidence: 1.0,
    });
  }

  async retrieve(query: string, sessionId: string): Promise<SessionMemoryEntry[]> {
    return this.sessionRetriever.retrieve(query, 5, sessionId);
  }

  async injectContext(messages: Message[], sessionId: string, currentFilePath?: string): Promise<Message[]> {
    return this.contextInjector.inject(messages, sessionId, currentFilePath);
  }

  getWorkingMemory(): WorkingMemory { return this.workingMemory; }
  getSessionStore(): SessionStore { return this.sessionStore; }
  getProjectStore(): ProjectStore { return this.projectStore; }
  getEmbeddingProvider(): EmbeddingProvider { return this.embeddingProvider; }

  cleanExpired(): number {
    return this.sessionStore.cleanExpired(this.expireDays);
  }

  forget(sessionId: string): void {
    this.sessionStore.deleteSession(sessionId);
  }

  close(): void {
    this.sessionStore.close();
    this.projectStore.close();
  }
}

function extractBasicKeywords(text: string): string {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 2).join(',');
}