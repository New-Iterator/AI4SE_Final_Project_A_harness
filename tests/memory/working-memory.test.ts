import { describe, it, expect } from 'vitest';
import { WorkingMemory } from '../../src/memory/working-memory';

describe('WorkingMemory', () => {
  it('should add and retrieve messages', () => {
    const wm = new WorkingMemory(10);
    wm.add({ role: 'user', content: 'hello' });
    wm.add({ role: 'assistant', content: 'hi' });
    expect(wm.getAll()).toHaveLength(2);
  });

  it('should get last N messages', () => {
    const wm = new WorkingMemory(10);
    wm.add({ role: 'user', content: 'a' });
    wm.add({ role: 'assistant', content: 'b' });
    wm.add({ role: 'user', content: 'c' });
    const last = wm.getLast(2);
    expect(last).toHaveLength(2);
    expect(last[0].content).toBe('b');
    expect(last[1].content).toBe('c');
  });

  it('should clear all messages', () => {
    const wm = new WorkingMemory(10);
    wm.add({ role: 'user', content: 'hello' });
    wm.clear();
    expect(wm.getAll()).toHaveLength(0);
  });
});