export interface Config {
  llm: LLMConfig;
  loop: LoopConfig;
  tools: ToolsConfig;
  memory: MemoryConfig;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'openai-compat' | 'mock';
  model: string;
  maxTokens: number;
  temperature: number;
  baseUrl?: string;
}

export interface LoopConfig {
  maxIterations: number;
  maxContextTokens: number;
  maxConsecutiveFailures: number;
}

export interface ToolsConfig {
  workspaceRoot: string;
  allowedCommands: string[];
  blockedPatterns: string[];
}

export interface MemoryConfig {
  sessionDbPath: string;
  projectDbPath: string;
  workingMemoryRounds: number;
  sessionMemoryExpireDays: number;
  retrievalTopK: number;
}

export const DEFAULT_CONFIG: Config = {
  llm: { provider: 'openai', model: 'gpt-4o', maxTokens: 4096, temperature: 0.1 },
  loop: { maxIterations: 50, maxContextTokens: 128000, maxConsecutiveFailures: 3 },
  tools: { workspaceRoot: process.cwd(), allowedCommands: [], blockedPatterns: [] },
  memory: { sessionDbPath: '.harness/session.db', projectDbPath: '.harness/project.db', workingMemoryRounds: 10, sessionMemoryExpireDays: 30, retrievalTopK: 5 },
};