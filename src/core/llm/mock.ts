import type { LLMProvider, ChatRequest, ChatResponse } from './types';

export type MockScriptEntry = { inputContains: string; response: ChatResponse };

export class MockLLMProvider implements LLMProvider {
  private mode: 'script' | 'replay';
  private script: MockScriptEntry[];
  private replayQueue: ChatResponse[];
  private index = 0;

  constructor(mode: 'script' | 'replay', data: MockScriptEntry[] | ChatResponse[]) {
    this.mode = mode;
    if (mode === 'script') { this.script = data as MockScriptEntry[]; this.replayQueue = []; }
    else { this.script = []; this.replayQueue = data as ChatResponse[]; }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.mode === 'replay') {
      if (this.index >= this.replayQueue.length) throw new Error('Mock replay exhausted');
      return this.replayQueue[this.index++];
    }
    if (this.index >= this.script.length) throw new Error('Mock script exhausted');
    const entry = this.script[this.index];
    const allContent = request.messages.map(m => {
      const parts = [m.content || ''];
      if (m.toolCalls) parts.push(m.toolCalls.map(tc => tc.function.name).join(' '));
      if (m.name) parts.push(m.name);
      return parts.join(' ');
    }).join(' ');
    if (allContent.includes(entry.inputContains)) {
      this.index++;
      return entry.response;
    }
    throw new Error(`No mock script entry matches`);
  }

  supportsToolCalling(): boolean { return true; }
  reset(): void { this.index = 0; }
}