import type { Tool } from './types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export const readFileTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: { filePath: { type: 'string', description: 'Path to the file to read' } },
        required: ['filePath'],
      },
    },
  },
  async execute(args, context) {
    const filePath = resolve(context.workspaceRoot, args.filePath as string);
    const content = readFileSync(filePath, 'utf-8');
    return { tool: 'read_file', stdout: content, stderr: '', exitCode: 0, success: true };
  },
};