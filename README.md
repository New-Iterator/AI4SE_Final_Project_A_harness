# Coding Agent Harness

一个基于 TypeScript/Node.js 的编码智能体框架（Coding Agent Harness），使 AI 能够自主修改代码、运行测试并根据测试结果自我修正。

## 架构

```
Agent = LLM + Harness

Harness = 上下文组装器 -> LLM 调用 -> 动作解析器 -> 护栏 -> 执行器 -> 反馈校验器 -> 循环
```

## 安装

### npm

```bash
# 从本地安装
npm install -g .
# 或使用 npm link
npm link
```

### Docker

```bash
docker build -t coding-agent-harness .
docker run -v $(pwd):/workspace -e OPENAI_API_KEY=$OPENAI_API_KEY coding-agent-harness run "你的任务"
```

## 使用方法

```bash
harness run "实现一个带测试的计算器函数"
```

### 记忆管理

```bash
harness memory forget <sessionId>   # 删除指定会话的记忆
harness memory clean                # 清理过期记忆条目
```

## API Key 配置

### 安全方式（推荐）

使用 `harness key set` 将密钥存储在操作系统钥匙串中：

```bash
harness key set openai
harness key status       # 查看配置状态
harness key delete openai # 删除指定 Key
```

### 环境变量（备选方案）

设置以下环境变量，或在项目根目录创建 `.env` 文件。注意：此方式以明文形式存储。

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_COMPAT_API_KEY`

## 配置文件

在项目根目录创建 `.harnessrc.json`（项目级配置），或在用户主目录创建 `~/.harnessrc.json`（全局配置）。项目级配置会覆盖全局配置。

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "maxTokens": 4096,
    "temperature": 0.7
  },
  "loop": {
    "maxIterations": 50,
    "maxConsecutiveFailures": 3,
    "maxContextTokens": 128000
  },
  "tools": {
    "workspaceRoot": "."
  },
  "memory": {
    "sessionDbPath": ".harness/session.db",
    "projectDbPath": ".harness/project.db",
    "workingMemoryRounds": 10,
    "sessionMemoryExpireDays": 30,
    "retrievalTopK": 5
  }
}
```

## 目录结构

```
src/
  index.ts              - CLI 入口
  types.ts              - 共享类型定义
  core/
    loop.ts             - 主循环
    parser.ts           - 动作解析器
    guard.ts            - 护栏系统
    executor.ts         - 动作执行器
    feedback.ts         - 反馈校验器
    llm/                - LLM 抽象层（mock、OpenAI、Anthropic、兼容格式）
  memory/               - 记忆系统（L1/L2/L3 三层记忆）
  tools/                - 工具实现（读文件/写文件/shell/运行测试）
  web/                  - Web 管理面板
  config/               - 配置加载器
  credentials/          - 凭据管理
tests/                  - 单元测试（mock LLM 驱动）
  core/                 - 核心模块测试
  memory/               - 记忆系统测试
  tools/                - 工具测试
  config/               - 配置测试
  credentials/          - 凭据测试
demos/                  - 机制演示脚本
  guard-demo.ts         - 护栏演示
  feedback-demo.ts      - 反馈闭环演示
  memory-demo.ts        - 记忆系统演示
```

## 测试

```bash
npm test                # 运行所有测试
npm run demo:guard      # 护栏演示
npm run demo:feedback   # 反馈闭环演示
npm run demo:memory     # 记忆系统演示
```

## Web 管理面板

启动 Web 管理面板，用于查看系统状态、凭据配置、运行参数和记忆条目：

```bash
harness web
# 管理面板即启动在 http://localhost:3456
```

自定义端口：

```bash
harness web --port 8080
```

**线上部署 URL**：**[https://ai4se-final-project-a-harness.onrender.com](https://ai4se-final-project-a-harness.onrender.com)**

部署到云平台（Vercel / Render / Railway / 阿里云 / 腾讯云）：

```bash
# 使用 Docker 部署
docker build -t coding-agent-harness .
docker run -d -p 3456:3456 -v $(pwd):/workspace -e OPENAI_API_KEY=$OPENAI_API_KEY coding-agent-harness web
```

## CI/CD

项目配置了 GitHub Actions（`.github/workflows/ci.yml`）和 GitLab CI（`.gitlab-ci.yml`），每次 push 自动运行测试、编译和 Docker 镜像构建。

- **GitHub Actions**：`test` + `docker-build`，每次 push 构建 Docker 镜像，tag 时推送至 GitHub Container Registry
- **GitLab CI**：`unit-test` + `build`，使用 node:20 镜像，94 测试全部通过

## 安全

- API Key 存储在操作系统钥匙串中（Windows 凭据管理器 / macOS 钥匙串 / Linux Secret Service）
- 危险命令（rm -rf、DROP TABLE 等）执行前需人工确认
- 文件操作限定在工作区范围内
- Key 绝不写入日志或提交到 Git（含 `.husky/pre-commit` hook 自动检查）
- 日志输出前自动脱敏（`sk-***`、`Bearer ***` 替换）

## 已知限制

- keytar 在某些 Linux 发行版上可能不可用（自动降级为环境变量方式）
- better-sqlite3 需要原生编译（大多数平台有预编译二进制文件）
- L3 向量存储使用内存中的 Float32Array，不适用于超大代码库