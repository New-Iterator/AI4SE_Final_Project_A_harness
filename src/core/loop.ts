import type { LoopResult, Message } from '../types';
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
      content: `你是一个编码智能体。你可以读写文件、执行 shell 命令和运行测试。
工作区: ${config.tools.workspaceRoot}
当测试通过时停止。当测试失败时，修复代码并重新运行测试。`,
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
      messages.push({ role: 'tool', content: `已拦截: ${guardResult.reason}`, toolCallId: 'guard' });
      continue;
    }
    if (guardResult.requiresApproval) {
      messages.push({ role: 'assistant', content: null });
      messages.push({ role: 'tool', content: `需要审批: ${guardResult.reason}。用户已拒绝。`, toolCallId: 'guard' });
      continue;
    }

    const tc = response.toolCalls[0];
    messages.push({ role: 'assistant', content: null, toolCalls: [tc] });

    let toolResult;
    try {
      toolResult = await executeAction(action, registry, { workspaceRoot: config.tools.workspaceRoot });
    } catch (err: any) {
      toolResult = { tool: action.tool || 'unknown', stdout: '', stderr: err.message, exitCode: 1, success: false };
    }

    messages.push({ role: 'tool', content: toolResult.stdout || toolResult.stderr || '', toolCallId: tc.id });

    const feedback = validateFeedback(toolResult);

    if (feedback.verdict === 'pass') {
      return { success: true, reason: feedback.summary, iterations: i + 1 };
    }

    if (feedback.verdict === 'fail') {
      consecutiveFailures++;
      if (consecutiveFailures >= config.loop.maxConsecutiveFailures) {
        return { success: false, reason: `Max consecutive failures (${config.loop.maxConsecutiveFailures}) reached`, iterations: i + 1 };
      }
      const fbMsg = `测试失败: ${feedback.summary}\n${feedback.failures?.map(f => `- ${f.testName}: ${f.error}`).join('\n') || ''}\n请修复代码并重试。`;
      messages.push({ role: 'user', content: fbMsg });
    } else {
      consecutiveFailures = 0;
    }
  }

  return { success: false, reason: 'max_iterations_reached', iterations: config.loop.maxIterations };
}