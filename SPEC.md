# SPEC: Coding Agent Harness

> 一个 TypeScript/Node.js 实现的 Coding Agent Harness，能读写代码、执行命令、运行测试，并根据测试结果自我修正。Agent = LLM + Harness，Harness 提供决策封装、工具分发、治理护栏、反馈闭环、记忆系统、声明式配置。

---

## 1. 问题陈述

### 要解决的问题

LLM 只能"决定下一步做什么"，但无法自主作用于外部世界。要让 LLM 成为一个可靠的 Coding Agent，需要一套工程化的 Harness 来封装：组织上下文、调用 LLM、解析并执行动作、拦截危险操作、收集客观反馈信号驱动自我修正、跨会话记忆。

### 目标用户

- 在本地使用 AI 辅助编码的开发者
- 需要确定性、可审计的 AI 编码行为的工程团队

### 为什么值得做

当前市面上的 Coding Agent（Claude Code、Codex CLI、Cursor）将 Harness 作为黑盒封装。本项目通过从零构建一个 Harness，揭示"Agent = LLM + Harness"这一公式中工程部分的全部细节，特别是记忆/上下文工程这一维度。

---

## 2. 用户故事

| # | 用户故事 | INVEST 检查 |
|---|---------|------------|
| US1 | 作为开发者，我希望通过 CLI 输入一个编码任务，Harness 能自动调用 LLM 分析任务、生成代码、运行测试，并在测试失败时自动修正，直到测试通过。 | I(独立), N(可协商), V(有价值), E(可估算), S(小), T(可测试) |
| US2 | 作为开发者，我希望 Harness 在执行危险命令（如 rm -rf、DROP TABLE）时暂停并要求我人工确认，防止误操作。 | 同上 |
| US3 | 作为开发者，我希望 Harness 能记住我在项目中设定的编码规范和历史决策，在新的会话中自动应用这些约定。 | 同上 |
| US4 | 作为开发者，我希望 Harness 支持多个 LLM 供应商（OpenAI、Anthropic 等），并能通过配置文件切换。 | 同上 |
| US5 | 作为开发者，我希望在首次使用 Harness 时能安全地录入我的 API Key，之后无需重复输入，且 Key 不会被泄露到源码、日志或终端历史中。 | 同上 |
| US6 | 作为开发者，我希望 Harness 的核心机制（护栏、反馈、记忆）能用 mock LLM 进行确定性单元测试，不依赖真实 LLM 和网络。 | 同上 |

---

## 3. 功能规约

### 3.1 Agent 主循环 (`src/core/loop.ts`)

**输入**：用户任务描述（string）、配置对象（Config）

**行为**：
1. 初始化对话消息列表（含 system prompt + 用户任务）
2. 循环（最多 `config.loop.maxIterations` 次）：
   a. 调用 `contextAssembler.assemble()` 注入记忆 → 组装完整上下文
   b. 调用 `llmProvider.chat()` → 获取 LLM 响应
   c. 调用 `parser.parse()` → 解析为 Action（tool_call / stop / invalid）
   d. 若 `stop`：返回成功结果
   e. 若 `invalid`：注入错误反馈，继续下一轮
   f. 调用 `guard.check()` → 护栏检查
   g. 若被拦截：注入拦截反馈，继续下一轮
   h. 若需审批：调用 HITL 请求人工确认，不通过则继续
   i. 调用 `executor.execute()` → 执行动作
   j. 调用 `feedbackValidator.validate()` → 获取客观反馈
   k. 将反馈注入消息列表
   l. 若 `feedback.shouldStop`：返回结果
3. 达到最大迭代次数：返回超时失败

**输出**：`LoopResult { success: boolean; reason: string; iterations: number }`

**边界条件**：空任务输入拒绝；配置缺失时使用默认值

**错误处理**：LLM 调用失败重试 3 次后终止；工具执行异常捕获后作为错误反馈注入

### 3.2 LLM 抽象层 (`src/core/llm/`)

**输入**：`ChatRequest { messages, tools, maxTokens, temperature }`

**行为**：根据 `config.llm.provider` 选择适配器，归一化 tool-calling 格式，调用供应商 API

**输出**：`ChatResponse { content, toolCalls, finishReason }`

**支持的供应商**：
- OpenAI（GPT-4o, GPT-4.1）
- Anthropic（Claude 3.5/4 Sonnet）
- OpenAI 兼容格式（DeepSeek、通义千问等）
- Mock（用于测试）

**边界条件**：未配置凭据时抛出明确错误；不支持的供应商报错

**错误处理**：网络超时 30s；HTTP 4xx/5xx 重试 3 次，指数退避

### 3.3 动作解析器 (`src/core/parser.ts`)

**输入**：`ChatResponse`

**行为**：提取 tool_calls，归一化为统一 Action 格式；若 LLM 输出纯文本（无 tool call），尝试从文本中解析结构化动作

**输出**：`Action { type: 'tool_call' | 'stop' | 'invalid'; tool?: string; args?: Record<string,unknown>; reason?: string }`

