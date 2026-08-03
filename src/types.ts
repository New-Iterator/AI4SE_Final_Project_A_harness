export interface Action {
  type: 'tool_call' | 'stop' | 'invalid';
  tool?: string;
  args?: Record<string, unknown>;
  reason?: string;
}

export interface ToolResult {
  tool: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCallId?: string;
  name?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface LoopResult {
  success: boolean;
  reason: string;
  iterations: number;
}

export interface Session {
  id: string;
  task: string;
  status: 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
  iterations: number;
  startedAt: number;
  endedAt?: number;
}