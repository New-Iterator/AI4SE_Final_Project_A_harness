import type { Tool } from './types';
import { execSync } from 'child_process';

export const runTestTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'run_test',
      description: 'Run the project test suite',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Test command, e.g. npm test', default: 'npm test' } },
      },
    },
  },
  async execute(args, context) {
    const cmd = (args.command as string) || 'npm test';
    try {
      const stdout = execSync(cmd, { cwd: context.workspaceRoot, encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
      return { tool: 'run_test', stdout, stderr: '', exitCode: 0, success: true };
    } catch (err: any) {
      return {
        tool: 'run_test',
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.status || 1,
        success: false,
      };
    }
  },
};