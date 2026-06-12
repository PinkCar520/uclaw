# AGP — Agent Governance Protocol
## 智能体治理协议核心规范

**版本**: 1.0 Draft  
**状态**: Proposed Standard（提议中）  
**提出方**: pinkcar  
**创建日期**: 2026-04-03  
**参考生态**: Anthropic MCP / Anthropic Agent Skills  

---

## 摘要 (Abstract)

> "如果 MCP（Model Context Protocol）是连接大模型与现实世界的 USB 接口，那么 AGP 则是保障这条数据总线在企业级工厂中安全、合规、确定性流转的操作系统与权限调度引擎。"

AGP（Agent Governance Protocol，智能体治理协议）是由 pinkcar 提出的 AI 智能体架构标准，旨在填补当前业界在"企业级工作流编排与安全治理"层面的协议空白。它基于 pinkcar 在 Ocean 项目中的核心实践提炼升华，与 MCP、Agent Skill 形成**三足鼎立**的下一代企业级 AI 技术栈基石。

---

## 一、行业背景与动机 (Background & Motivation)

### 1.1 现有架构的三大缺陷

由 Anthropic 主导的 **MCP (Model Context Protocol)** 成功标准化了工具的数据接驳方式；**Agent Skills** 规范让 Agent 具备了领域级指令接收能力。然而在面对严苛的真实企业生产环境（如银行内网部署、核心代码提交、自动化业务管理）时，这套体系面临三大致命缺陷：

1. **上下文灾难（Context Bloat）**：挂载多个 MCP Server 后，系统会将数百个工具的元数据全量注入大模型，带来两个后果：Token 急剧浪费，以及大模型面对过多工具选项时发散性幻觉调用概率激增。
2. **能力越权失控（Capability Overflow）**：缺乏动态细粒度权限沙盒隔离。一个具备"删除项目"权限 of MCP 工具，不应在一个纯查询业务中暴露给大模型——但现有标准对此没有任何约束。
3. **工作流不可管（Workflow Opacity）**：纯粹的工具代理（Agent）缺乏 SOP（标准作业流）约束，大模型完全自由决策执行路径，无法满足"关键写操作前必须等待人工确认"的企业合规需求。

### 1.2 业界现有尝试的局限

| 方案 | 代表产品 | 本质局限 |
| :--- | :--- | :--- |
| 硬编码框架 | LangChain / LangGraph | 需要程序员写大量 Python 图论代码，业务人员无法独立维护 |
| 拖拽编排平台 | Coze / Dify | 闭源私有平台，工作流无法跨系统移植，复杂流程拖拽困难 |
| 工具全量注入 | 标准 MCP 客户端 | 上下文爆炸，无沙盒隔离，大模型幻觉高发 |

**AGP 正是为了填补以上空白而生。**

---

## 二、AGP 在 AI 技术栈中的定位 (Protocol Positioning)

AGP 与 MCP、Agent Skill 形成**三足鼎立的 AI Agent 基石协议矩阵**：

| 层级 | 协议标准 | 提出方 | 解决的核心问题 |
| :--- | :--- | :--- | :--- |
| **接入层 (Connectivity)** | **MCP** (Model Context Protocol) | **Anthropic** | 大模型与外部系统**"怎么通信接驳？"** |
| **技能层 (Instruction)** | **Agent Skill** | **Anthropic** | 大模型面对工具能力**"怎么学习和使用？"** |
| **编排治理层 (Orchestration)** | **AGP** (Agent Governance Protocol) | **pinkcar** | 大模型在长流水线上**"该按什么规矩、在多大权限范围内干活？"** |

> **关键洞见**：Anthropic 定义了接入基础设施（MCP）和技能描述标准（Skill），但没有任何现行标准定义"如何在企业环境中对大模型的工具行为进行动态管控与安全编排"。AGP 填补了这一空白。

---

## 三、核心架构哲学 (Core Architecture Philosophy)

AGP 不是一个像 LangChain 那样依赖代码的重型框架，而是一套基于**纯文本声明（Markdown + YAML）**与**智能网关配合执行**的轻量级协议。

### 三大核心设计原则

**原则一：声明式业务流转 (Declarative SOP)**

