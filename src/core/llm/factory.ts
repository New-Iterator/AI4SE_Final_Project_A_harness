import type { LLMProvider } from './types';
import type { Config } from '../../config/types';
import { MockLLMProvider } from './mock';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { OpenAICompatProvider } from './openai-compat';

export function createLLMProvider(config: Config, apiKeys: Record<string, string>): LLMProvider {
  const { provider, model, baseUrl } = config.llm;

  switch (provider) {
    case 'mock':
      return new MockLLMProvider('script', []);
    case 'openai': {
      const key = apiKeys['openai'];
      if (!key) throw new Error('OpenAI API key not found');
      return new OpenAIProvider(key, model, baseUrl);
    }
    case 'anthropic': {
      const key = apiKeys['anthropic'];
      if (!key) throw new Error('Anthropic API key not found');
      return new AnthropicProvider(key, model);
    }
    case 'openai-compat': {
      const key = apiKeys['openai-compat'];
      if (!key) throw new Error('OpenAI-compat API key not found');
      if (!baseUrl) throw new Error('baseUrl is required for openai-compat provider');
      return new OpenAICompatProvider(key, model, baseUrl);
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}