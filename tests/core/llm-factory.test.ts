import { describe, it, expect } from 'vitest';
import { createLLMProvider } from '../../src/core/llm/factory';
import { MockLLMProvider } from '../../src/core/llm/mock';
import { OpenAIProvider } from '../../src/core/llm/openai';
import { AnthropicProvider } from '../../src/core/llm/anthropic';
import { OpenAICompatProvider } from '../../src/core/llm/openai-compat';
import type { Config } from '../../src/config/types';

const baseConfig: Config = {
  llm: { provider: 'openai', model: 'gpt-4o', maxTokens: 4096, temperature: 0.1 },
  loop: { maxIterations: 50, maxContextTokens: 128000, maxConsecutiveFailures: 3 },
  tools: { workspaceRoot: '.', allowedCommands: [], blockedPatterns: [] },
  memory: { sessionDbPath: ':memory:', projectDbPath: ':memory:', workingMemoryRounds: 10, sessionMemoryExpireDays: 30, retrievalTopK: 5 },
};

describe('createLLMProvider', () => {
  it('should create MockLLMProvider for mock provider', () => {
    const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'mock' as const } };
    expect(createLLMProvider(config, {})).toBeInstanceOf(MockLLMProvider);
  });
  it('should create OpenAIProvider for openai provider', () => {
    expect(createLLMProvider(baseConfig, { openai: 'sk-test' })).toBeInstanceOf(OpenAIProvider);
  });
  it('should create AnthropicProvider for anthropic provider', () => {
    const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'anthropic' as const } };
    expect(createLLMProvider(config, { anthropic: 'sk-ant-test' })).toBeInstanceOf(AnthropicProvider);
  });
  it('should create OpenAICompatProvider for openai-compat', () => {
    const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'openai-compat' as const, baseUrl: 'https://api.example.com/v1' } };
    expect(createLLMProvider(config, { 'openai-compat': 'sk-test' })).toBeInstanceOf(OpenAICompatProvider);
  });
  it('should throw for missing API key', () => {
    expect(() => createLLMProvider(baseConfig, {})).toThrow('API key not found');
  });
  it('should throw for unknown provider', () => {
    const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'unknown' as any } };
    expect(() => createLLMProvider(config, {})).toThrow('Unknown LLM provider');
  });
});