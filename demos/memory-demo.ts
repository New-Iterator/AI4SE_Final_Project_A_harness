import { MemoryManager } from '../src/memory';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

async function main() {
  console.log('=== 记忆演示 ===');

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
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);