import type { Message } from '../types';

const CHARS_PER_TOKEN = 4;

export class Compressor {
  compress(
    messages: Message[],
    maxTokens: number,
    mode: 'truncate' | 'summarize',
    workingMemoryRounds: number = 10
  ): Message[] {
    try {
      const maxChars = maxTokens * CHARS_PER_TOKEN;
      const currentChars = estimateTokens(messages) * CHARS_PER_TOKEN;
      if (currentChars <= maxChars) return messages;

      if (mode === 'summarize') {
        return this.compressTruncate(messages, maxChars, workingMemoryRounds);
      }

      return this.compressTruncate(messages, maxChars, workingMemoryRounds);
    } catch {
      return this.compressTruncate(messages, maxTokens * CHARS_PER_TOKEN, workingMemoryRounds);
    }
  }

  private compressTruncate(messages: Message[], maxChars: number, workingMemoryRounds: number): Message[] {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');
    const keepLast = Math.max(2, workingMemoryRounds);

    const result: Message[] = [];

    if (systemMsg) {
      const sysContent = systemMsg.content || '';
      if (sysContent.length > maxChars) {
        result.push({ role: 'system', content: sysContent.slice(0, maxChars) + '...(truncated)' });
      } else {
        result.push(systemMsg);
      }
    }

    const leading = nonSystem.slice(0, nonSystem.length - keepLast);
    if (leading.length > 0) {
      result.push({ role: 'system', content: '...[earlier messages truncated]...' });
    }

    result.push(...nonSystem.slice(-keepLast));
    return result;
  }
}

function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + (m.content ? m.content.length / CHARS_PER_TOKEN : 0), 0);
}