# SPEC_PROCESS.md

## 概述

本文档记录与 Superpowers 协作生成 SPEC 与 PLAN 的完整过程，包括 brainstorming 关键节点、多轮迭代中的决策变化、以及后续修订。

---

## 1. Brainstorming 关键节点

### 节点 1：编程语言选型

**AI 追问**：你打算用什么语言实现这个 Harness？TypeScript / Go / Rust / Python？

**我的回答**：TypeScript/Node.js

**决策理由**：强类型适合状态机与抽象层设计，npm 生态丰富，且与「通过 Superpowers 构建」的演示目标一致。TypeScript 的接口系统天然支持 mock LLM 的可注入设计。

### 节点 2：LLM 供应商选择

**AI 追问**：你打算接入哪个 LLM 供应商？

**我的回答**：多供应商抽象

**决策理由**：这是一个关键设计决策。多供应商抽象意味着 LLM 抽象层需要设计统一接口，各供应商通过适配器模式接入。这也使 mock LLM 的实现水到渠成——mock 本身就是 LLMProvider 接口的一个实现。

### 节点 3：重点深入维度

**AI 追问**：六个维度中你选哪个作为"主要贡献"？

**我的回答**：记忆/上下文工程

**决策理由**：这是最有挑战性的选择。需求文档明确要求「若以记忆/上下文工程为重点，其存储与检索必须自己实现，不得直接接用框架自带的 memory」。相比治理（护栏/沙箱）和反馈闭环（校验器），记忆系统需要自己实现 SQLite 存储、关键词检索、向量相似度计算，工程深度最大。

### 节点 4：分发形态

**AI 追问**：你打算用什么方式分发？

**我的回答**：Docker + npm 组合

**决策理由**：Docker 确保环境一致性，npm 方便开发者直接安装。Docker 解决 better-sqlite3 原生编译的跨平台问题。

### 节点 5：交互界面

**AI 追问**：纯 CLI 还是需要 Web UI？

**我的回答**：纯 CLI

**决策理由**：简化整体架构，豁免 Open Design 要求。CLI 更符合 Coding Agent Harness 的定位——面向开发者的命令行工具。

---

## 2. 关键迭代与修订

### 迭代 1：补充 contextAssembler 和 compressor 独立功能规约

**AI 提出**：在 SPEC 的 §3.7 中，记忆系统只有一个指向 §6 的引用，缺少独立的功能规约。

**我采纳**：新增 §3.7.1（上下文组装器）和 §3.7.2（上下文压缩器）两小节，详细描述输入、行为、输出、边界条件和错误处理。

**修订原因**：记忆系统是重点维度，必须在功能规约层面有独立且可验证的描述，否则实现时缺乏明确依据。

### 迭代 2：展开凭据威胁模型

**AI 提出**：§3.9 的威胁模型只有一句话，应该细化攻击面分析。

**我采纳**：将在 §3.10 中展开为 8 个攻击面的逐项分析表，包括磁盘存储、进程内存、日志泄露、终端历史、Git 泄露、供应链攻击、进程间通信、备份与同步。

**修订原因**：安全是通用要求中的硬性指标，凭据威胁模型是安全一节的核心。细化后的威胁模型直接对应后续实现中的安全措施。

### 迭代 3：明确"会话"边界定义

**AI 提出**：§6.4 中提到了"会话"但没有明确边界定义。

**我采纳**：新增「会话边界定义」小节，明确会话 ID 生成（UUID v4）、生命周期（创建于 loop 初始化、销毁于 loop 退出）、L2 隔离（按 sessionId 隔离）、L3 共享（项目级）、L1 不持久化、会话清理策略。

**修订原因**：会话是记忆系统的基础概念，边界不清会导致记忆污染和检索混乱。

### 迭代 4：增加"记忆污染"风险

**AI 提出**：§10 风险表中缺少"记忆污染"这一风险。

**我采纳**：新增记忆污染风险行，包括 4 项缓解措施：置信度过滤、手动删除命令、过期自动清理、重复否决自动降级。

**修订原因**：记忆系统是重点维度，其最大风险就是错误记忆的自我强化效应。必须在前端（SPEC）就识别并设计缓解措施。

### 迭代 5：US5 改为用户视角表述

**AI 提出**：US5 的表述过于技术化（"API Key 安全地存储在系统钥匙串中"），应该改为用户视角。

**我采纳**：改为「作为开发者，我希望在首次使用 Harness 时能安全地录入我的 API Key，之后无需重复输入，且 Key 不会被泄露到源码、日志或终端历史中。」

**修订原因**：用户故事应该描述用户的目标和体验，而非实现细节。这是 INVEST 原则中 V（有价值）的要求。

---

## 3. AI 建议的采纳与推翻

### 采纳的建议

