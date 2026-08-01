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
  .description('Coding Agent Harness - AI 驱动的编码助手')
  .version('1.0.0');

program
  .command('run <task>')
  .description('运行编码任务')
  .action(async (task: string) => {
    const config = loadConfig();
    console.log(chalk.blue(`[Harness] 开始执行任务: ${task}`));
    console.log(chalk.gray(`[Harness] 供应商: ${config.llm.provider}, 模型: ${config.llm.model}`));

    const apiKeys = loadApiKeys();
    const llm = createLLMProvider(config, apiKeys);

    const registry = new ToolRegistry();
    registry.register(readFileTool);
    registry.register(writeFileTool);
    registry.register(shellTool);
    registry.register(runTestTool);
    console.log(chalk.gray(`[Harness] 已注册 ${registry.getDefinitions().length} 个工具`));

    const startTime = Date.now();
    const result = await runLoop(task, config, llm, registry);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success) {
      console.log(chalk.green(`[Harness] 任务完成，共 ${result.iterations} 轮迭代 (${elapsed}s)`));
    } else {
      console.log(chalk.red(`[Harness] 任务失败: ${result.reason} (${result.iterations} 轮迭代, ${elapsed}s)`));
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