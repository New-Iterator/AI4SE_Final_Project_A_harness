import type { Message } from '../types';

const CHARS_PER_TOKEN = 4;

export class Compressor {
  compress(messages: Message[], maxTokens: number, mode: 'truncate' | 'summarize'): Message[] {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const currentChars = estimateTokens(messages) * CHARS_PER_TOKEN;
    if (currentChars <= maxChars) return messages;

    return this.compressTruncate(messages, maxChars);
  }

  private compressTruncate(messages: Message[], maxChars: number): Message[] {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');
    const keepLast = Math.max(2, Math.floor(nonSystem.length / 2));

    const result: Message[] = [];
    if (systemMsg) result.push(systemMsg);

    const leading = nonSystem.slice(0, nonSystem.length - keepLast);
    if (leading.length > 0) {
      result.push({ role: 'system', content: '...[更早的消息已截断]...' });
    }

    result.push(...nonSystem.slice(-keepLast));
    return result;
  }
}

function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + (m.content ? m.content.length / CHARS_PER_TOKEN : 0), 0);
}