| 建议 | 采纳原因 |
|------|---------|
| 补充 contextAssembler/compressor 规约 | 重点维度需要独立可验证的功能描述 |
| 展开凭据威胁模型 | 安全是硬性要求，细化后才能指导实现 |
| 明确会话边界定义 | 记忆系统的基础概念必须清晰 |
| 增加记忆污染风险 | 重点维度应识别其最大风险 |
| US5 改用户视角 | 符合 INVEST 原则 |

### 推翻的建议

无。所有 AI 提出的修改建议均被采纳，因为它们都是对 SPEC 质量的实质性提升，且与需求文档的要求一致。

---

## 4. Brainstorming 技能反思

### 做得好的地方

1. **一次一个问题**：brainstorming 技能严格执行"一次只问一个问题"的原则，避免了信息过载。每个问题都经过上下文消化后才提出，质量很高。

2. **多方案对比**：在澄清需求后，AI 提出了 A/B/C 三种架构方案（事件管线、有限状态机、核心+插件），每种方案都有明确的优缺点和推荐理由。这比直接给出一个方案更有说服力。

3. **逐段设计确认**：设计分 5 个段落逐段呈现并确认，每个段落聚焦一个子系统（架构总览、主循环+LLM、记忆层、工具+护栏+反馈、配置+凭据+分发），降低了决策疲劳。

4. **SPEC 自审机制**：AI 在写入 SPEC 后进行了自审（placeholder 扫描、一致性检查、范围检查、歧义检查），发现了 3 个未决问题并主动解决。

### 不满意的地方

1. **缺少冷启动验证的引导**：brainstorming 技能没有主动提醒我进行冷启动验证（用另一个 agent 测试 SPEC 清晰度）。这是通用要求 §4.5 的硬性要求，但技能本身没有包含这个步骤。

2. **视觉伴侣未触发**：brainstorming 技能有视觉伴侣功能，但因为没有出现"需要图表才能说清楚"的问题，所以从未触发。对于架构设计来说，一个架构图可能是值得的，但文本版的 ASCII 图已经足够清晰。

3. **过程记录不够自动化**：brainstorming 的对话是线性的，但 SPEC_PROCESS.md 的撰写需要手动回溯。如果技能能自动生成过程摘要，会节省大量时间。

---

## 5. 冷启动验证

根据通用要求 §4.5，使用一个不同的 agent 在不提供对话历史的前提下，仅凭 SPEC.md + PLAN.md 尝试实现 1-2 个 Task。

### 验证设置

- **验证 Agent**：OpenCode (deepseek-v4-pro, 独立会话)
- **提供材料**：仅 SPEC.md 和 PLAN.md（Task 3 + Task 4）
- **指定 Task**：Task 3（LLM 抽象类型）和 Task 4（Mock LLM 实现）
- **指令**：从 PLAN 中选 Task 3 和 Task 4 自主推进，遇到不确定之处即暂停询问

### 验证结果

**Task 3（LLM 抽象类型）**：Agent 成功完成。PLAN 中 Task 3 的代码精确到可以直接复制粘贴，接口定义清晰，文件路径明确。耗时 2 分钟。

**Task 4（Mock LLM 实现）**：Agent 成功完成，但提出了以下问题：

1. **Mock LLM 的匹配策略**: 原始设计「按最后一条 user 消息匹配」在 Agent 看来不够明确——"如果 tool 返回的结果也需要 LLM 看到，mock 应该匹配全部消息还是最后一条 user 消息？"（已在实现中修正为匹配全部消息）

2. **输入匹配失败时的行为**: SPEC 和 PLAN 没有明确说明「当输入不匹配任何脚本条目时应该 fallback 还是 throw」。Agent 选择了 throw，与 SPEC 的 error handling 描述一致。

3. **中文路径问题**: Agent 在尝试运行测试时遇到了 vitest 模块解析失败（中文路径相关），但这是环境问题而非 SPEC 缺陷。

### 暴露的 SPEC 缺陷

| 缺陷 | 严重程度 | 修订 |
|------|---------|------|
| Mock LLM 匹配策略未明确 | 中等 | 在实现中改为匹配全部消息内容 |
| 输入匹配失败行为未定 | 轻微 | SPEC 中 error handling 已隐含 throw 行为 |
| 会话边界定义在 SPEC 中清晰 | 无 | 已在迭代 3 中补充，Agent 无歧义 |

### 修订决策

- **Mock LLM 匹配策略**：从「按最后一条 user 消息」改为「按全部消息内容拼接后匹配」，确保 tool call 结果也能被匹配到。这是实现层面的决策，不影响 SPEC 接口定义。
- **输入匹配失败**：保持 throw 行为，Agent 的理解与 SPEC 意图一致。

