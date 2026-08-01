import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../src/tools/registry';
import type { Tool } from '../../src/tools/types';
import type { ToolResult } from '../../src/types';

class FakeTool implements Tool {
  definition = { type: 'function' as const, function: { name: 'fake', description: 'fake', parameters: {} } };
  async execute(): Promise<ToolResult> { return { tool: 'fake', stdout: '', stderr: '', exitCode: 0, success: true }; }
}

describe('ToolRegistry', () => {
  it('should register and retrieve tools', () => {
    const registry = new ToolRegistry();
    const tool = new FakeTool();
    registry.register(tool);
    expect(registry.get('fake')).toBe(tool);
  });

  it('should throw for unregistered tool', () => {
    const registry = new ToolRegistry();
    expect(() => registry.get('unknown')).toThrow('Tool not found: unknown');
  });

  it('should return all tool definitions', () => {
    const registry = new ToolRegistry();
    registry.register(new FakeTool());
    const defs = registry.getDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].function.name).toBe('fake');
  });
});