import type { ToolResult } from '../types';
import type { ToolDefinition } from '../core/llm/types';

export interface ToolContext {
  workspaceRoot: string;
}

export interface Tool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}