### 冷启动验证结论

SPEC.md 在冷启动条件下足以支撑独立的 Task 实现。Agent 在 2 个 Task 中均未出现「因 SPEC 不清而无法推进」的情况。唯一的模糊点（Mock 匹配策略）是设计选择而非需求缺失，Agent 在发现后主动询问了正确的方向。

**这次验证证明：SPEC 的详细程度已经达到"可独立实现"的标准，规约质量合格。**

### 冷启动验证范围反思

本次冷启动验证仅覆盖了 Task 3（LLM 抽象类型）和 Task 4（Mock LLM 实现），这两个 Task 是 SPEC 中定义最精确、PLAN 中代码最完整的部分。以下更复杂的模块**未经过冷启动验证**：

| 未验证模块 | 原因 | 潜在风险 |
|-----------|------|---------|
| Task 15（主循环） | mock LLM 驱动的集成测试需要完整的工具链 | 主循环的 HITL 审批流、记忆集成、反馈回灌等复杂逻辑在 SPEC 中的描述可能不够精确 |
| Task 18（MemoryManager） | 依赖多个子模块的接口 | 接口设计（如 ContextInjector 的 5 参数构造函数）在 SPEC 中仅描述了行为，未描述具体接口签名 |
| Task 10-14（记忆系统管线） | 跨模块数据流复杂 | L2 检索→L3 检索→注入→压缩的管线在 SPEC 中分散在多个章节，冷启动 agent 可能难以拼凑完整流程 |

**补救措施**：在实现过程中，通过 mock LLM 单元测试（`loop.test.ts`、`memory-manager.test.ts`、`context-injector.test.ts`）对上述模块进行了确定性验证，弥补了冷启动验证范围不足的缺陷。但若重做，应至少选择 Task 15（主循环）作为冷启动验证的候选 Task，因为它是所有模块的集成点，最能暴露 SPEC 的模糊性。

---

## 6. 实现过程中的 SPEC 修订

在实现过程中，以下 SPEC 内容被修订：

1. **Mock LLM 输入匹配策略**：原设计按最后一条 user 消息匹配，改为按全部消息内容匹配，确保 tool call 结果也能被匹配到。

2. **测试文件位置**：因 vitest 在中文路径下的模块解析问题，将 `tests/core/llm/` 下的测试文件移至 `tests/core/` 目录。

3. **CLI 命令结构**：原设计 `harness key set` / `key delete` / `key status` 为三个独立顶级命令，在 commander 中出现冲突（"cannot add command 'key' as already have command 'key'"）。修改为 `harness key` 子命令结构（`key set` / `key delete` / `key status`），符合 commander 的命令层级规范。

4. **CI 镜像选择**：`node:20-alpine` 缺少编译原生模块（better-sqlite3、keytar）所需的 build 工具，CI 运行失败。改为 `node:20`（Debian 基础镜像），CI 成功后增加 `npm run build` 步骤确保 TypeScript 编译正确。

5. **线上部署**：在 Render 上部署 Web 管理面板，URL 为 `https://ai4se-final-project-a-harness.onrender.com`。Render 免费版有休眠机制，首次访问需 1-2 分钟唤醒。

6. **Web UI 扩展**：原 SPEC 中设计为纯 CLI，后根据通用要求增加了 Web 管理面板（`harness web` 命令），提供系统状态、凭据配置、记忆条目管理的可视化界面。

7. **MemoryManager 自动创建数据库目录**：原实现中 better-sqlite3 在 `.harness` 目录不存在时抛错。改为构造函数中调用 `mkdirSync(dirname(dbPath), { recursive: true })` 自动创建。

8. **Windows 平台适配**：系统提示词增加平台检测（`process.platform`），动态注入 Windows/Linux 命令列表。shell 工具描述同步更新。

9. **LLM 响应日志**：主循环中增加 `[LLM] 轮次 N: tool_name` 日志输出，方便调试真实 LLM 调用。

10. **CI Docker 构建**：GitHub Actions 增加每次 push 自动构建 Docker 镜像的步骤，tag 时推送至 GitHub Container Registry。GitLab CI 因 runner 不支持 Docker-in-Docker 仅保留测试和构建阶段。

---

## 7. CI/CD 与部署过程

### CI/CD 配置

- **GitLab CI**（`.gitlab-ci.yml`）：包含 `unit-test` 和 `build` 两个 stage，使用 `node:20` 镜像
- **GitHub Actions**（`.github/workflows/ci.yml`）：包含 `test` 和 `docker-build` 两个 job，每次 push 构建 Docker 镜像，tag 时推送 GHCR
- **首次 CI 运行失败**：Alpine 镜像缺少原生编译工具，导致 `npm ci` 失败
- **修复后 CI 通过**：切换为 `node:20` 镜像，`unit-test` job（含 `npm ci` + `npm run build` + `npm test`）全部通过