把复杂的流程管理逻辑彻底剥离出代码层，交由产品经理等非开发人员使用自然语言 Checklist 来敏捷定义和维护。修改业务流程无需改代码、无需重新部署。

**原则二：动态能力按需路由 (JIT Tool Sourcing)**

网关默认对大模型屏蔽一切底层能力。仅当特定业务意图被激活时，根据 AGP Manifest 里的静态白名单，从连接池中临时提取并注入最小所需权限的工具集。任务结束，授权立即销毁。

**原则三：硬性人机协作边界 (Strict Human-in-the-Loop)**

将特定高危步骤的"等待人工核准"升级为协议级强制标签。网关层在捕获到模型发出的高危工具调用时，主动拦截执行链，向前端发出授权请求，等待人类确认后方可放行。

---

## 四、协议描述文件规范 (AGP Manifest Specification)

AGP 协议的物理载体为一个标准 Markdown 文件（`SKILL.md` 或 `*.agp.md`），由扩展的 YAML Frontmatter（元数据配置）与 Markdown 流程体（SOP 指令）两部分构成。

### 4.1 YAML 元数据字段规范

#### `protocol` (必填)
声明遵循的 AGP 规范版本，格式为 `AGP/<版本号>`。

```yaml
protocol: AGP/1.0
```

#### `allowed-tools` (核心字段 / 必填)

**功能**：动态能力沙盒白名单。这是 AGP 协议最核心的创新字段。

**行为强制力**：当携带此字段时，即使底层挂载了包含数百个工具的 MCP Server 集群，符合 AGP 标准的网关也**只允许**将名单内的指定工具临时注入模型上下文。白名单之外的所有工具均被物理拦截，对大模型不可见。

```yaml
# 仅允许模型使用这 4 个工具
allowed-tools:
  - mcp.zentao.getBugInfo
  - mcp.git.status
  - mcp.git.commit
  - mcp.zentao.resolveBug
```

#### `requires-approval` (高危操作字段 / 按需填写)

**功能**：拦截断点声明。标记哪些工具调用属于"高危写操作"，必须在执行前进入强制人工确权模式。

**行为强制力**：AGP 网关监听到模型发出对应工具的调用请求时，主动冻结执行链并向前端推送标准化授权交互（Y/N），等待明确的人工放行信号。

```yaml
# 以下操作在执行前必须经过人工确认
requires-approval:
  - mcp.git.commit
  - mcp.zentao.resolveBug
```

#### 其他元数据字段（推荐）

```yaml
name: string           # 工作流唯一名称标识符
description: string    # 触发时机描述（用于意图路由匹配）
metadata:
  author: string       # 作者/团队
  version: string      # 版本号
  target-system: string # 适用的目标系统
```

### 4.2 完整协议文件示例

```yaml
---
protocol: AGP/1.0
name: fix-core-bug

description: >
  修复禅道缺陷的完整全链路工作流。当用户提到修复、fix bug、
  解决缺陷、处理 BUG-xxx 时激活。

# 沙盒：大模型本次会话只能看到以下 4 个工具
allowed-tools:
  - mcp.zentao.getBugInfo
  - mcp.git.status
  - mcp.git.commit
  - mcp.zentao.resolveBug

# 拦截：以下工具调用前必须等待人工确认
requires-approval:
  - mcp.git.commit
  - mcp.zentao.resolveBug

metadata:
  author: pinkcar/ocean-team
  version: "1.0"
  target-system: ZenTao + GitLab
---

# Bug 修复工作流 (SOP Body)

## 前置条件
从用户消息中提取缺陷 ID（如：BUG-123）。如无法提取则先询问。

## 执行流程（必须按顺序执行）

- [ ] 步骤 1：调用 `mcp.zentao.getBugInfo` 拉取缺陷详情，向用户汇报缺陷摘要
- [ ] 步骤 2：调用 `mcp.git.status` 读取当前工作区代码变更
- [ ] 步骤 3：展示即将提交的 commit message，等待用户 Y/N 确认
- [ ] 步骤 4：确认后调用 `mcp.git.commit` 提交代码（网关自动触发拦截确认）
- [ ] 步骤 5：调用 `mcp.zentao.resolveBug` 关闭缺陷（网关自动触发拦截确认）
- [ ] 步骤 6：向用户汇报完整结果：commit hash、关闭的 Bug ID

## Gotchas
- commit message 必须以 `fix:` 开头并附带缺陷 ID，格式：`fix: <标题> [BUG-xxx]`
- 若工作区有未提交变动，需告知用户并询问是否继续
```

