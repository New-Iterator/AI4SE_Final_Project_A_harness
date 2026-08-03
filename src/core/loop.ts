import type { LoopResult, Message } from '../types';
import type { Config } from '../config/types';
import type { LLMProvider, ToolDefinition, ChatResponse } from './llm/types';
import type { ToolRegistry } from '../tools/registry';
import type { MemoryManager } from '../memory';
import { parseAction, parseActionWithWarnings } from './parser';
import { checkGuard } from './guard';
import { executeAction } from './executor';
import { validateFeedback } from './feedback';
import { randomUUID } from 'crypto';
import { createInterface } from 'readline';

export async function runLoop(
  task: string,
  config: Config,
  llm: LLMProvider,
  registry: ToolRegistry,
  memory?: MemoryManager
): Promise<LoopResult> {
  if (!task || task.trim().length === 0) {
    return { success: false, reason: '空任务输入', iterations: 0 };
  }

  const sessionId = randomUUID();
  if (memory) {
    memory.record(sessionId, 'task', task, {}, 'task,start');
  }
  const wm = memory?.getWorkingMemory();
  const blacklist = new Map<string, number>();
  const startTime = Date.now();

  let cancelled = false;
  const sigintHandler = () => {
    cancelled = true;
    if (memory) {
      memory.record(sessionId, 'decision', '用户中断 (Ctrl+C)', {}, 'interrupt,cancelled');
    }
  };
  process.on('SIGINT', sigintHandler);

  if (wm) {
    wm.clear();
    wm.add({
      role: 'system',
      content: `你是一个编码智能体。你可以读写文件、执行 shell 命令和运行测试。
工作区: ${config.tools.workspaceRoot}
当测试通过时停止。当测试失败时，修复代码并重新运行测试。`,
    });
    wm.add({ role: 'user', content: task });
  }

  let messages: Message[] = [
    {
      role: 'system',
      content: `你是一个编码智能体。你可以读写文件、执行 shell 命令和运行测试。
工作区: ${config.tools.workspaceRoot}
当测试通过时停止。当测试失败时，修复代码并重新运行测试。`,
    },
    { role: 'user', content: task },
  ];

  const tools: ToolDefinition[] = registry.getDefinitions();
  let consecutiveFailures = 0;
  let currentFilePath: string | undefined;

  for (let i = 0; i < config.loop.maxIterations; i++) {
    if (cancelled) {
      process.removeListener('SIGINT', sigintHandler);
      return { success: false, reason: 'cancelled', iterations: i };
    }

    if (memory) {
      messages = await memory.injectContext(messages, sessionId, currentFilePath);
    }

    const response = await llmChatWithRetry(llm, { messages, tools, maxTokens: config.llm.maxTokens, temperature: config.llm.temperature });

    const { action, warnings } = parseActionWithWarnings(response);
    if (warnings && warnings.length > 0) {
      for (const w of warnings) {
        messages.push({ role: 'tool', content: w, toolCallId: 'warning' });
      }
    }

    if (action.type === 'stop') {
      if (memory) {
        memory.record(sessionId, 'decision', `任务完成: ${action.reason || 'Task completed'}`, {}, 'task,complete');
        memory.record(sessionId, 'decision', `会话结束: 成功 (${i + 1}轮)`, { iterations: i + 1 }, 'session,end');
      }
      process.removeListener('SIGINT', sigintHandler);
      return { success: true, reason: action.reason || '任务完成', iterations: i + 1 };
    }

    if (action.type === 'invalid') {
      messages.push({ role: 'assistant', content: null });
      messages.push({ role: 'tool', content: `错误: ${action.reason || '无效动作'}`, toolCallId: 'error' });
      if (memory) memory.record(sessionId, 'error', `无效动作: ${action.reason}`, {}, 'invalid,error');
      continue;
    }

    const blacklistKey = makeBlacklistKey(action);
    if (blacklistKey && (blacklist.get(blacklistKey) || 0) >= 3) {
      messages.push({ role: 'assistant', content: null });
      messages.push({ role: 'tool', content: `BLOCKED: 此动作已被黑名单拦截，请选择其他方式`, toolCallId: 'blacklist' });
      if (memory) memory.record(sessionId, 'guard_block', `黑名单拦截: ${blacklistKey}`, {}, 'blacklist,block');
      continue;
    }

    const guardResult = checkGuard(action, config.tools.workspaceRoot, config.tools.blockedPatterns, config.tools.allowedCommands);
    if (guardResult.blocked) {
      messages.push({ role: 'assistant', content: null });
      messages.push({ role: 'tool', content: `已拦截: ${guardResult.reason}`, toolCallId: 'guard' });
      if (memory) memory.record(sessionId, 'guard_block', `已拦截: ${guardResult.reason}`, {}, 'guard,block');
      continue;
    }
    if (guardResult.requiresApproval) {
      const approved = await requestApproval(action, guardResult);
      if (cancelled) {
        process.removeListener('SIGINT', sigintHandler);
        return { success: false, reason: 'cancelled', iterations: i + 1 };
      }
      if (approved === false) {
        const isTimeout = !process.stdin.isTTY;
        const msg = isTimeout ? `APPROVAL REQUIRED: ${guardResult.reason}. Timeout.` : `APPROVAL REQUIRED: ${guardResult.reason}. User denied.`;
        messages.push({ role: 'assistant', content: null });
        messages.push({ role: 'tool', content: msg, toolCallId: 'guard' });
        if (memory) memory.record(sessionId, 'hitl_denied', `审批被拒: ${guardResult.reason}`, {}, 'guard,denied');
        const key = makeBlacklistKey(action);
        if (key) {
          const count = (blacklist.get(key) || 0) + 1;
          blacklist.set(key, count);
        }
        continue;
      }
    }

    if (action.tool === 'read_file' || action.tool === 'write_file') {
      const args = action.args as any;
      currentFilePath = args?.path || args?.filePath || currentFilePath;
    }

    const tc = response.toolCalls[0];
    if (tc) {
      messages.push({ role: 'assistant', content: null, toolCalls: [tc] });
    }

    let toolResult;
    try {
      toolResult = await executeAction(action, registry, { workspaceRoot: config.tools.workspaceRoot });
    } catch (err: any) {
      toolResult = { tool: action.tool || 'unknown', stdout: '', stderr: err.message, exitCode: 1, success: false };
    }

    messages.push({ role: 'tool', content: toolResult.stdout || toolResult.stderr || '', toolCallId: tc?.id || 'unknown' });

    const feedback = validateFeedback(toolResult);

    if (feedback.verdict === 'pass' || feedback.shouldStop) {
      if (memory) {
        memory.record(sessionId, 'test_result', `测试通过: ${feedback.summary}`, {}, 'test,pass');
        memory.record(sessionId, 'decision', `会话结束: 测试通过 (${i + 1}轮)`, { iterations: i + 1 }, 'session,end');
      }
      process.removeListener('SIGINT', sigintHandler);
      return { success: true, reason: feedback.summary, iterations: i + 1 };
    }

    if (feedback.verdict === 'fail') {
      consecutiveFailures++;
      if (memory) {
        memory.record(sessionId, 'test_result', `测试失败: ${feedback.summary}`, {}, 'test,fail');
      }
      if (consecutiveFailures >= config.loop.maxConsecutiveFailures) {
        process.removeListener('SIGINT', sigintHandler);
        if (memory) {
          memory.record(sessionId, 'decision', `会话结束: 连续失败 (${i + 1}轮)`, { iterations: i + 1 }, 'session,end');
        }
        return { success: false, reason: `连续测试失败 ${consecutiveFailures} 次，提前停机`, iterations: i + 1 };
      }
      const fbMsg = `测试失败: ${feedback.summary}\n${feedback.failures?.map(f => `- ${f.testName}: ${f.error}`).join('\n') || ''}\n请修复代码并重试。`;
      messages.push({ role: 'user', content: fbMsg });
    } else {
      consecutiveFailures = 0;
    }
  }

  process.removeListener('SIGINT', sigintHandler);
  if (memory) {
    memory.record(sessionId, 'decision', `会话结束: 达到最大迭代次数 (${config.loop.maxIterations}次)`, { iterations: config.loop.maxIterations }, 'session,end');
  }
  return { success: false, reason: '达到最大迭代次数', iterations: config.loop.maxIterations };
}

