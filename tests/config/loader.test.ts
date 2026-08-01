import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../../src/config/loader';

const TEST_DIR = join(__dirname, '..', '..', '.test-config');

describe('loadConfig', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should return defaults when no config file exists', () => {
    const config = loadConfig(TEST_DIR);
    expect(config.llm.provider).toBe('openai');
    expect(config.llm.maxTokens).toBe(4096);
    expect(config.loop.maxIterations).toBe(50);
    expect(config.memory.workingMemoryRounds).toBe(10);
  });

  it('should load and merge project config', () => {
    writeFileSync(join(TEST_DIR, '.harnessrc.json'), JSON.stringify({
      llm: { provider: 'mock', maxTokens: 2048 },
      loop: { maxIterations: 10 },
    }));
    const config = loadConfig(TEST_DIR);
    expect(config.llm.provider).toBe('mock');
    expect(config.llm.maxTokens).toBe(2048);
    expect(config.loop.maxIterations).toBe(10);
    expect(config.memory.workingMemoryRounds).toBe(10);
  });
});