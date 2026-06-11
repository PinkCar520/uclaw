# Ocean：银行内网级 AI Agent 需求与架构设计白皮书

**版本：** v1.1 Draft
**日期：** 2026-03-31
**核心定位：** 串联「桌面代码环境」与「企业 IM/DevOps 基建」的双脑智能研发中枢

---

## 一、 产品背景与战略目标 (Background & Vision)

在重度合规与物理隔离的银行内网（Intranet）环境中，研发团队当前面临的最致命问题并不是缺乏工具，而是**工具孤岛与极高的上下文切换（Context Switch）成本**。

一个典型的研发路径是：QA 在**内网 IM（即时通讯）**发来消息报错 -> 研发切出 IDE 去网页登录**禅道**查 Bug 详情 -> 回到 IDE 改代码并提交到**GitLab** -> 再次切到网页进**Jenkins**点发布 -> 跑完流水线后再切回**IM**通知 QA 验证。

**Ocean** 的愿景是打造一个**无缝流转的生成式智能体**。借鉴开源项目 `OpenClaw` 的 “中枢网关 + 多渠道端”理念，Ocean 会将**内网 IM**、前端 Web 与开发者的个人电脑底层（CLI）融为一体。开发者只需在 IM 中发一句话，Ocean 就能帮其走完全程的拉库、打包、改单、通知。

---

## 二、 需求设计 (产品痛点与核心 PRD)

### 1. 核心业务痛点 (Pain Points)
1. **上下文严重割裂**：开发者每天在 IM 群组、禅道面板、Jenkins 控制台和代码编辑器之间来回横跳，碎片化工作占用极大精力。
2. **协同摩擦力高**：测试提单、开发跟进、发版通知等环节过度依赖“人找人”的手动文字粘贴，极容易出现信息漏斗。
3. **本地操作繁琐**：排查日志、跑脚本清理磁盘、检索几十个文档库这类“本地杂活”，目前全靠手工执行。

### 2. 核心应用场景与故事线 (User Stories)

Ocean 支持跨越 **内网 IM、Web 可视化面板、桌面终端** 三大媒介开展工作：

| 场景聚类 | 触达渠道 (Channel) | 典型用户故事线 (User Story) | Ocean 执行的后端动作 (Tools) |
| :--- | :--- | :--- | :--- |
| **【场景 A】 IM 驱动的缺陷流转** | **内网 IM** (如企微/行内自研办公软件) | 测试在群里说：“张三，支付页的报错又复现了”。Ocean 机器人捕捉后自动在群内回复：“已帮您将异常信息在禅道创建 Bug [ID:123] 并指派给张三”。 | 1. 读取 IM 上下文。<br>2. 调用 `tools-zentao` 创建缺陷。<br>3. 调用 IM Webhook 发卡片。 |
| **【场景 B】 一语驱动 CI/CD 发版** | **内网 IM / Web UI** | 开发者修复完毕，在 IM 对 Ocean 发送指令：“我刚 push 了支付热修复分支，帮我发到 Test-01 环境并关闭刚才的 Bug。” | 1. 调 `tools-gitlab` 查最新分支。<br>2. 调 `tools-jenkins` 传参点火构建。<br>3. 调 `tools-zentao` 沉淀状态。 |
| **【场景 C】 生成式数据大盘** | **Web UI (网页端)** | 业务主管在网页上输入：“帮我拉一下三月份各核心业务线的遗留 P0 缺陷报表”。前端不再返回文字，而是直接生成一个可交互的饼图。 | 调禅道聚合 API，前端接管 `tool_call` 渲染 `shadcn/ui` Highcharts 组件。 |
| **【场景 D】 桌面本地杂活助理** | **本地工作站 (CLI)** | 开发者在自己电脑终端敲击 `ocean run`：“帮我把下载目录里今天生成的所有 .log 文件找出报错字段并生成个总结文本发桌面上。” | NestJS 网关下发指令，由潜伏在局域网里的 `ocean-cli` 利用 Node.js 原生 `fs/cli` 库执行。 |
| **【场景 E】 内网基建与文档智能问答 (RAG)** | **Web UI / 内网 IM** | 新人入职时在群里问：“咱们测试环境的 UAT 数据库在哪台机器？” Ocean 直接检索行内 Wiki/Confluence 并在群内抛出准确文档链接与脱敏答案。 | 调取内网 PostgreSQL (pgvector) 向量库执行 RAG 文档检索。 |
| **【场景 F】 线上告警与日志一键溯源** | **内网 IM** | 运维机器人刚在群里报了核心网关 500 错误报警。研发立刻@Ocean：“去 Kibana/ELK 提取过去 15 分钟该服务的错误堆栈，并提炼出引发异常的 Root Cause”。 | 调用 `tools-elk` 接口大规模拉取散落日志，由 LLM 清洗后提取关键 `Exception`。 |
| **【场景 G】 代码合规与 MR 自动巡检** | **GitLab Webhook + IM** | 实习生张三发起了一个上千行的合并请求 (MR)。Ocean 被 webhook 触发，读取代码 Diff，在 IM 管理群里通报本次核心修改，并在某行代码处留评：“这里缺少验签逻辑”。 | 被动订阅 GitLab 事件流，并主动运用 `tools-gitlab` 发表 Review 评审与风险拦截。 |
| **【场景 H】 终端代码深度提效 (Interactive CLI)** | **本地工作站终端 (CLI)** | 开发者在 VS Code 终端敲击 `ocean fix bug-2048`。Ocean 读取禅道后，结合本地根目录的 `.AIGUIDE.md` 团队规范，在终端输出【Plan 规划】，询问开发者 `(Y/N)` 后，直接利用 AST 重构代码。 | `apps/cli` 提供 `inquirer.js` 交互界面，解析正则与 AST 操作本地文件，基于人类建议权（Y/N）闭环提交流水线。 |

