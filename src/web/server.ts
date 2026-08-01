import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../config/loader';
import { MemoryManager } from '../memory';
import { CredentialManager } from '../credentials/manager';
import chalk from 'chalk';

export function startWebServer(port: number, credManager: CredentialManager): void {
  const config = loadConfig();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (req.url === '/' || req.url === '/index.html') {
      const html = getDashboardHtml();
      res.end(html);
      return;
    }

    if (req.url === '/api/status') {
      const credStatus = await credManager.status();
      const configSummary = {
        provider: config.llm.provider,
        model: config.llm.model,
        maxIterations: config.loop.maxIterations,
        workspaceRoot: config.tools.workspaceRoot,
      };
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ credentials: credStatus, config: configSummary, uptime: process.uptime() }));
      return;
    }

    if (req.url === '/api/memory') {
      try {
        const memory = new MemoryManager({
          sessionDbPath: config.memory.sessionDbPath,
          projectDbPath: config.memory.projectDbPath,
          workingMemoryRounds: config.memory.workingMemoryRounds,
          sessionMemoryExpireDays: config.memory.sessionMemoryExpireDays,
          retrievalTopK: config.memory.retrievalTopK,
        });
        const sessions = memory.getSessionStore().getBySession('') || [];
        const allEntries = sessions.length > 0 ? sessions : [];
        memory.close();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ entries: allEntries, count: allEntries.length }));
      } catch {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ entries: [], count: 0 }));
      }
      return;
    }

    if (req.url === '/api/config') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(config));
      return;
    }

    res.statusCode = 404;
    res.end('<h1>404 Not Found</h1>');
  });

  server.listen(port, () => {
    console.log(chalk.green(`\n[Harness Web] 管理面板已启动: http://localhost:${port}`));
    console.log(chalk.gray(`[Harness Web] 按 Ctrl+C 停止服务\n`));
  });
}

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Coding Agent Harness - 管理面板</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; min-height: 100vh; }
.header { background: #161b22; border-bottom: 1px solid #30363d; padding: 16px 24px; }
.header h1 { font-size: 20px; color: #58a6ff; }
.header p { font-size: 12px; color: #8b949e; margin-top: 4px; }
.container { max-width: 1200px; margin: 24px auto; padding: 0 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; }
.card h2 { font-size: 16px; color: #58a6ff; margin-bottom: 16px; border-bottom: 1px solid #30363d; padding-bottom: 8px; }
.card h3 { font-size: 13px; color: #8b949e; margin-bottom: 8px; }
.stat-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #21262d; }
.stat-label { color: #8b949e; }
.stat-value { color: #c9d1d9; font-family: monospace; }
.stat-value.green { color: #3fb950; }
.stat-value.red { color: #f85149; }
.stat-value.yellow { color: #d2991d; }
.full-width { grid-column: 1 / -1; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid #21262d; }
th { color: #8b949e; font-weight: 600; }
tr:hover { background: #1c2128; }
.status-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
.status-badge.configured { background: #1b3a1b; color: #3fb950; }
.status-badge.not-configured { background: #3a1b1b; color: #f85149; }
.btn { background: #238636; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn:hover { background: #2ea043; }
.btn.danger { background: #da3633; }
.btn.danger:hover { background: #f85149; }
.refresh { margin-bottom: 12px; }
</style>
</head>
<body>
<div class="header">
  <h1>Coding Agent Harness</h1>
  <p>管理面板 - 会话监控 / 记忆管理 / 配置查看</p>
</div>
<div class="container">
  <div class="card">
    <h2>系统状态</h2>
    <div id="status-content">加载中...</div>
  </div>
  <div class="card">
    <h2>凭据配置</h2>
    <div id="creds-content">加载中...</div>
  </div>
  <div class="card full-width">
    <h2>配置信息</h2>
    <div id="config-content">加载中...</div>
  </div>
  <div class="card full-width">
    <h2>记忆条目</h2>
    <button class="btn refresh" onclick="loadMemory()">刷新</button>
    <div id="memory-content">加载中...</div>
  </div>
</div>
<script>
async function loadAll() {
  try {
    const resp = await fetch('/api/status');
    const data = await resp.json();
    renderStatus(data);
    renderCredentials(data.credentials);
    renderConfig(data.config);
  } catch(e) { console.error(e); }
  loadMemory();
}
async function loadMemory() {
  try {
    const resp = await fetch('/api/memory');
    const data = await resp.json();
    renderMemory(data);
  } catch(e) { document.getElementById('memory-content').innerHTML = '加载失败'; }
}
function renderStatus(data) {
  document.getElementById('status-content').innerHTML = [
    ['供应商', data.config.provider],
    ['模型', data.config.model],
    ['最大迭代', data.config.maxIterations],
    ['工作区', data.config.workspaceRoot],
    ['运行时间', Math.floor(data.uptime) + '秒'],
  ].map(([l, v]) => '<div class="stat-row"><span class="stat-label">'+l+'</span><span class="stat-value">'+v+'</span></div>').join('');
}
function renderCredentials(creds) {
  document.getElementById('creds-content').innerHTML = Object.entries(creds).map(([k, v]) => {
    const cls = v === 'configured' ? 'configured' : 'not-configured';
    return '<div class="stat-row"><span class="stat-label">'+k+'</span><span class="stat-value"><span class="status-badge '+cls+'">'+v+'</span></span></div>';
  }).join('');
}
function renderConfig(config) {
  document.getElementById('config-content').innerHTML = [
    ['LLM Provider', config.llm?.provider],
    ['Model', config.llm?.model],
    ['Max Tokens', config.llm?.maxTokens],
    ['Temperature', config.llm?.temperature],
    ['Max Iterations', config.loop?.maxIterations],
    ['Max Context Tokens', config.loop?.maxContextTokens],
    ['Max Consecutive Failures', config.loop?.maxConsecutiveFailures],
    ['Workspace Root', config.tools?.workspaceRoot],
    ['Working Memory Rounds', config.memory?.workingMemoryRounds],
    ['Session DB', config.memory?.sessionDbPath],
    ['Project DB', config.memory?.projectDbPath],
  ].map(([l, v]) => '<div class="stat-row"><span class="stat-label">'+l+'</span><span class="stat-value">'+v+'</span></div>').join('');
}
function renderMemory(data) {
  if (!data.entries || data.entries.length === 0) {
    document.getElementById('memory-content').innerHTML = '<p style="color:#8b949e;font-size:13px">暂无记忆条目</p>';
    return;
  }
  const rows = data.entries.map(e => '<tr><td>'+e.type+'</td><td>'+e.content+'</td><td>'+e.keywords+'</td><td>'+new Date(e.timestamp).toLocaleString()+'</td><td>'+(e.confidence*100).toFixed(0)+'%</td></tr>').join('');
  document.getElementById('memory-content').innerHTML = '<table><thead><tr><th>类型</th><th>内容</th><th>关键词</th><th>时间</th><th>置信度</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
loadAll();
</script>
</body>
</html>`;
}