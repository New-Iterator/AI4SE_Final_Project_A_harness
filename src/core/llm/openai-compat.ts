import { OpenAIProvider } from './openai';

export class OpenAICompatProvider extends OpenAIProvider {
  constructor(apiKey: string, model: string, baseUrl: string) {
    super(apiKey, model, baseUrl);
  }
}