**边界条件**：空响应 → invalid；JSON 解析失败 → invalid

### 3.4 护栏系统 (`src/core/guard.ts`)

**输入**：`Action`

**行为**：
1. 检查 `action.tool === 'shell'`：命令匹配危险模式列表 → `requiresApproval`
2. 检查 `action.tool === 'write_file' | 'read_file'`：路径超出工作区 → `blocked`
3. 其他：放行

**输出**：`GuardResult { blocked: boolean; requiresApproval: boolean; reason?: string }`

**危险模式列表**（可配置扩展）：
- `rm -rf /`, `rm -rf /*`, `rm -rf ~`, `rm -rf .`
- `DROP TABLE`, `DROP DATABASE`
- `git push --force` 到 main/master
- `curl | bash`, `eval`, `sudo`
- `:(){ :|:& };:` (fork bomb)

**边界条件**：空命令 → 放行；非 shell 工具 → 跳过命令检查

**HITL 审批状态机**：

当 `requiresApproval === true` 时，进入 HITL（Human-in-the-Loop）状态机：

```
状态: IDLE → WAITING → APPROVED → 继续执行
                    → DENIED  → 注入拒绝反馈，继续下一轮
                    → TIMEOUT → 注入超时拒绝反馈，继续下一轮
```

| 状态 | 描述 | 触发条件 | 后续行为 |
|------|------|---------|---------|
| IDLE | 正常执行中 | 护栏检查通过 | 无 HITL 介入 |
| WAITING | 等待人工审批 | 护栏返回 `requiresApproval=true` | 暂停循环，在 CLI 显示动作详情（工具、参数、危险原因），等待用户输入 |
| APPROVED | 用户批准 | 用户输入 `y`（60s 内） | 恢复循环，执行动作 |
| DENIED | 用户拒绝 | 用户输入 `n` 或非 `y` 的任意输入 | 注入拒绝反馈消息（`role: 'tool'`），不执行动作，继续下一轮迭代 |
| TIMEOUT | 审批超时 | 60s 内无用户输入 | 等同于 DENIED，注入超时拒绝反馈，默认安全策略 |

**HITL 输出**：`HITLResult { approved: boolean; reason: 'user_approved' | 'user_denied' | 'timeout' }`

**边界条件**：
- 用户在 WAITING 状态下按 Ctrl+C → 终止整个 loop，返回 cancelled 结果
- 连续 3 次被拒绝的同类动作 → 自动加入黑名单，本轮不再触发 HITL（直接 block）
- 非交互式环境（无 TTY）→ 自动拒绝，不等待用户输入

### 3.5 动作执行器 (`src/core/executor.ts`)

**输入**：`Action` + `ToolContext`

**支持的工具**：

| 工具 | 功能 | 边界 |
|------|------|------|
| `read_file` | 读取文件内容 | 路径限工作区 |
| `write_file` | 写入文件 | 路径限工作区；不存在则创建 |
| `shell` | 执行 shell 命令 | 经护栏检查；超时 60s |
| `run_test` | 执行测试命令 | 同 shell，额外解析输出 |

**输出**：`ToolResult { tool: string; stdout: string; stderr: string; exitCode: number; success: boolean }`

**错误处理**：命令超时 → 返回 timeout 错误；exitCode !== 0 → success=false 但正常返回结果

### 3.6 反馈校验器 (`src/core/feedback.ts`)

**输入**：`ToolResult`

**行为**：
1. 若 `tool === 'run_test'`：解析测试输出，提取通过/失败用例
2. 若全部通过 → `verdict: 'pass'`, `shouldStop: true`
3. 若有失败 → `verdict: 'fail'`, `shouldStop: false`, 附带失败详情
4. 若无法解析测试输出 → `verdict: 'neutral'`, `shouldStop: false`

**输出**：`Feedback { verdict: 'pass' | 'fail' | 'neutral'; shouldStop: boolean; summary: string; failures?: TestFailure[] }`

**测试输出解析器**：支持 Jest / Mocha / Vitest 标准输出格式；提取失败用例名、错误信息、期望值 vs 实际值

**边界条件**：非 run_test 工具 → neutral；空 stdout → neutral + 警告

### 3.7 记忆系统 (`src/memory/`) —— 重点维度

整体架构见 §6「领域与机制设计」中的三层记忆模型。以下为记忆系统中两个关键管线模块的独立功能规约。

#### 3.7.1 上下文组装器 (`src/memory/context-injector.ts`)

**输入**：
- `messages: Message[]` —— 当前会话消息列表（L1 工作记忆）
- `sessionId: string` —— 当前会话 ID
- `config: MemoryConfig` —— 记忆配置（检索条数上限、注入位置等）