---

## 三、 架构设计总纲 (Architecture Design)

借鉴并升维自 `OpenClaw` 的理念，本产品全面拥抱 **MCP (Model Context Protocol) 标准** 与 **Skill（技能编排）架构**，采用 **“云端企业中枢 (NestJS Gateway) + 独立技能节点 (MCP Servers) + 多前端触点 (IM/Web/CLI)”** 的高度解耦拓扑。

### 1. 核心设计理念

- **MCP 层 (能力解耦)**：将外接的每一种「系统能力」（如禅道、Jenkins、GitLab、文件系统）封装成为隔离且独立的 **MCP Server**，Gateway 则作为统一的 MCP Client 动态连接、发现这些大模型能力，而非在核心代码库中硬编码。
- **Skill 层 (流程编排)**：继承 OpenClaw 的架构灵魂，将研发侧的复杂生命周期（如修 Bug、写 PRD）封装为**独立目录中的 Markdown 声明式技能（`SKILL.md`）**。每个技能自带 YAML Meta，指导 AI 执行步骤与交互节点（如：(Y/N) 确认）。SkillOrchestrator 动态读取这些文本指令，结合 `.AIGUIDE.md` 团队规范对模型进行强约束流转。

### 2. 全景逻辑拓扑图 (引入 MCP / Skill)

```mermaid
graph TD
    %% 泛前端与交互渠道层
    subgraph 渠道触达层 (Touchpoints)
        direction TB
        WebApp["前端 Web UI<br>React/shadcn Generative UI"]
        IMBot["内网 IM 机器人<br>群聊 Webhook/长链接"]
        LocalDaemon["终端桌面沙箱<br>ocean-cli (WebSocket)"]
    end

    %% 企业大脑枢纽
    subgraph 核心网关大脑 (Gateway Server)
        direction TB
        Gateway["企业网关中枢 Gateway<br>NestJS + SSO 守卫"]
        
        subgraph Orchestration["智能编排层"]
            SkillOrchestrator["SkillOrchestrator<br>(SOP 流程调度 / `.AIGUIDE.md` 注入)"]
            SkillRegistry["SkillRegistry<br>技能注册中心"]
        end

        subgraph MCPClient["标准化连结层"]
            MCPClientManager["MCPClientManager<br>动态发现/对接外置能力"]
        end
        
        Gateway --> SkillOrchestrator
        SkillOrchestrator --> SkillRegistry
        SkillOrchestrator --> MCPClientManager
    end

    %% MCP 技能与私有基建
    subgraph MCP能力集群 (独立隔离进程)
        MCP_Zentao["mcp-zentao<br>ZenTao MCP Server"]
        MCP_Jenkins["mcp-jenkins<br>Jenkins MCP Server"]
        MCP_GitLab["mcp-gitlab<br>GitLab MCP Server"]
        MCP_RAG["mcp-rag<br>内网检索 MCP"]
    end

    WebApp == "SSE / WebSocket" === Gateway
    IMBot == "WebHook" === Gateway
    LocalDaemon == "本地终端指令" === Gateway

    MCPClientManager -. "MCP 标准协议" .-> MCP_Zentao & MCP_Jenkins & MCP_GitLab & MCP_RAG
```

