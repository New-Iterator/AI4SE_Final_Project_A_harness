import type { Action, ToolResult } from '../types';
import type { ToolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';

export async function executeAction(
  action: Action,
  registry: ToolRegistry,
  context: ToolContext
): Promise<ToolResult> {
  if (action.type !== 'tool_call' || !action.tool) {
    throw new Error(`Cannot execute non-tool action: ${action.type}`);
  }
  const tool = registry.get(action.tool);
  return tool.execute(action.args || {}, context);
}