**行为**：
1. 从 L2（session-store）按关键词检索与当前任务相关的历史记忆条目
2. 从 L3（project-store）按语义检索相关代码库知识
3. 将检索结果格式化为结构化 context message（role: `'system'` 或 `'user'`）
4. 将 context message 注入消息列表——注入位置：system prompt 之后、最新用户消息之前
5. 估算注入后的总 token 数；若超过 `config.loop.maxContextTokens`，触发 `compressor` 压缩旧消息
6. 返回重组后的消息列表

**输出**：`Message[]` —— 注入记忆后的完整消息列表

**检索策略**：
- L2 检索：从当前用户消息中提取关键词 → 在 `session-store` 中按 `keywords` 字段匹配 → 按时间戳降序排列 → 取前 N 条（默认 5 条）
- L3 检索：对当前用户消息生成 embedding → 与 `project-store` 中的向量做余弦相似度计算 → 取 top-K（默认 3 条）

**边界条件**：
- 空消息列表 → 直接返回空列表
- 无匹配记忆 → 原样返回消息列表（不注入）
- 记忆条目内容过长（> 2000 字符）→ 截断并附加 `...(truncated)` 标记

**错误处理**：
- L2 检索失败（SQLite 异常）→ 跳过 L2 注入，记录警告，继续 L3 检索
- L3 检索失败（embedding 不可用）→ 跳过 L3 注入，仅注入 L2 结果
- token 估算失败 → 不做压缩，由 LLM 调用时的 API 错误兜底

#### 3.7.2 上下文压缩器 (`src/memory/compressor.ts`)

**输入**：
- `messages: Message[]` —— 待压缩的消息列表
- `maxTokens: number` —— 目标 token 上限
- `mode: 'truncate' | 'summarize'` —— 压缩模式

**行为**：

*截断模式（truncate，默认）*：
1. 保留 system prompt（首条消息）不动
2. 保留最近 N 条消息（N 由 `workingMemoryRounds` 配置）
3. 丢弃中间的最旧消息，直到总 token 数 ≤ `maxTokens`
4. 在被丢弃的位置插入一条占位消息：`role: 'system', content: '...[earlier messages truncated]...'`

*摘要模式（summarize，可选）*：
1. 将需要压缩的消息块发送给 LLM，请求生成摘要
2. 用摘要消息替换原始消息块
3. 摘要消息的 role 为 `'system'`

**输出**：`Message[]` —— 压缩后的消息列表

**边界条件**：
- 消息列表已 ≤ maxTokens → 原样返回
- 仅剩 system prompt 时仍超限 → 截断 system prompt 内容
- 摘要模式下 LLM 调用失败 → 降级为截断模式

**错误处理**：所有模式下的异常均降级为截断模式，确保不阻塞主循环

### 3.8 Web 管理面板 (`src/web/server.ts`)

**输入**：启动参数（端口号 `port`，默认 3456）、凭据管理器实例（`CredentialManager`）

**行为**：
1. 创建 HTTP 服务，监听指定端口
2. 根路径 `/` 返回管理面板 HTML 页面，包含以下模块：
   - **系统状态**：显示当前配置（LLM 供应商、模型、工作区路径）、服务运行时间
   - **凭据管理**：显示各供应商 API Key 的配置状态（已配置/未配置），不暴露明文
   - **记忆管理**：列出当前会话记忆条目（L2），支持按 sessionId 查看和删除；显示项目记忆条目数（L3）
   - **配置查看**：展示当前 `.harnessrc.json` 的完整配置内容
3. `/api/status` 端点：返回 JSON 格式的系统状态数据
4. `/api/credentials` 端点：返回凭据配置状态
5. `/api/memory` 端点：返回记忆条目列表，支持 `?sessionId=` 查询参数过滤
6. `/api/memory/delete` 端点（POST）：删除指定 sessionId 的记忆条目

**输出**：HTML 页面（`text/html; charset=utf-8`）或 JSON 响应（API 端点）

**边界条件**：
- 端口被占用 → 启动失败，输出错误信息并退出
- 凭据管理器未初始化 → 凭据状态显示"未配置"
- 记忆数据库不存在 → 记忆条目数显示为 0
- 无权限读取配置文件 → 配置查看区域显示错误提示

**错误处理**：
- HTTP 服务启动失败 → 输出错误信息到 stderr，退出码 1
- API 端点异常 → 返回 500 状态码 + JSON 错误信息
- 记忆数据库读取失败 → 返回空列表 + 警告日志

**验收标准**：
- `harness web` 启动后，浏览器访问 `http://localhost:3456` 可看到管理面板
- 管理面板显示正确的配置状态和凭据状态
- 已写入的记忆条目可在管理面板中查看
- 管理面板可删除指定会话的记忆

### 3.10 配置系统 (`src/config/`)

**配置文件**：`.harnessrc.json`，位于项目根目录或用户 home 目录

