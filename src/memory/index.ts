import type { MemoryConfig } from '../config/types';
import type { Message } from '../types';
import type { SessionMemoryEntry } from './types';
import { WorkingMemory } from './working-memory';
import { SessionStore } from './session-store';
import { SessionRetriever } from './session-retriever';
import { ProjectStore } from './project-store';
import { ProjectRetriever } from './project-retriever';
import { ContextInjector } from './context-injector';
import { Compressor } from './compressor';

export class MemoryManager {
  private workingMemory: WorkingMemory;
  private sessionStore: SessionStore;
  private sessionRetriever: SessionRetriever;
  private projectStore: ProjectStore;
  private projectRetriever: ProjectRetriever;
  private contextInjector: ContextInjector;
  private compressor: Compressor;

  constructor(config: MemoryConfig) {
    this.workingMemory = new WorkingMemory(config.workingMemoryRounds);
    this.sessionStore = new SessionStore(config.sessionDbPath);
    this.sessionRetriever = new SessionRetriever(this.sessionStore);
    this.projectStore = new ProjectStore(config.projectDbPath);
    this.projectRetriever = new ProjectRetriever(this.projectStore);
    this.contextInjector = new ContextInjector(this.sessionRetriever, this.workingMemory);
    this.compressor = new Compressor();
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
    return this.sessionRetriever.retrieve(query, 5);
  }

  async injectContext(messages: Message[], sessionId: string): Promise<Message[]> {
    return this.contextInjector.inject(messages, sessionId);
  }

  getWorkingMemory(): WorkingMemory { return this.workingMemory; }
  getSessionStore(): SessionStore { return this.sessionStore; }
  getProjectStore(): ProjectStore { return this.projectStore; }

  close(): void {
    this.sessionStore.close();
    this.projectStore.close();
  }
}

function extractBasicKeywords(text: string): string {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 2).join(',');
}