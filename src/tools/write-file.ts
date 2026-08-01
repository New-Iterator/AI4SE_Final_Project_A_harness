import type { Tool } from './types';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

export const writeFileTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file, creating directories if needed',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the file to write' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  async execute(args, context) {
    const filePath = resolve(context.workspaceRoot, args.filePath as string);
    const content = args.content as string;
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
    return { tool: 'write_file', stdout: `Written to ${filePath}`, stderr: '', exitCode: 0, success: true };
  },
};