**配置项**：
- `llm.provider`（openai | anthropic | openai-compat | mock）
- `llm.model`（模型名）
- `llm.maxTokens`（默认 4096）
- `loop.maxIterations`（默认 50）
- `loop.maxContextTokens`（默认 128000）
- `tools.workspaceRoot`（默认当前目录）
- `tools.allowedCommands`（白名单，如空则全部允许）
- `tools.blockedPatterns`（额外危险模式）
- `memory.sessionDbPath`（默认 `.harness/session.db`）
- `memory.projectDbPath`（默认 `.harness/project.db`）
- `memory.workingMemoryRounds`（默认 10）

**加载优先级**：项目目录 `.harnessrc.json` > home 目录 `~/.harnessrc.json` > 默认值

### 3.11 凭据管理 (`src/credentials/`)

**存储方案**：使用 `keytar`（跨平台系统钥匙串）存储 API Key

**流程**：
1. 首次运行 → 检测无凭据 → 提示输入（隐藏回显）→ 存入系统钥匙串
2. 后续运行 → 从钥匙串读取 → 注入 LLM 适配器
3. 支持子命令：`harness key set`（录入）、`harness key status`（显示状态，不暴露明文）、`harness key delete`（清除）

**备选**：`.env` 文件加载（文档说明其明文风险）

**威胁模型**：

| 攻击面 | 威胁 | 钥匙串方案对策 | .env 方案风险 |
|--------|------|--------------|-------------|
| 磁盘存储 | 攻击者读取文件系统获取 Key | Key 存储在系统加密区域（Windows Credential Manager / macOS Keychain / Linux Secret Service），需用户登录凭证才能解密 | 明文存储在 `.env` 文件中，任何能读取该文件的进程均可获取 Key |
| 进程内存 | 恶意进程或内存 dump 提取 Key | Key 在内存中仅短暂持有（LLM 调用时），调用完成后可主动置零；但无法防御 root 权限的内存 dump | 同左，进程内存中始终存在 |
| 日志泄露 | 错误日志或调试输出中意外打印 Key | 在日志模块中实现 Key 脱敏——检测到 API Key 模式（`sk-...` 等）的字符串自动替换为 `***` 再写入日志 | 同左，需配合脱敏 |
| 终端历史 | `harness key set` 时的输入被 shell history 记录 | 使用隐藏回显输入（`stdin.setRawMode`），不经过 shell 的 readline history | 若通过 `export` 设置环境变量，命令会进入 shell history |
| Git 泄露 | Key 被意外提交到仓库 | `.gitignore` 中排除 `.env` 和 `.harness/` 目录；pre-commit hook 检查 staged 文件中是否包含 API Key 模式 | 同左，但 `.env` 文件若被误提交，Key 直接暴露在 Git 历史中 |
| 供应链攻击 | 恶意依赖包窃取 Key | `keytar` 是成熟的开源库，Key 只从钥匙串读取，不经过第三方；依赖最小化原则 | `.env` 文件可被任意依赖包通过 `fs.readFileSync` 读取 |
| 进程间通信 | 其他进程通过 `/proc` 或调试接口读取环境变量 | 钥匙串不暴露在环境变量中，需要显式调用 keytar API 才能读取 | 环境变量对所有子进程和同用户进程可见（`/proc/<pid>/environ`） |
| 备份与同步 | 备份软件或云同步服务无意中上传 Key | 钥匙串通常不在备份与同步范围内 | `.env` 若在项目目录中，可能被云同步（如 iCloud、Dropbox）上传 |

**威胁模型总结**：钥匙串方案将攻击面缩小到系统级安全（依赖操作系统用户认证），`.env` 方案将攻击面扩大到文件系统级（任何能读取文件的进程）。本项目以钥匙串为主方案，`.env` 为备选（在 README 中明确标注风险）。

---

## 4. 非功能性需求

### 性能

- 单轮 LLM 调用 + 执行周期 < 30s（不含 LLM 响应时间）
- 记忆检索 < 100ms（L2）、< 500ms（L3）
- 上下文组装 < 50ms

### 安全

- API Key 绝不硬编码、不提交 Git、不写入日志
- 危险命令执行前必须经护栏检查
- 文件操作限定在工作区范围内
- Shell 命令可配置白名单/黑名单

### 可用性

- CLI 提供清晰的进度提示（当前迭代轮次、执行的动作）
- 错误信息包含上下文（哪个阶段失败、为什么）
- 护栏审批提示清晰列出危险原因

### 可观测性

- 每轮迭代输出日志（含时间戳、动作类型、结果摘要）
- 可选 verbose 模式输出完整 LLM 请求/响应
- 会话结束后生成摘要报告

---

## 5. 系统架构