### 线上部署

- **平台**：Render（免费版）
- **部署方式**：从 GitHub 仓库导入，自动检测 Node.js 项目
- **Build Command**：`npm ci && npm run build`
- **Start Command**：`node dist/src/index.js web`
- **部署 URL**：`https://ai4se-final-project-a-harness.onrender.com`
- **已知问题**：免费版 15 分钟无流量后休眠，首次访问需等待唤醒

### Git 工作流

- **GitLab**（主仓库）：`https://git.nju.edu.cn/Iterator/ai4se_final_project_a_harness`
- **GitHub**（镜像/部署源）：`https://github.com/New-Iterator/AI4SE_Final_Project_A_harness`
- **Commit 总数**：14 次，涵盖从脚手架到最终文档的完整开发过程
- **分支策略**：单 master 分支，无 PR（个人项目）

---

## 8. 最终交付物清单与验证

| # | 交付物 | 路径 | 验证方式 |
|---|--------|------|---------|
| 1 | SPEC.md | 根目录 | 12 章节完整设计文档 |
| 2 | PLAN.md | 根目录 | 22 Task 详细实现计划 |
| 3 | SPEC_PROCESS.md | 根目录 | 本文档 |
| 4 | 完整源代码 | src/ (33 文件) | 21 测试文件 94 测试全部通过 |
| 5 | Dockerfile | 根目录 | `docker build` 可构建 |
| 6 | README.md | 根目录 | 含全部必需章节 |
| 7 | AGENT_LOG.md | 根目录 | 完整时间线记录 |
| 8 | `.gitlab-ci.yml` | 根目录 | `unit-test` job 已 pass |
| 9 | CI/CD 执行记录 | ci-execution.log | 最近一次 CI 状态 passed（94 测试全部通过） |
| 10 | REFLECTION.md | 根目录 | 扩展至 3500+ 字反思报告 |
| 11 | 线上部署 URL | Render | `https://ai4se-final-project-a-harness.onrender.com` |
| 12 | 机制演示 | demos/ (3 脚本) | guard/feedback/memory 演示全部通过 |

---

## 9. SPEC-代码对齐循环（R1-R6）

在 Phase 15 中，进行了 6 轮 SPEC 与代码的严格对齐循环：

| 轮次 | 发现 gap | 修复 | 测试通过 | CI |
|------|---------|------|---------|-----|
| R1 | 12 项 | 主循环 SIGINT/黑名单/空任务/HITL、解析器 fallback、LLM 重试、context-injector 重写、compressor 重写、Web API、guard 测试 | 86→94 | passed |
| R2 | 8 项 | parser STOP/DONE 与 fallthrough、feedback 不可解析→neutral、Session 接口、embedding 维度 1536、Web API 错误处理+L3 计数、compressor try-catch | 94 | passed |
| R3 | 14 项 | Dashboard config 双 API、has() keychain 检查、配置加载警告、run-test 60s 超时、Dockerfile WORKDIR/EXPOSE、loop 任务记录/会话摘要/TTY 检测/30s 总超时 | 94 | passed |
| R4 | 8 项 | undefined tc 崩溃、shouldStop 检查、DENIED/TIMEOUT 区分、reason 字段、4xx 检测、git regex、SIGINT 在中 HITL | 94 | passed |
| R5 | 4 项 | L3 显示、GitHub Actions CI、dotenv 集成、Session 对象管理 | 94 | passed |
| R6 | 4 项 | GitHub Actions CI 完善、dotenv 配置加载、Session 生命周期管理、ci-execution.log 更新 | 94 | passed |

### 对齐循环方法论

每轮遵循以下流程：
1. 派发 3 个并行子智能体逐模块检查（core、memory+web+etc）
2. 收集 gap 报告，按严重程度分类
3. 修复所有可修复的 gap（跳过 HITLHandler 可注入、compressor summarize 等已知限制）
4. 运行 `npm run build && npm test` 确认 94 测试全部通过
5. 推送 GitLab 并确认 CI passed
6. 进入下一轮

### 遗留已知限制

以下 gap 因架构复杂度未在循环中修复，作为已知限制记录：

| 限制 | SPEC 章节 | 原因 |
|------|----------|------|
| HITLHandler 可注入接口 | §3.4 | 需要重构 loop.ts 核心架构，影响面广 |
| compressor summarize 模式 | §3.7.2 | 需要 LLM 集成，超出当前 mock 测试范围 |
| feedback-demo 完整 mock LLM 循环 | §11 | 需要重构 demo 为完整 loop 集成测试 |
| 凭据 Key 零化/日志脱敏 | §3.10 | 需要全局日志中间件，影响面广 |