---

## 五、AGP 网关引擎标准行为 (Gateway Engine Specification)

任何声称支持 AGP 协议的网关实现，**必须**遵循以下状态机流转行为：

### Step 1：意图嗅探与工作流挂载 (Intent Routing)
解析用户输入，匹配并加载对应的 AGP Manifest 文件。匹配依据为 `description` 字段中的触发关键词。

### Step 2：动态沙盒构建 (Dynamic Sandboxing)
从全量 MCP 工具注册表（Registry）中，仅提取 `allowed-tools` 白名单内的工具 Schema，生成一个对本次会话生命周期有效的**瞬时最小权限工具集**，注入大模型上下文。其余工具对本次会话不可见。

### Step 3：工作流 SOP 托管 (Workflow Guardrails)
将 Manifest Body 中的 SOP 流程指令附加至系统提示（System Prompt），约束大模型必须按 Checklist 顺序执行并汇报进度，防止发散性跳步或自我发挥。

### Step 4：高危操作拦截 (Approval Interceptor)
全程监听大模型发出的 Tool Call 请求。一旦捕捉到属于 `requires-approval` 名单的操作，立即：
1. 阻断工具调用下发
2. 冻结当前会话上下文
3. 向前端推送标准化确认交互（Y/N 语义等效）
4. 等待明确人工确认信号后方可放行执行

### Step 5：会话结束资源释放 (Session Cleanup)
任务结束或会话超时后，网关立即清除为本次会话动态构建的工具沙盒，恢复网关至未授权基态。

---

## 六、与现有生态的关系对比 (Ecosystem Positioning)

### AGP vs MCP

| 维度 | MCP | AGP |
| :--- | :--- | :--- |
| **解决的问题** | 数据接驳（如何通信） | 权限治理（谁能用什么工具） |
| **作用对象** | 工具的数据格式与传输 | 工具的访问控制与流程编排 |
| **主导方** | Anthropic | pinkcar |
| **依赖关系** | AGP 的底层工具调用依赖 MCP 协议实现 | AGP 在 MCP 之上增加管控层 |

### AGP vs Agent Skill

| 维度 | Agent Skill | AGP |
| :--- | :--- | :--- |
| **解决的问题** | 技能指令描述（如何用工具） | 技能执行管控（在什么范围内执行） |
| **作用对象** | 单点工具的使用说明 | 多步骤业务流水线的安全编排 |
| **主导方** | Anthropic | pinkcar |
| **依赖关系** | Skill 描述了能力，AGP 约束了执行边界 | AGP 对 Skill 进行了企业级安全增强 |

### AGP vs LangGraph / Coze

| 维度 | LangGraph / Coze | AGP |
| :--- | :--- | :--- |
| **实现方式** | Python 代码 / GUI 拖拽 | 纯文本 Markdown 声明 |
| **维护门槛** | 需要程序员 | 产品经理/实施人员可维护 |
| **可移植性** | 平台强锁定 | 开放协议，跨平台 |
| **沙盒机制** | 无内置工具白名单 | 原生 `allowed-tools` 沙盒 |

---

## 七、结语 (Conclusion)

当前行业正处于从"单次工具调用"迈向"多步骤智能体工作流"的关键转型期。然而，这条演进路径在企业场景中最大的阻碍，是缺乏对大模型行为的确定性约束与安全治理标准。

**AGP（Agent Governance Protocol）** 让这一切返璞归真：

- **MCP** 负责让大模型拥有"双手"（工具接驳）
- **Agent Skill** 负责让大模型学会"技能"（使用说明）  
- **AGP** 负责给大模型套上"工作纪律"（流程编排 + 权限治理）

三者共同构成下一代企业级 AI 应用的完整架构基石。

---

## 附录：参考资料

- [Anthropic MCP 官方文档](https://modelcontextprotocol.io/)
- [Agent Skills 官方规范](https://agentskills.io/)
- [Ocean 项目架构设计](./Ocean_PRD_and_Architecture.md)