### 组件图

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Entry (index.ts)                      │
│  commands: run | key set/delete/status | web | memory forget/clean│
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT MAIN LOOP (loop.ts)                    │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ Context  │──▶│  LLM     │──▶│ Action   │──▶│ Guard    │     │
│  │Assembler │   │  Call    │   │ Parser   │   │Middleware│     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│        ▲                                             │           │
│        │   ┌──────────────────┐           ┌─────────▼────────┐  │
│        │   │  Memory Layer    │           │ Action Executor  │  │
│        │   │  (L1/L2/L3)      │           └────────┬─────────┘  │
│        │   └──────────────────┘                    │            │
│        │         ┌──────────────────────┐          │            │
│        └─────────│  Feedback Validator  │◀─────────┘            │
│                  └──────────────────────┘                       │
│                         │ (if fail)                              │
│                         ▼                                        │
│                  [Stop Judge] ──yes──▶ [Exit with Result]        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  Memory  │ │  Tools   │ │  Config  │
              │  Layer   │ │ Registry │ │  Loader  │
              │(SQLite)  │ │          │ │          │
              └──────────┘ └──────────┘ └──────────┘
```

### 数据流

```
用户输入 "实现一个计算器" 
  → loop 初始化消息 
  → contextAssembler 注入记忆 
  → llmProvider.chat() 
  → parser 解析出 write_file 动作 
  → guard 检查通过 
  → executor 写入文件 
  → feedback 返回 neutral 
  → 下一轮 LLM 决定 run_test 
  → executor 执行 npm test 
  → feedback 解析测试结果 
  → 若失败：失败信息注入消息，LLM 修正代码 
  → 若通过：shouldStop=true，loop 退出
```

### 外部依赖

- LLM 供应商 API（OpenAI / Anthropic / 兼容格式）
- `better-sqlite3`：SQLite 绑定（L2 记忆存储）
- `keytar`：跨平台系统钥匙串（凭据存储）
- `commander`：CLI 框架
- `chalk`：终端颜色输出

---

## 6. 领域与机制设计

> 对应 Coding Agent Harness 项目要求 §A.5

### 6.1 领域的反馈信号

Coding 领域的客观反馈信号是**测试结果**——确定、可回灌、不依赖 LLM 判断。

- **传感器**：`feedback.ts` 中的测试输出解析器
- **信号类型**：通过（pass）/ 失败（fail，含具体用例名、错误信息、期望 vs 实际）/ 中性（neutral）
- **回灌方式**：失败详情格式化为 `tool` role 消息注入对话，LLM 据此修正代码
- **确定性**：测试输出解析器是纯函数，可单测

### 6.2 危险动作

Coding 领域的危险动作集中在 **shell 命令** 和 **文件操作范围**：

- 危险 shell 命令：`rm -rf`、`DROP TABLE/DATABASE`、`git push --force`、管道注入、fork bomb
- 文件范围越界：读写工作区外的文件
- **护栏实现**：`guard.ts` 中的 `checkDanger()` 函数，正则匹配 + 路径检查，确定性代码，可单测

### 6.3 所需工具

| 工具 | 必要性 |
|------|--------|
| `read_file` | 读代码，理解上下文 |
| `write_file` | 写代码，实现功能 |
| `shell` | 执行任意命令（安装依赖、构建等） |
| `run_test` | 触发反馈闭环的核心工具 |

### 6.4 记忆需求与重点维度设计

**选择记忆/上下文工程为重点深入维度**，理由：
- 当前主流 Coding Agent 的记忆系统大多是黑盒，值得深入探索
- 三层记忆模型（L1/L2/L3）有清晰的工程边界，每层可独立实现与测试
- 存储与检索完全自己实现，不依赖任何框架的 memory 模块

**会话边界定义**：

"会话"（Session）是 Harness 中记忆隔离的基本单位。一次会话 = 从用户输入 `harness run "任务"` 开始到 loop 退出（通过/失败/超时/用户中断）为止的完整生命周期。

- **会话 ID 生成**：每次 `harness run` 启动时生成 UUID v4，作为本次会话的唯一标识
- **生命周期**：创建于 loop 初始化阶段，销毁于 loop 退出时（正常退出或异常退出均触发清理）
- **L2 隔离**：`session-store` 中所有记忆条目通过 `sessionId` 字段关联到特定会话；跨会话检索时，`session-retriever` 默认检索所有历史会话，但每条结果的 `sessionId` 字段允许调用方区分来源
- **L3 不隔离**：Project Memory 是项目级共享的，不绑定到特定会话；所有会话的代码库知识共享同一份 L3 存储
- **L1 不持久化**：Working Memory 仅在当前会话的内存中，会话结束后数据不保留（但 L2 中已持久化的条目不受影响）
- **会话清理**：默认不自动清理历史会话数据；用户可通过 `harness session clean` 命令手动清理指定会话或所有历史会话

**三层记忆模型**：

```
L1: Working Memory（工作记忆）
  - 当前会话的最近 N 轮对话
  - 内存中，会话结束即释放
  - 实现：src/memory/working-memory.ts（消息缓冲区）

L2: Session Memory（会话记忆）★ 重点
  - 存储：SQLite（better-sqlite3）
  - 内容：关键决策、用户反馈、项目约定、错误模式
  - 检索：结构化字段 + 关键词匹配 + 规则引擎
  - 实现：session-store.ts（CRUD）+ session-retriever.ts（检索）

