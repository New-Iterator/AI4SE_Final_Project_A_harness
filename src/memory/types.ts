export interface SessionMemoryEntry {
  id?: number;
  sessionId: string;
  type: 'task' | 'decision' | 'convention' | 'error' | 'guard_block' | 'test_result';
  content: string;
  metadata: string;
  keywords: string;
  timestamp: number;
  confidence: number;
}