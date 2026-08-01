import { describe, it, expect } from 'vitest';
import { executeAction } from '../../src/core/executor';
import { ToolRegistry } from '../../src/tools/registry';
import type { Tool } from '../../src/tools/types';
import type { ToolResult } from '../../src/types';

class EchoTool implements Tool {
  definition = { type: 'function' as const, function: { name: 'echo', description: 'echo', parameters: {} } };
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    return { tool: 'echo', stdout: `echo: ${args.text || ''}`, stderr: '', exitCode: 0, success: true };
  }
}

describe('executeAction', () => {
  it('should execute a registered tool', async () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const result = await executeAction(
      { type: 'tool_call', tool: 'echo', args: { text: 'hello' } },
      registry,
      { workspaceRoot: '/tmp' }
    );
    expect(result.tool).toBe('echo');
    expect(result.stdout).toBe('echo: hello');
  });

  it('should throw for unregistered tool', async () => {
    const registry = new ToolRegistry();
    await expect(
      executeAction({ type: 'tool_call', tool: 'unknown', args: {} }, registry, { workspaceRoot: '/tmp' })
    ).rejects.toThrow('Tool not found');
  });

  it('should throw for non-tool_call action', async () => {
    const registry = new ToolRegistry();
    await expect(
      executeAction({ type: 'stop', reason: 'done' }, registry, { workspaceRoot: '/tmp' })
    ).rejects.toThrow('Cannot execute non-tool action');
  });
});