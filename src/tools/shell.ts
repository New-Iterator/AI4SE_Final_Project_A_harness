import type { Tool } from './types';
import { execSync } from 'child_process';

export const shellTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Shell command to execute' } },
        required: ['command'],
      },
    },
  },
  async execute(args, context) {
    try {
      const stdout = execSync(args.command as string, {
        cwd: context.workspaceRoot,
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { tool: 'shell', stdout, stderr: '', exitCode: 0, success: true };
    } catch (err: any) {
      return {
        tool: 'shell',
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.status || 1,
        success: false,
      };
    }
  },
};