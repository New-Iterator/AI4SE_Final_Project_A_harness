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
npm install -g coding-agent-harness
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

## API Key 配置

### 安全方式（推荐）

使用 `harness key set` 将密钥存储在操作系统钥匙串中：

```bash
harness key set openai
harness key status       # 查看配置状态
harness key delete openai # 删除指定 Key
```

### 环境变量（备选方案）

设置以下环境变量。注意：此方式以明文形式存储在 shell 环境中。

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_COMPAT_API_KEY`

## 配置文件

在项目根目录创建 `.harnessrc.json`：

```json
{
  "llm": { "provider": "openai", "model": "gpt-4o", "maxTokens": 4096 },
  "loop": { "maxIterations": 50, "maxConsecutiveFailures": 3 },
  "tools": { "workspaceRoot": "." }
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
  config/               - 配置加载器
  credentials/          - 凭据管理
tests/                  - 单元测试（mock LLM 驱动）
demos/                  - 机制演示脚本
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

项目配置了 GitHub Actions（`.github/workflows/ci.yml`）和 GitLab CI（`.gitlab-ci.yml`），每次 push 自动运行 `unit-test` job。

- **GitHub Actions**：`unit-test` + `build` 两个 job，测试通过后构建 Docker 镜像
- **GitLab CI**：`unit-test` + `build` 两个 stage，使用 node:20-alpine 镜像

## 安全

- API Key 存储在操作系统钥匙串中（Windows 凭据管理器 / macOS 钥匙串 / Linux Secret Service）
- 危险命令（rm -rf、DROP TABLE 等）执行前需人工确认
- 文件操作限定在工作区范围内
- Key 绝不写入日志或提交到 Git

## 已知限制

- keytar 在某些 Linux 发行版上可能不可用（自动降级为环境变量方式）
- better-sqlite3 需要原生编译（大多数平台有预编译二进制文件）
- L3 向量存储使用内存中的 Float32Array，不适用于超大代码库