L3: Project Memory（项目记忆）
  - 存储：自定义向量存储（Float32Array + 余弦相似度）
  - 内容：代码库摘要、文件索引、历史修复记录
  - 检索：语义检索，按需注入
  - 实现：project-store.ts（存储）+ project-retriever.ts（检索）
```

**记忆注入策略**（`context-injector.ts`）：
1. 每次 LLM 调用前，从 L2 检索相关历史决策和约定
2. 从 L3 检索与当前文件/模块相关的代码库知识
3. 合并 L1 最近消息
4. 注入 system prompt 或独立 context message
5. token 超限时触发 `compressor.ts` 压缩旧消息

**记忆写入时机**：

| 时机 | 写入内容 | 层级 |
|------|---------|------|
| 用户输入新任务 | 任务描述、时间戳 | L2 |
| 护栏拦截 | 被拦截命令 + 原因 | L2 |
| 测试通过 | 成功修复模式（失败→通过的 diff） | L2 |
| 测试失败 | 失败模式 + 错误信息 | L2 |
| 会话结束 | 会话摘要 + 关键决策列表 | L2 |
| 项目初始化 | 代码库结构索引 | L3 |
| 文件修改 | 文件摘要更新 | L3 |

**可测试性**（满足 mock LLM 单元测试要求）：
- `session-store.ts`：对 SQLite 的 CRUD，完全可单测
- `session-retriever.ts`：纯函数（输入查询词 → 输出匹配条目），完全可单测
- `context-injector.ts`：纯函数（输入消息+记忆 → 输出重组消息），完全可单测
- `compressor.ts`：摘要生成依赖 LLM，但可 mock 为截断策略，核心逻辑可单测
- L3 的 embedding 生成依赖 LLM API，但检索逻辑可单测

### 6.5 机制编码实现（呼应 §A.4）

| 机制 | 编码方式 | 可单测性 |
|------|---------|---------|
| 主循环 | `loop.ts` 编排管线，mock LLM 注入 | 通过 mock LLM 脚本模式验证 |
| 工具分发 | `executor.ts` + `registry.ts`，工具接口统一 | 模拟 ToolResult 输入验证 |
| 护栏 | `guard.ts` 确定性正则匹配 + 路径检查 | `guard(Action(command="rm -rf /"))` 断言拦截 |
| 反馈 | `feedback.ts` 测试输出解析器（纯函数） | 输入模拟 stdout 断言解析结果 |
| 记忆 | SQLite 存储 + 关键词检索 + 纯函数注入 | 不依赖真实 LLM |
| 配置 | JSON 文件加载 + 合并 + 验证 | 纯函数测试 |

---

## 7. 数据模型

### Session

```typescript
interface Session {
  id: string;            // UUID v4
  task: string;          // 用户原始任务描述
  status: 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
  iterations: number;    // 已执行的迭代轮次
  startedAt: number;     // Unix 时间戳
  endedAt?: number;      // 结束时间戳（未结束时为 undefined）
}
```

### SessionMemory (L2)

```typescript
interface SessionMemoryEntry {
  id: number;            // 自增主键
  sessionId: string;     // 会话 UUID（外键关联 Session.id）
  type: 'task' | 'decision' | 'convention' | 'error' | 'guard_block' | 'test_result';
  content: string;       // 主要内容
  metadata: string;      // JSON 格式的附加元数据
  keywords: string;      // 逗号分隔的关键词（用于检索）
  confidence: number;    // 置信度 0-1，默认 1.0；被用户否决则降低
  timestamp: number;     // Unix 时间戳
}
```

### ProjectMemory (L3)

```typescript
interface ProjectMemoryEntry {
  id: string;            // UUID
  type: 'file_summary' | 'module_summary' | 'fix_pattern';
  path: string;          // 关联的文件/模块路径
  content: string;       // 摘要文本
  embedding: Float32Array; // 向量（维度取决于 embedding 模型）
  timestamp: number;
}
```

### Action

```typescript
interface Action {
  type: 'tool_call' | 'stop' | 'invalid';
  tool?: string;
  args?: Record<string, unknown>;
  reason?: string;
}
```

### Feedback

```typescript
interface Feedback {
  verdict: 'pass' | 'fail' | 'neutral';
  shouldStop: boolean;
  summary: string;
  failures?: TestFailure[];
}

