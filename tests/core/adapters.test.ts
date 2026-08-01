import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../../src/core/llm/openai';
import { AnthropicProvider } from '../../src/core/llm/anthropic';
import { OpenAICompatProvider } from '../../src/core/llm/openai-compat';

describe('LLM Adapters', () => {
  it('OpenAI: should construct with apiKey', () => {
    const p = new OpenAIProvider('sk-test', 'gpt-4o');
    expect(p.supportsToolCalling()).toBe(true);
  });
  it('OpenAI: should throw on missing apiKey', () => {
    expect(() => new OpenAIProvider('', 'gpt-4o')).toThrow('API key is required');
  });
  it('Anthropic: should construct with apiKey', () => {
    const p = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');
    expect(p.supportsToolCalling()).toBe(true);
  });
  it('Anthropic: should throw on missing apiKey', () => {
    expect(() => new AnthropicProvider('', 'claude-sonnet-4-20250514')).toThrow('API key is required');
  });
  it('OpenAICompat: should construct with apiKey and baseUrl', () => {
    const p = new OpenAICompatProvider('sk-test', 'deepseek-chat', 'https://api.deepseek.com/v1');
    expect(p.supportsToolCalling()).toBe(true);
  });
});