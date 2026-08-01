import type { Action } from '../types';
import { resolve, isAbsolute, relative } from 'path';

export interface GuardResult {
  blocked: boolean;
  requiresApproval: boolean;
  reason?: string;
}

const DANGEROUS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'rm -rf root', pattern: /rm\s+-rf\s+\/(\*|$|\s)/ },
  { name: 'rm -rf home', pattern: /rm\s+-rf\s+~/ },
  { name: 'rm -rf recursive', pattern: /rm\s+-rf\s+\./ },
  { name: 'DROP TABLE', pattern: /DROP\s+TABLE/i },
  { name: 'DROP DATABASE', pattern: /DROP\s+DATABASE/i },
  { name: 'git push force', pattern: /git\s+push\s+.*--force.*(main|master)/ },
  { name: 'curl pipe bash', pattern: /curl.*\|.*(bash|sh|zsh)/ },
  { name: 'eval', pattern: /\beval\s+/ },
  { name: 'sudo', pattern: /\bsudo\s+/ },
  { name: 'fork bomb', pattern: /:\(\)\s*\{/ },
];

export function checkGuard(action: Action, workspaceRoot: string): GuardResult {
  if (action.tool === 'shell' && action.args?.command) {
    const cmd = action.args.command as string;
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.pattern.test(cmd)) {
        return { blocked: false, requiresApproval: true, reason: `${pattern.name}: ${cmd}` };
      }
    }
  }

  if ((action.tool === 'write_file' || action.tool === 'read_file') && action.args?.filePath) {
    const filePath = action.args.filePath as string;
    if (!isWithinWorkspace(filePath, workspaceRoot)) {
      return { blocked: true, requiresApproval: false, reason: `文件路径超出工作区范围: ${filePath}` };
    }
  }

  return { blocked: false, requiresApproval: false };
}

function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
  const resolved = isAbsolute(filePath) ? filePath : resolve(workspaceRoot, filePath);
  const rel = relative(workspaceRoot, resolved);
  return !rel.startsWith('..') && !isAbsolute(rel);
}