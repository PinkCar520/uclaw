# UClaw：银行内网级人工智能工作流中枢

UClaw 是一款专为重度合规与物理隔离的**银行内网（Intranet）**环境设计的 AI Agent 研发中枢。它通过串联「桌面代码环境」与「企业 IM/DevOps 基建」，旨在消除工具孤岛，降低研发过程中的上下文切换成本。

## 🌟 核心愿景

UClaw 借鉴并升维自 `OpenClaw` 的理念，打造一个**无缝流转的生成式智能体**。它将内网 IM、Web 可视化面板与开发者本地 CLI 融为一体。开发者只需通过自然语言指令，即可驱动 UClaw 完成拉库、打包、改单、缺陷流转及自动化通知等全生命周期任务。

---

## 🚀 核心特性

- **MCP (Model Context Protocol) 标准支持**：通过标准化协议连接外部系统（如禅道、Jenkins、GitLab），实现能力的即插即用与深度解耦。
- **声明式 Skill 技能系统**：通过 `SKILL.md` 文本定义复杂的 SOP 流程，结合团队规范（`.AIGUIDE.md`）对 AI 行为进行强约束。
- **AGP (Agent Governance Protocol) 治理协议**：
  - **动态沙盒白名单**：基于业务意图按需注入最小权限工具集。
  - **强制人工介入断点 (Human-in-the-loop)**：高危写操作必须经过人工确认（Y/N）。
- **Generative UI (生成式 UI)**：Web 端不再仅仅返回文字，而是直接生成可交互的报表、图表或操作面板。
- **三栖触达能力**：全面覆盖 **内网 IM (企微/钉钉/自研)**、**Web UI 可视化面板** 以及 **本地交互式 CLI**。

---

## 🏗️ 架构设计

项目采用基于 `pnpm workspace` 的 TypeScript 全栈 Monorepo 架构：

### 1. 全景组件拓扑
- **Gateway (大脑中枢)**：基于 NestJS 构建，集成 MCP Client Manager 与 Skill Orchestrator。
- **Web UI (交互舱)**：React 18 + Vite + shadcn/ui，提供 Generative UI 体验。
- **CLI (终端助手)**：提供交互式指令入口，支持本地沙箱执行。
- **MCP Servers (能力集群)**：独立隔离的进程，负责对接禅道 (ZenTao)、Jenkins、GitLab、RAG 文档库等。

### 2. 物理目录布局
```text
uclaw/
├── apps/
│   ├── gateway/         # [核心大脑] NestJS 网关，统管鉴权与调度
│   ├── web/             # [前端 UI] Generative UI 可视化面板
│   └── cli/             # [终端工具] 交互式命令行助手
├── agent/
│   ├── mcp/             # MCP 标准服务实现 (Zentao, Jenkins, GitLab 等)
│   ├── skills/          # 声明式技能工作流定义 (SKILL.md)
│   └── agp/             # 智能体治理协议规范与实现
├── packages/
│   ├── shared/          # 核心逻辑、沙箱环境与共享类型
│   └── tools/           # 外部基建 API 封装逻辑库
└── docker/              # 容器化部署与基础设施配置
```

---

## 🛠️ 技术栈

- **后端**: NestJS, Prisma 7, OpenTelemetry (Jaeger)
- **前端**: React 18, Vite, Tailwind CSS, shadcn/ui, Vercel AI SDK
- **数据库**: PostgreSQL (pgvector 向量检索), Redis (会话记忆)
- **基础设施**: Docker, pnpm workspaces
- **协议**: MCP (Model Context Protocol), AGP (Agent Governance Protocol)

---

## 📝 典型应用场景

1. **缺陷全自动流转**：从 IM 消息捕捉异常 -> 自动在禅道创建 Bug -> 指派开发人员。
2. **一语驱动 CI/CD**：通过 IM 或 Web 指令触发 GitLab 代码审查并联动 Jenkins 自动发版。
3. **数据报表生成**：自然语言查询研发效能数据，即时生成可视化大盘。
4. **本地研发提效**：在终端通过 `uclaw fix` 读取本地代码与规范，自动规划并执行修复。

---

## 🛡️ 安全与合规

作为金融级产品，UClaw 建立了严密的防腐边界：
- **SSO 身份透传**：所有指令执行均严格绑定企业工号权限。
- **权限最小化注入**：AGP 协议确保模型仅能看到当前任务所需的工具。
- **数据脱敏与隔离**：不存储脱敏业务数据，仅作为意图调度层。

---

## 📦 快速开始

### 环境依赖
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose

### 本地启动
1. **安装依赖**：
   ```bash
   pnpm install
   ```
2. **配置环境变量**：
   复制 `.env.example` 为 `.env` 并填写对应配置。
3. **启动基础设施**：
   ```bash
   docker-compose up -d
   ```
4. **启动全栈服务**：
   ```bash
   pnpm run dev
   ```

---

*© 2026 UClaw Team. Built for Professional Enterprise AI Agents.*