### 3. 技术栈骨架 (Technology Stack)
* **工程架构**：基于 `pnpm workspace` 的 Typescript 全栈大一统 Monorepo。
* **大脑网关 (`gateway`)**：基于 **NestJS** 构建，统管鉴权、大模型路由调度以及充当核心的 **MCP Client**，解析核心意图并分发至底层的 MCP Servers 库。
* **前端展示 (`web`)**：React 18 + Vite (SPA) + Vercel AI SDK 构建 Generative UI，可视化整个技能节点的数据轨迹。
* **隔离基建包 (`mcp-*`)**：借助 `@modelcontextprotocol/sdk` 开发的可热插拔独立服务，对接诸如内网 DevOps、内部 IM 和各类定制基建。
* **深度交互终端 (`cli`)**：融入 Anthropic 工作流理念：直接抓取本地开发规范资源与文件，并借助终端拦截风险命令，提供安全沙箱执行（Plan Mode）。

---

## 四、 安全防腐与 SSO 边界校验

这套由 IM 与本地 CLI 混合注入的系统，在金融内网的生命线在于**权限不乱扫**：
1. **SSO 身份防伪**：所有来自 Web UI 与 CLI 的请求，均由网关提取企业 SSO Token 验证其工号。
2. **IM 机器人强绑定**：当通过内网 IM 触发 Ocean 时，网关必须读取内网 IM 发来的 Request Header 中的 `UserId`（如：WangEr），随后在使用 `tools-zentao` / `tools-jenkins` 调用对应基建接口时，以 `WangEr` 的身份校验执行权限（不能发生张三通过 IM 命令关闭了总经理的项目的事故）。
3. **隔离护城河**：Ocean 只做意图调度，**不在自身数据库存储任何脱敏业务数据**。

---

## 五、 物理目录布局 (Monorepo)

```text
ocean/
├── package.json               # 统一的依赖控制中心
├── pnpm-workspace.yaml        # 定义分包逻辑
├── .npmrc                     # (关键) 锁定指向银行内网的私服镜像源
├── apps/
│   ├── web/             # [前端 UI 交互舱] Generative UI
│   ├── gateway/         # [核心大脑] 引入 MCPClientManager、SkillOrchestrator 的全栈中枢
│   │   └── skills/      # [技能指令库] 各类基于 YAML + Markdown (SKILL.md) 定义的声明式工作流集合，可热更新
│   └── cli/             # [终端交互工具] 高体验命令行入口，集成沙箱执行验证与交互提示
├── packages/
│   ├── mcp-zentao/            # 🆕 MCP 标准服务：禅道项目管理 / 缺陷及需求流转
│   ├── mcp-jenkins/           # 🆕 MCP 标准服务：统一 DevOps 流水线调度触发
│   ├── mcp-gitlab/            # 🆕 MCP 标准服务：GitLab CI 与 Merge Request
│   ├── mcp-local-fs/          # 🆕 MCP 标准服务：本地主机终端读取与执行桥接
│   ├── mcp-rag/               # 🆕 MCP 标准服务：全行内网检索的文档 RAG 系统
│   ├── tools-*/               # 内部基础 API 封装逻辑库 (例如 tools-zentao)
│   ├── channel-im/            # 内网 IM (企微/钉钉/自研) API 与消息 Webhook 桥接适配器
│   └── shared-types/          # 全局 MCP 和 Skill 流程调度强类型定义
```

---

## 六、AGP 协议：pinkcar 的架构创新 (Agent Governance Protocol)

Ocean 在工程实践中，在 MCP（数据接驳）与 Agent Skill（技能描述）之上，原创性地提出了第三块协议基石：**AGP（Agent Governance Protocol，智能体工作流协议）**。

### 三足鼎立的企业级 AI 技术栈

| 层级 | 协议 | 提出方 | 解决的核心问题 |
| :--- | :--- | :--- | :--- |
| **接入层** | MCP (Model Context Protocol) | Anthropic | 大模型与外部系统"怎么通信？" |
| **技能层** | Agent Skill | Anthropic | 大模型面对工具"怎么用？" |
| **编排治理层** | **AGP (Agent Governance Protocol)** | **pinkcar** | 大模型在企业流水线上"**按什么规矩、在多大权限范围内干活？**" |

### AGP 的两大核心创新

1. **`allowed-tools` 动态沙盒白名单**：网关默认对大模型屏蔽所有 MCP 工具，仅在特定业务意图激活时，按白名单精确注入最小权限工具集，从架构底层杜绝越权幻觉调用。

2. **`requires-approval` 强制人工介入断点**：协议级声明哪些高危写操作必须经过人工 Y/N 确认后方可放行，满足金融级合规与审计需求。

> 📄 详细规范请参阅：[AGP_Specification.md](./AGP_Specification.md)