interface TestFailure {
  testName: string;
  error: string;
  expected?: string;
  actual?: string;
}
```

---

## 8. 技术选型与理由

| 技术 | 选型 | 理由 |
|------|------|------|
| 语言 | TypeScript | 强类型适合状态机与抽象层；npm 生态丰富；与项目"通过 Superpowers 构建"的演示目标一致 |
| 运行时 | Node.js 20+ | LTS 版本，稳定；`better-sqlite3` 原生支持好 |
| LLM SDK | 直接调用 HTTP API（fetch） | 避免依赖特定 SDK，实现真正的多供应商抽象；mock 层更简单 |
| 数据库 | SQLite (better-sqlite3) | 零配置、嵌入式，适合 CLI 工具；同步 API 代码更简洁 |
| 凭据存储 | keytar | 跨平台系统钥匙串，满足安全要求 |
| CLI 框架 | commander | 轻量、成熟、TypeScript 支持好 |
| 测试框架 | Vitest | 快、TypeScript 原生支持、兼容 Jest API |
| 向量存储 | 自定义实现 | 满足"自己实现，不寄生框架"的要求 |
| 分发 | Docker + npm | Docker 确保环境一致；npm 方便开发者直接安装 |

### Web 管理面板

项目包含一个基于 Node.js HTTP 的 Web 管理面板（`harness web` 命令），用于查看系统状态、凭据配置、记忆条目和运行参数。这满足了通用要求中对 WebUI 接口的要求，同时保持了 CLI 作为主要交互方式的设计定位。

---

## 9. 验收标准

| 功能 | 验收标准 |
|------|---------|
| 主循环 | mock LLM 下完成 3 轮迭代（读文件→写文件→运行测试），测试通过后停机 |
| 护栏 | 传入 `shell: "rm -rf /"` 被拦截并提示审批；传入正常命令放行 |
| 反馈闭环 | 注入测试失败，agent 下一轮动作包含修正代码的 write_file |
| 记忆（L2） | 会话结束后，新会话能检索到上次会话的项目约定 |
| 记忆（L3） | 项目初始化后，能检索到与当前任务相关的代码文件摘要 |
| 多供应商 | 切换配置中的 provider 字段，能分别调用 OpenAI 和 Anthropic |
| 凭据安全 | `harness key set` 录入，`harness key status` 不显示明文，key 不在源码中 |
| 分发 | `docker build && docker run` 可运行；`npm install -g` 可运行 |
| mock 测试 | 护栏、反馈、记忆检索、上下文注入 4 个模块的单元测试在 mock LLM 下通过 |
| 机制演示 | 三个演示脚本可确定性地复现：护栏拦截、反馈闭环、记忆检索 |
| Web 管理面板 | `harness web` 启动后可访问管理面板，显示系统状态、凭据配置、记忆条目 |

---

## 10. 风险与未决问题

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 输出格式不稳定 | 解析器无法提取 tool call | 容错解析 + 错误反馈注入 + 重试机制 |
| 关键第三方库（keytar）跨平台兼容性 | 凭据存储在 Windows/macOS/Linux 行为不一致 | 提供 .env 兜底方案，CI 中使用环境变量 |
| L3 向量存储性能 | 自定义实现在大规模代码库下检索慢 | 设定合理范围（单项目索引），超出时降级为关键词检索 |
| LLM 陷入无限修正循环 | 测试始终不通过，消耗 token | 最大迭代次数硬限制 + 连续失败次数阈值（3 次连续失败 → 停机） |
| better-sqlite3 原生编译 | 在某些环境下 npm install 失败 | Docker 镜像预装编译工具；npm 包提供 prebuild 二进制 |
| 记忆污染 | 错误或低质量的记忆条目（如错误修复模式、无效约定）被检索并注入 LLM 上下文，导致 agent 做出错误决策，且错误记忆会自我强化 | ① 记忆条目写入时记录置信度，检索时过滤低置信度条目；② 提供 `harness memory forget <id>` 命令手动删除污染条目；③ 会话级记忆（L2）可配置过期时间（默认 30 天），过期条目自动清理；④ 重复被用户否决的决策模式，自动降低置信度 |

### 已决策

1. **embedding 模型**：L3 向量存储使用 OpenAI `text-embedding-3-small`，在 mock 模式下使用随机向量替代。检索逻辑（余弦相似度）不依赖具体 embedding 来源。
2. **上下文压缩策略**：compressor 实现两种模式——简单截断（默认，仅保留最近 N 条消息）和 LLM 摘要（可选，config 中启用）。截断模式可完全 mock 测试。
3. **多轮自我修正上限**：连续 3 次测试失败后强制停机，防止无限修正循环。此阈值在 config 中可配置。此机制在 mock LLM 下可单测。

---

## 11. 机制演示要求

> 对应 §A.6

三个演示脚本（`demos/` 目录），使用 mock LLM 确定性地复现：

### 演示 ①：护栏拦截危险动作

```typescript
// demos/guard-demo.ts
// 构造 Action { tool: 'shell', args: { command: 'rm -rf /' } }
// 调用 guard.check(action)
// 断言：blocked=false, requiresApproval=true, reason 包含 'rm -rf'
// 构造正常 Action { tool: 'shell', args: { command: 'npm test' } }
// 断言：blocked=false, requiresApproval=false
```

### 演示 ②：反馈闭环

```typescript
// demos/feedback-demo.ts
// 使用 mock LLM（脚本模式）：
//   第 1 轮：LLM 输出 write_file（写有 bug 的代码）
//   第 2 轮：LLM 输出 run_test
//   feedback 解析测试输出 → 发现失败 → 注入反馈
//   第 3 轮：LLM 收到反馈后输出 write_file（修正代码）
// 断言：第 3 轮动作是 write_file 且内容包含修正
```

### 演示 ③：记忆检索（重点维度）

```typescript
// demos/memory-demo.ts
// 写入 L2 记忆条目（项目约定："使用 tabs 缩进"）
// 初始化 context-injector
// 查询与"缩进"相关的记忆
// 断言：检索结果包含"使用 tabs 缩进"
// 验证 context-injector 正确将记忆注入消息列表
```

---

## 12. 凭据与分发设计

### 凭据存储

- 主方案：`keytar` 存入系统钥匙串（Windows Credential Manager / macOS Keychain / Linux Secret Service）
- 备选方案：`.env` 文件（明文风险在 README 中说明）
- 首次运行引导：`harness key set` 交互式录入（隐藏回显）
- 状态查看：`harness key status` 显示"OpenAI: configured / not configured"，不暴露明文
- 清除：`harness key delete` 删除存储的凭据

### 分发

**npm 包**：
```bash
npm install -g coding-agent-harness
harness run "实现一个计算器"
```

**Docker 镜像**：
```bash
docker build -t coding-agent-harness .
docker run -v $(pwd):/workspace -e OPENAI_API_KEY=$OPENAI_API_KEY coding-agent-harness run "任务"
```

**CI 构建**：GitHub Actions 在每次 push 时运行测试，并在 tag 时构建并推送 Docker 镜像到 GitHub Container Registry。

### 云部署

**目标平台**：Render（免费版），支持从 GitHub 仓库直接导入 Node.js 项目。

**部署架构**：
```
Render Cloud
├── Web Service (Node.js)
│   ├── Build: npm ci && npm run build
│   ├── Start: node dist/src/index.js web
│   └── Port: 3456 (Render 自动映射到 80/443)
└── Public URL: https://<app-name>.onrender.com
```

**线上访问**：Web 管理面板通过 Render 提供的公网 URL 访问，支持 HTTPS。

**已知限制**：Render 免费版在 15 分钟无流量后自动休眠，首次访问需等待 1-2 分钟唤醒。

**备选平台**：Railway、Vercel（需配置 serverless 适配）、阿里云 ECS、腾讯云 CloudBase。

---

## 附录：项目目录结构

```
coding-agent-harness/
├── src/
│   ├── index.ts                  # CLI 入口
│   ├── core/
│   │   ├── loop.ts               # 主循环
│   │   ├── parser.ts             # 动作解析
│   │   ├── guard.ts              # 护栏
│   │   ├── executor.ts           # 动作执行
│   │   ├── feedback.ts           # 反馈校验
│   │   └── llm/
│   │       ├── types.ts
│   │       ├── openai.ts
│   │       ├── anthropic.ts
│   │       ├── openai-compat.ts
│   │       ├── mock.ts
│   │       └── factory.ts
│   ├── memory/                   # ★ 重点维度
│   │   ├── types.ts
│   │   ├── working-memory.ts
│   │   ├── session-store.ts
│   │   ├── session-retriever.ts
│   │   ├── project-store.ts
│   │   ├── project-retriever.ts
│   │   ├── context-injector.ts
│   │   ├── compressor.ts
│   │   ├── embedding.ts
│   │   └── index.ts
│   ├── tools/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── read-file.ts
│   │   ├── write-file.ts
│   │   ├── shell.ts
│   │   └── run-test.ts
│   ├── config/
│   │   ├── loader.ts
│   │   └── types.ts
│   ├── credentials/
│   │   └── manager.ts
│   └── web/
│       └── server.ts
├── tests/
│   ├── cli.test.ts
│   ├── demos.test.ts
│   ├── core/
│   │   ├── loop.test.ts
│   │   ├── parser.test.ts
│   │   ├── guard.test.ts
│   │   ├── executor.test.ts
│   │   ├── feedback.test.ts
│   │   ├── adapters.test.ts
│   │   ├── mock-llm.test.ts
│   │   └── llm-factory.test.ts
│   ├── config/
│   │   └── loader.test.ts
│   ├── credentials/
│   │   └── manager.test.ts
│   ├── memory/
│   │   ├── working-memory.test.ts
│   │   ├── session-store.test.ts
│   │   ├── session-retriever.test.ts
│   │   ├── context-injector.test.ts
│   │   ├── compressor.test.ts
│   │   ├── memory-manager.test.ts
│   │   └── embedding.test.ts
│   └── tools/
│       ├── registry.test.ts
│       └── shell.test.ts
├── demos/
│   ├── guard-demo.ts
│   ├── feedback-demo.ts
│   └── memory-demo.ts
├── Dockerfile
├── package.json
├── tsconfig.json
├── .github/workflows/ci.yml
├── .gitlab-ci.yml
├── SPEC.md
├── PLAN.md
├── SPEC_PROCESS.md
├── AGENT_LOG.md
├── REFLECTION.md
└── README.md
```