export class CredentialManager {
  private keys = new Map<string, string>();

  set(provider: string, key: string): void {
    this.keys.set(provider, key);
  }

  get(provider: string): string | null {
    return this.keys.get(provider) || null;
  }

  has(provider: string): boolean {
    return this.keys.has(provider);
  }

  delete(provider: string): void {
    this.keys.delete(provider);
  }

  status(): Record<string, 'configured' | 'not configured'> {
    const providers = ['openai', 'anthropic', 'openai-compat'];
    const result: Record<string, 'configured' | 'not configured'> = {};
    for (const p of providers) {
      result[p] = this.has(p) ? 'configured' : 'not configured';
    }
    return result;
  }
}