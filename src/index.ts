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
import { MemoryManager } from './memory';
import { CredentialManager } from './credentials/manager';
import chalk from 'chalk';

const credManager = new CredentialManager();

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

    const apiKeys = await credManager.loadApiKeys();
    const llm = createLLMProvider(config, apiKeys);

    const registry = new ToolRegistry();
    registry.register(readFileTool);
    registry.register(writeFileTool);
    registry.register(shellTool);
    registry.register(runTestTool);
    console.log(chalk.gray(`[Harness] 已注册 ${registry.getDefinitions().length} 个工具`));

    const memory = new MemoryManager({
      sessionDbPath: config.memory.sessionDbPath,
      projectDbPath: config.memory.projectDbPath,
      workingMemoryRounds: config.memory.workingMemoryRounds,
      sessionMemoryExpireDays: config.memory.sessionMemoryExpireDays,
      retrievalTopK: config.memory.retrievalTopK,
    });

    const startTime = Date.now();
    const result = await runLoop(task, config, llm, registry, memory);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success) {
      console.log(chalk.green(`[Harness] 任务完成，共 ${result.iterations} 轮迭代 (${elapsed}s)`));
    } else {
      console.log(chalk.red(`[Harness] 任务失败: ${result.reason} (${result.iterations} 轮迭代, ${elapsed}s)`));
    }

    memory.close();
  });

const keyCmd = program
  .command('key')
  .description('API Key 管理');

keyCmd
  .command('set <provider>')
  .description('设置 API Key (openai|anthropic|openai-compat)')
  .action(async (provider: string) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(`请输入 ${provider} 的 API Key: `);
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.on('data', (data: Buffer) => {
      const str = data.toString();
      if (str === '\r' || str === '\n') {
        process.stdin.setRawMode(false);
        rl.close();
        process.stdout.write('\n');
        (async () => {
          await credManager.set(provider, input.trim());
          console.log(chalk.green(`[Harness] ${provider} API Key 已保存`));
          process.exit(0);
        })();
      } else if (str === '\u0003') {
        process.exit(0);
      } else {
        input += str;
        process.stdout.write('*');
      }
    });
  });

keyCmd
  .command('delete <provider>')
  .description('删除指定供应商的 API Key')
  .action(async (provider: string) => {
    await credManager.delete(provider);
    console.log(chalk.green(`[Harness] ${provider} API Key 已删除`));
  });

keyCmd
  .command('status')
  .description('查看 API Key 配置状态')
  .action(async () => {
    const status = await credManager.status();
    for (const [provider, state] of Object.entries(status)) {
      console.log(chalk.gray(`${provider}: ${state === 'configured' ? chalk.green('已配置') : chalk.yellow('未配置')}`));
    }
  });

program
  .command('web')
  .description('启动 Web 管理面板')
  .option('-p, --port <port>', '端口号', '3456')
  .action(async (options: { port: string }) => {
    const { startWebServer } = await import('./web/server');
    startWebServer(parseInt(options.port, 10), credManager);
  });

program.parse();