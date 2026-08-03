import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config as dotenvConfig } from 'dotenv';
import { Config, DEFAULT_CONFIG } from './types';

dotenvConfig();

export function loadConfig(cwd?: string): Config {
  const workDir = cwd || process.cwd();
  const config = deepClone(DEFAULT_CONFIG);
  const paths = [join(homedir(), '.harnessrc.json'), join(workDir, '.harnessrc.json')];
  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8');
        const partial = JSON.parse(raw) as Partial<Config>;
        deepMerge(config as unknown as Record<string, unknown>, partial as unknown as Record<string, unknown>);
      } catch { console.warn(`[Config] 无法解析配置文件: ${path}`); }
    }
  }
  return config;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv) && tv !== null && typeof tv === 'object' && !Array.isArray(tv)) {
      deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      target[key] = sv;
    }
  }
}