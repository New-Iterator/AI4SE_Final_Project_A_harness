import type { SessionRetriever } from './session-retriever';
import type { WorkingMemory } from './working-memory';
import type { Message } from '../types';

export class ContextInjector {
  private retriever: SessionRetriever;
  private workingMemory: WorkingMemory;

  constructor(retriever: SessionRetriever, workingMemory: WorkingMemory) {
    this.retriever = retriever;
    this.workingMemory = workingMemory;
  }

  async inject(messages: Message[], sessionId: string): Promise<Message[]> {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg || !lastUserMsg.content) return messages;

    const query = lastUserMsg.content;
    const entries = await this.retriever.retrieve(query, 5);

    if (entries.length === 0) return messages;

    const memoryContent = entries
      .map(e => `[${e.type}] ${e.content}`)
      .join('\n');

    const memoryMsg: Message = {
      role: 'system',
      content: `相关项目记忆:\n${memoryContent}`,
    };

    const systemIdx = messages.findIndex(m => m.role === 'system');
    const insertAt = systemIdx >= 0 ? systemIdx + 1 : 0;

    const result = [...messages];
    result.splice(insertAt, 0, memoryMsg);
    return result;
  }
}