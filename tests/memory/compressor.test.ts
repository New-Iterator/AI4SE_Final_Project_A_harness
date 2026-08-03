import { describe, it, expect } from 'vitest';
import { Compressor } from '../../src/memory/compressor';
import type { Message } from '../../src/types';

describe('Compressor', () => {
  it('should return original messages when under limit', () => {
    const compressor = new Compressor();
    const messages: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
    ];
    const result = compressor.compress(messages, 1000, 'truncate');
    expect(result).toEqual(messages);
  });

  it('should truncate middle messages in truncate mode', () => {
    const compressor = new Compressor();
    const messages: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'A'.repeat(2000) },
      { role: 'assistant', content: 'B'.repeat(2000) },
      { role: 'user', content: 'Recent message' },
    ];
    const result = compressor.compress(messages, 10, 'truncate', 1);
    const hasMarker = result.some(m => m.role === 'system' && m.content?.includes('truncated'));
    expect(hasMarker).toBe(true);
    expect(result[0].content).toBe('System prompt');
    expect(result[result.length - 1].content).toBe('Recent message');
  });

  it('should insert truncation marker', () => {
    const compressor = new Compressor();
    const messages: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'A'.repeat(2000) },
      { role: 'assistant', content: 'B'.repeat(2000) },
      { role: 'user', content: 'C'.repeat(2000) },
      { role: 'user', content: 'Last message' },
    ];
    const result = compressor.compress(messages, 10, 'truncate', 1);
    const hasMarker = result.some(m => m.role === 'system' && m.content?.includes('truncated'));
    expect(hasMarker).toBe(true);
  });
});