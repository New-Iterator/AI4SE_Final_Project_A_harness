export class CredentialManager {
  private keys = new Map<string, string>();
  private useKeychain = false;

  constructor() {
    try {
      require('keytar');
      this.useKeychain = true;
    } catch { /* keytar not available */ }
  }

  async set(provider: string, key: string): Promise<void> {
    this.keys.set(provider, key);
    if (this.useKeychain) {
      try {
        const keytar = require('keytar');
        await keytar.setPassword('coding-agent-harness', provider, key);
      } catch { /* keychain write failed, keep in memory */ }
    }
  }

  async get(provider: string): Promise<string | null> {
    if (this.useKeychain) {
      try {
        const keytar = require('keytar');
        const stored = await keytar.getPassword('coding-agent-harness', provider);
        if (stored) {
          this.keys.set(provider, stored);
          return stored;
        }
      } catch { /* keychain read failed */ }
    }
    return this.keys.get(provider) || null;
  }

  has(provider: string): boolean {
    if (this.keys.has(provider)) return true;
    if (this.useKeychain) {
      try {
        const keytar = require('keytar');
        const key = keytar.getPassword('coding-agent-harness', provider);
        return !!key;
      } catch { return false; }
    }
    return false;
  }

  async delete(provider: string): Promise<void> {
    this.keys.delete(provider);
    if (this.useKeychain) {
      try {
        const keytar = require('keytar');
        await keytar.deletePassword('coding-agent-harness', provider);
      } catch { /* keychain delete failed */ }
    }
  }

  async status(): Promise<Record<string, 'configured' | 'not configured'>> {
    const providers = ['openai', 'anthropic', 'openai-compat'];
    const result: Record<string, 'configured' | 'not configured'> = {};
    for (const p of providers) {
      const key = await this.get(p);
      result[p] = key ? 'configured' : 'not configured';
    }
    return result;
  }

  async loadApiKeys(): Promise<Record<string, string>> {
    const keys: Record<string, string> = {};
    const providers = ['openai', 'anthropic', 'openai-compat'];
    for (const p of providers) {
      const key = await this.get(p);
      if (key) keys[p] = key;
    }
    if (process.env.OPENAI_API_KEY && !keys['openai']) keys['openai'] = process.env.OPENAI_API_KEY;
    if (process.env.ANTHROPIC_API_KEY && !keys['anthropic']) keys['anthropic'] = process.env.ANTHROPIC_API_KEY;
    if (process.env.OPENAI_COMPAT_API_KEY && !keys['openai-compat']) keys['openai-compat'] = process.env.OPENAI_COMPAT_API_KEY;
    return keys;
  }
}