import type { Message } from '../types';

export class WorkingMemory {
  private messages: Message[] = [];
  private maxRounds: number;

  constructor(maxRounds: number) {
    this.maxRounds = maxRounds;
  }

  add(message: Message): void {
    this.messages.push(message);
    this.messages = this.messages.slice(-this.maxRounds);
  }

  getAll(): Message[] {
    return [...this.messages];
  }

  getLast(n: number): Message[] {
    return this.messages.slice(-n);
  }

  clear(): void {
    this.messages = [];
  }
}