async function llmChatWithRetry(
  llm: LLMProvider,
  request: { messages: Message[]; tools: ToolDefinition[]; maxTokens?: number; temperature?: number },
  maxRetries: number = 3
): Promise<ChatResponse> {
  const totalStart = Date.now();
  const TOTAL_TIMEOUT = 30000;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (Date.now() - totalStart > TOTAL_TIMEOUT) {
      throw new Error('LLM 调用总超时 30s');
    }
    try {
      return await llm.chat(request);
    } catch (err: any) {
      lastError = err;
      const is4xx = / [45]\d{2} /.test(err.message || '') || err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('404') || err.message?.includes('429');
      if (is4xx) throw err;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(Math.pow(2, attempt) * 1000, 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error('LLM 调用失败，已达最大重试次数');
}

async function requestApproval(action: any, guardResult: { reason?: string }): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n⚠ 危险动作需要审批:`);
  console.log(`  工具: ${action.tool}`);
  console.log(`  参数: ${JSON.stringify(action.args)}`);
  console.log(`  原因: ${guardResult.reason}`);
  console.log(`  输入 y 批准, n 拒绝 (60秒超时默认拒绝)`);

  return new Promise<boolean>(resolve => {
    const timeout = setTimeout(() => {
      console.log('  审批超时，已自动拒绝');
      rl.close();
      resolve(false);
    }, 60000);

    rl.question('', (answer: string) => {
      clearTimeout(timeout);
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function makeBlacklistKey(action: any): string | null {
  if (action.tool === 'shell') {
    return `shell:${action.args?.command || ''}`;
  }
  if (action.tool === 'write_file' || action.tool === 'read_file') {
    return `${action.tool}:${action.args?.filePath || ''}`;
  }
  const argsStr = action.args ? JSON.stringify(action.args) : '';
  return argsStr ? `${action.tool}:${argsStr}` : null;
}