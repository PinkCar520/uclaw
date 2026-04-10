# Generative UI Gen 2 — 生产落地需求文档

> 版本：v1.0  
> 日期：2025-04-10  
> 状态：Draft  
> 目标：将 uClaw Web 端对话界面从 Gen 1（工具调用映射）升级为 Gen 2（声明式 UI 协议）

---

## 1. 背景与动机

### 1.1 当前架构现状（Gen 1）

| 层级 | 现状 |
|------|------|
| **前端渲染** | `renderToolResult()` 用硬编码 `if/else` 检查 `part.toolName`，映射到 `<BugCard>`、`<PipelineCard>` 等组件 |
| **工具注册** | 后端 `SkillOrchestrator.buildTools()` 动态组装 MCP 工具 + 本地 CLI + `activate_skill` |
| **数据契约** | 无正式协议；前端靠 `part.output \|\| part.result` 隐式提取数据 |
| **MCP 服务** | 禅道（已启用 10 个工具）；Jenkins/GitLab/Local-FS（配置已存在但未启用） |
| **前端组件** | `BugCard`、`PipelineCard`、`TaskPlan` 三张卡片 + `UIGallery`（仅用于视觉回归） |

### 1.2 核心问题

| # | 问题 | 影响 |
|---|------|------|
| P1 | 无 UI 协议/Schema | 前后端无共享契约，新增工具需同时改两端代码 |
| P2 | 工具检测脆弱 | `part.type === 'tool-X' \|\| part.toolName === 'X'` 双检模式，SDK 版本升级即断裂 |
| P3 | 前端组件后端未实现 | `getPipelineStatus`、`proposePlan` 在前端引用但后端无对应工具 |
| P4 | 按钮不可交互 | `PipelineCard` 的 "View Logs"、"Retry Build" 无 `onClick` |
| P5 | `BugCard.createdAt` 未渲染 | 定义了但未使用的 Props |
| P6 | 审批流无 UI | `wrapWithApproval` 返回 `{ status: 'pending_approval' }` 但无前端组件 |
| P7 | i18n 分散 | `getFriendlyToolName()` 中硬编码 + i18n 字典两处并存 |
| P8 | 主题不一致 | `TaskPlan` 是唯一深色组件，无统一主题策略 |

### 1.3 Gen 2 升级目标

构建一套**声明式 UI 协议（UI Protocol）**，使：

- **后端**：工具返回结构化 UI 描述（JSON），而非隐式数据
- **前端**：基于协议 + 设计系统组件自动渲染
- **新增工具**：只需在协议注册 UI 类型，无需修改渲染逻辑

---

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│  LLM + Tools (Backend)                                          │
│                                                                 │
│  MCP Tools ──┐                                                  │
│  CLI Tools ──┼──> 执行 ──> 原始数据 ──> UIClassifier ──> UI Kit │
│  Skills ─────┘                                                  │
│                                                                 │
│  UI Kit = { uiType: "bug_card", props: { ... } }                │
│            ↓                                                    │
│  流式传输到前端 (AI SDK streamText + pipeUIMessageStreamToResponse)│
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                               │
│                                                                 │
│  UIRenderer ──> switch (uiType)                                 │
│    ├── "bug_card"      => <BugCard {...props} />                │
│    ├── "pipeline_card"  => <PipelineCard {...props} />          │
│    ├── "task_plan"      => <TaskPlan {...props} />              │
│    ├── "approval_card"  => <ApprovalCard {...props} />          │
│    ├── "code_block"     => <SyntaxHighlight {...props} />       │
│    └── "text"           => <ReactMarkdown>...</ReactMarkdown>   │
│                                                                 │
│  所有组件通过统一设计系统（tokens + 主题）渲染                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 三层分离原则

| 层级 | 职责 | 归属 |
|------|------|------|
| **意图层** | AI 决定要展示什么类型的内容 | 后端 LLM + 工具 |
| **协议层** | 结构化描述 UI 的 JSON 格式 | 共享 Schema（前后端共用） |
| **渲染层** | 将协议映射为 React 组件 | 前端 UIRenderer |

---

## 3. 协议定义（UI Protocol v1）

### 3.1 核心类型定义

位置：`packages/shared/core/src/ui-protocol.ts`

```typescript
// ──────────────────────────────────────────────
// UI Protocol v1 — Generative UI 结构化协议
// ──────────────────────────────────────────────

/** UI 组件类型枚举 */
export type UIComponentType =
  | 'bug_card'       // 缺陷详情卡片
  | 'bug_list'       // 缺陷列表
  | 'pipeline_card'  // 流水线状态卡片
  | 'task_plan'      // 任务规划（含 Y/N 确认）
  | 'approval_card'  // 审批请求卡片
  | 'code_block'     // 代码/命令输出块
  | 'stats_card'     // 统计数据卡片
  | 'text';          // 富文本（Markdown）

/** 通用 UI 组件属性基类 */
export interface UIBase {
  /** 组件类型 */
  uiType: UIComponentType;
  /** 可选：组件唯一 ID，用于 React key */
  uiId?: string;
  /** 可选：渲染时的附加元数据 */
  uiMeta?: Record<string, unknown>;
}

// ── 各类型具体属性 ──

export interface UIBugCard extends UIBase {
  uiType: 'bug_card';
  props: {
    id: string;
    title: string;
    status: 'active' | 'resolved' | 'closed';
    assignee: string;
    severity: 'low' | 'medium' | 'high';
    description?: string;
    createdAt?: string;
  };
}

export interface UIBugList extends UIBase {
  uiType: 'bug_list';
  props: {
    items: UIBugCard['props'][];
    /** 可选：列表标题 */
    title?: string;
  };
}

export interface UIPipelineCard extends UIBase {
  uiType: 'pipeline_card';
  props: {
    id: string;
    name: string;
    branch: string;
    status: 'success' | 'running' | 'failed' | 'paused';
    startTime: string;
    steps: {
      name: string;
      status: 'success' | 'running' | 'waiting' | 'failed';
      duration?: string;
    }[];
    /** 可选：日志查看 URL */
    logsUrl?: string;
  };
}

export interface UITaskPlan extends UIBase {
  uiType: 'task_plan';
  props: {
    title: string;
    steps: {
      label: string;
      tool: string;
      description: string;
    }[];
    /** 确认/拒绝回调的标识，由前端映射为 sendMessage */
    actionId: string;
  };
}

export interface UIApprovalCard extends UIBase {
  uiType: 'approval_card';
  props: {
    requestId: string;
    toolName: string;
    description: string;
    args?: Record<string, unknown>;
    status: 'pending' | 'approved' | 'rejected';
  };
}

export interface UICodeBlock extends UIBase {
  uiType: 'code_block';
  props: {
    command?: string;
    output: string;
    status: 'success' | 'error';
    language?: string; // 默认 'bash'
  };
}

export interface UIStatsCard extends UIBase {
  uiType: 'stats_card';
  props: {
    title: string;
    metrics: {
      label: string;
      value: string | number;
      trend?: 'up' | 'down' | 'neutral';
    }[];
  };
}

export interface UIText extends UIBase {
  uiType: 'text';
  props: {
    content: string; // Markdown 格式
  };
}

/** 所有 UI Kit 类型的联合类型 */
export type UIKit =
  | UIBugCard
  | UIBugList
  | UIPipelineCard
  | UITaskPlan
  | UIApprovalCard
  | UICodeBlock
  | UIStatsCard
  | UIText;

/** 工具返回结果的标准格式 */
export interface ToolResult<T = unknown> {
  /** 工具原始执行结果 */
  data: T;
  /** 可选：UI 描述（Gen 2 新增） */
  ui?: UIKit;
  /** 可选：错误信息 */
  error?: string;
}
```

### 3.2 协议设计原则

| 原则 | 说明 |
|------|------|
| **向后兼容** | `ui` 字段为可选，现有工具不返回 `ui` 时前端走旧逻辑 |
| **渐进增强** | 新工具优先返回 `ui`，逐步淘汰 `part.output \|\| part.result` 隐式提取 |
| **类型安全** | 前后端共用 TypeScript 类型，编译时检查 |
| **扩展性** | 新增 `uiType` 只需在枚举中添加 + 前端注册渲染器 |

---

## 4. 需求清单

### Phase 1：基础设施（核心）

#### 4.1 定义共享协议类型

| 项目 | 详情 |
|------|------|
| **文件** | `packages/shared/core/src/ui-protocol.ts`（新增） |
| **导出** | 在 `packages/shared/core/src/index.ts` 中重新导出所有类型 |
| **验收标准** | 前端 `import type { UIBugCard } from '@uclaw/core'` 可编译通过 |

#### 4.2 重构 BugCard 组件

| 项目 | 详情 |
|------|------|
| **文件** | `apps/web/src/components/BugCard.tsx` |
| **改动** | 1. Props 接口改为继承 `UIBugCard['props']`<br>2. 渲染 `createdAt` 字段（当前未使用）<br>3. 添加 `onClick` 可选回调（支持跳转禅道详情页） |
| **验收标准** | 卡片显示完整信息（含创建时间），点击可触发回调 |

#### 4.3 重构 PipelineCard 组件

| 项目 | 详情 |
|------|------|
| **文件** | `apps/web/src/components/PipelineCard.tsx` |
| **改动** | 1. Props 接口继承 `UIPipelineCard['props']`<br>2. "View Logs" 按钮绑定 `onClick`（打开日志侧栏）<br>3. "Retry Build" 按钮绑定 `onRetry` 回调 |
| **验收标准** | 按钮可交互，触发对应的消息回传 |

#### 4.4 统一主题系统

| 项目 | 详情 |
|------|------|
| **文件** | `apps/web/src/components/TaskPlan.tsx` |
| **改动** | 将 `TaskPlan` 从深色主题改为与 `BugCard`/`PipelineCard` 一致的浅色主题 |
| **验收标准** | 所有卡片组件视觉风格一致 |

### Phase 2：前端渲染器

#### 4.5 构建 UIRenderer 组件

| 项目 | 详情 |
|------|------|
| **文件** | `apps/web/src/components/UIRenderer.tsx`（新增） |
| **职责** | 接收 `UIKit` 类型对象，switch-case 渲染对应组件 |
| **注册机制** | 使用 Map\<UIComponentType, React.ComponentType\> 存储渲染器映射表 |
| **降级策略** | 未知 `uiType` 时回退到 JSON 预览 + 警告提示 |

```tsx
// UIRenderer 接口
interface UIRendererProps {
  uiKit: UIKit;
  onAction?: (actionId: string, payload: unknown) => void;
}
```

#### 4.6 重构 ChatSession 渲染逻辑

| 项目 | 详情 |
|------|------|
| **文件** | `apps/web/src/components/ChatSession.tsx` |
| **改动** | 1. `renderToolResult()` 替换为基于 `uiType` 的分发<br>2. 优先检测 `part.result.ui`，存在则走 `<UIRenderer>`<br>3. 不存在则回退到现有 `if/else` 逻辑（向后兼容）<br>4. 移除 `part.type === 'tool-X'` 字符串检测，改用共享枚举 |
| **验收标准** | 现有所有工具卡片正常渲染，无回归 |

#### 4.7 新增 ApprovalCard 组件

| 项目 | 详情 |
|------|------|
| **文件** | `apps/web/src/components/ApprovalCard.tsx`（新增） |
| **功能** | 展示待审批操作，含"同意"/"拒绝"按钮 |
| **交互** | 点击后向 Gateway 发送审批结果，更新卡片状态 |
| **设计** | 浅色主题，橙色主按钮（同意），灰色次按钮（拒绝） |

```
┌─────────────────────────────────────────┐
│ ⚠️  操作需要您的审批                       │
│                                         │
│  工具：ZenTao - 解决缺陷                   │
│  参数：Bug #123 → 状态变更为"已解决"       │
│                                         │
│  [ 同意 ]  [ 拒绝 ]                       │
└─────────────────────────────────────────┘
```

#### 4.8 工具名称国际化重构

| 项目 | 详情 |
|------|------|
| **文件** | `apps/web/src/components/ChatSession.tsx` 中的 `getFriendlyToolName()` |
| **改动** | 1. 消除硬编码，所有工具名称走 `t('tools.xxx')` 路径<br>2. 在 `en.json` / `zh.json` 中新增 `tools` 命名空间 |

### Phase 3：后端工具升级

#### 4.9 禅道 MCP 工具返回 UI Kit

| 文件 | 改动 |
|------|------|
| `agent/mcp/mcp-zentao/src/server.ts` | `getBugInfo` 工具返回 `{ data: bugDetail, ui: { uiType: 'bug_card', props: {...} } }` |
| 同上 | `searchBugs` 返回 `{ data: bugs, ui: { uiType: 'bug_list', props: { items: [...], title } } }` |
| 同上 | `getBugStats` 返回 `{ data: stats, ui: { uiType: 'stats_card', props: { title, metrics } } }` |
| 同上 | `resolveBug` 返回 `{ data: result, ui: { uiType: 'approval_card', props: {...} } }` |

#### 4.10 新增 getPipelineStatus 工具（Jenkins MCP）

| 项目 | 详情 |
|------|------|
| **文件** | `agent/mcp/mcp-jenkins/src/server.ts`（需启用 Jenkins MCP） |
| **工具** | `getPipelineStatus` — 查询 Jenkins 流水线状态 |
| **输入** | `{ pipelineId: string }` |
| **输出** | `{ data: pipeline, ui: { uiType: 'pipeline_card', props: {...} } }` |
| **优先级** | 高（前端组件已存在但后端无实现） |

#### 4.11 新增 proposePlan 工具

| 项目 | 详情 |
|------|------|
| **文件** | Gateway 内置工具（非 MCP）或独立 Skill |
| **工具** | `proposePlan` — 生成任务执行计划 |
| **输入** | `{ goal: string, context?: SkillContext }` |
| **输出** | `{ data: plan, ui: { uiType: 'task_plan', props: { title, steps, actionId } } }` |
| **优先级** | 高（前端组件已存在但后端无实现） |

#### 4.12 runLocalCommand 返回 UI Kit

| 项目 | 详情 |
|------|------|
| **文件** | `apps/gateway/src/skill/skill.orchestrator.ts` |
| **改动** | `runLocalCommand` 执行结果返回 `{ data: result, ui: { uiType: 'code_block', props: { command, output, status } } }` |
| **验收标准** | 命令输出在聊天中渲染为语法高亮代码块 |

### Phase 4：审批流完整实现

#### 4.13 审批流前端交互

| 项目 | 详情 |
|------|------|
| **触发** | Gateway 返回 `{ status: 'pending_approval', requestId, ... }` |
| **前端** | `<ApprovalCard>` 渲染审批 UI，显示工具名、参数、操作描述 |
| **交互** | 用户点击"同意"→ Gateway 执行原工具；点击"拒绝"→ 返回拒绝消息给 LLM |
| **API** | 新增 `POST /api/approvals/:requestId/respond` 端点 |

#### 4.14 审批流后端完善

| 项目 | 详情 |
|------|------|
| **状态管理** | 审批请求持久化到数据库 |
| **通知** | 审批结果通过 WebSocket/SSE 推送给前端 |
| **超时** | 审批请求 N 分钟无响应自动过期 |

### Phase 5：扩展与优化

#### 4.15 新增 StatsCard 渲染器

| 项目 | 详情 |
|------|------|
| **组件** | `apps/web/src/components/StatsCard.tsx`（新增） |
| **用途** | 展示统计数据（Bug 统计、流水线统计等） |
| **设计** | 2×2 或 3×1 网格布局，支持趋势箭头（↑↓） |

```
┌──────────────────────────────────────┐
│  禅道产品缺陷统计                        │
│  ┌───────┐ ┌───────┐ ┌───────┐       │
│  │ 总缺陷  │ │ 待处理  │ │ 已解决  │       │
│  │  128   │ │   23   │ │   87   │       │
│  │  ↑ 12% │ │  ↓ 5%  │ │  ↑ 18% │       │
│  └───────┘ └───────┘ └───────┘       │
└──────────────────────────────────────┘
```

#### 4.16 流式 UI 渲染

| 项目 | 详情 |
|------|------|
| **目标** | UI 卡片骨架先渲染，数据到位后再填充 |
| **实现** | 利用 AI SDK `streamText` + `pipeUIMessageStreamToResponse` 的流式特性 |
| **体验** | 用户先看到工具调用状态，结果就绪后卡片自动填充 |

#### 4.17 UI 注册中心

| 项目 | 详情 |
|------|------|
| **文件** | `apps/web/src/lib/uiRegistry.ts`（新增） |
| **职责** | 维护 `uiType` → React 组件的映射，支持运行时注册新类型 |
| **API** | `registerUIRenderer(type, Component)` / `render(uiKit)` |

---

## 5. 数据流全图

### 5.1 完整请求-响应流程

```
用户输入: "查一下 Bug #1234"
        │
        ▼
┌──────────────────────────────────┐
│ 1. 前端发送 POST /api/chat        │
│    body: { content, modelId,      │
│            sessionId, ... }       │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 2. SkillOrchestrator.streamResp()  │
│    a. buildSystemPrompt()          │
│    b. buildTools()                 │
│       - MCP: getBugInfo, ...       │
│       - CLI: runLocalCommand       │
│       - Skill: activate_skill      │
│    c. streamText(model, tools)     │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 3. LLM 调用 getBugInfo({id:"1234"})│
│    MCP Server 执行                │
│    返回:                          │
│    {                              │
│      data: { id, title, ... },    │
│      ui: {                        │
│        uiType: 'bug_card',        │
│        props: { ... }             │
│      }                            │
│    }                              │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 4. AI SDK 流式返回                │
│    parts: [                       │
│      { type: 'text', text: '...' },│
│      { type: 'tool-invocation',   │
│        toolName: 'getBugInfo',    │
│        result: { ui: {...} } }    │
│    ]                              │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 5. 前端 UIRenderer                │
│    检测 part.result.ui            │
│    switch (ui.uiType):            │
│      case 'bug_card':             │
│        <BugCard {...ui.props} />  │
└──────────────────────────────────┘
```

### 5.2 向后兼容流程（旧工具无 `ui` 字段）

```
part.result = { id, title, status, ... }  // 无 ui 字段
        │
        ▼
renderToolResult() 检查 part.result.ui
        │
        ├── ui 存在 => <UIRenderer uiKit={ui} />
        │
        └── ui 不存在 => 回退到现有 if/else
              if (toolName === 'getBugInfo') <BugCard {...result} />
```

---

## 6. 实施计划

### Phase 优先级矩阵

| Phase | 范围 | 难度 | 价值 | 优先级 |
|-------|------|------|------|--------|
| **1. 基础设施** | 协议定义 + 组件重构 | 低 | 高 | 🔴 P0 |
| **2. 前端渲染器** | UIRenderer + ApprovalCard | 中 | 高 | 🔴 P0 |
| **3. 后端工具升级** | MCP 返回 UI Kit | 中 | 高 | 🟡 P1 |
| **4. 审批流完整实现** | 前后端交互 + 持久化 | 高 | 中 | 🟡 P1 |
| **5. 扩展与优化** | StatsCard + 流式 + 注册中心 | 中 | 中 | 🟢 P2 |

### 建议实施顺序

1. **协议定义**（Phase 1.1）— 先定契约，其他都依赖
2. **组件重构**（Phase 1.2-1.4）— 让现有组件符合协议
3. **UIRenderer**（Phase 2.5-2.6）— 替换渲染引擎，保持兼容
4. **审批流 UI**（Phase 2.7 + Phase 4）— 补齐缺失功能
5. **后端工具返回 UI**（Phase 3）— 逐步迁移到协议
6. **扩展优化**（Phase 5）— 长期迭代

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| AI SDK 版本升级导致 parts 结构变化 | 渲染断裂 | 使用共享枚举 + 抽象适配层 |
| 协议类型扩展频繁 | 前端渲染器维护成本高 | 注册中心模式，动态注册新类型 |
| MCP 工具不返回 `ui` 字段 | 回退到旧逻辑，无法享受新特性 | 渐进式迁移，旧逻辑保留 2 个版本周期 |
| 审批流持久化增加 DB 压力 | 性能下降 | 使用 Redis 缓存审批状态，异步持久化 |

---

## 8. 验收标准汇总

| # | 验收项 | 标准 |
|---|--------|------|
| V1 | 协议类型编译通过 | `pnpm build` 无错误 |
| V2 | BugCard 显示 createdAt | 卡片显示完整创建时间 |
| V3 | PipelineCard 按钮可交互 | 点击触发对应消息回传 |
| V4 | 所有卡片主题一致 | 浅色主题，无深色组件 |
| V5 | UIRenderer 正确分发 | 所有 uiType 渲染正确组件 |
| V6 | 向后兼容 | 旧工具不返回 ui 时仍正常渲染 |
| V7 | ApprovalCard 交互完整 | 同意/拒绝操作可完成端到端流程 |
| V8 | 工具名称全部国际化 | 无硬编码英文，切换语言后全部翻译 |
| V9 | 新增 StatsCard 可用 | 禅道统计数据正常渲染 |
| V10 | i18n 国际化完整 | 英文/中文切换无遗漏 |

---

## 附录 A：现有工具完整清单

### A.1 已启用 MCP（禅道）— 10 个工具

| 工具名 | 前端 UI 支持 | 返回 UI Kit 类型 |
|--------|-------------|-----------------|
| `getBugInfo` | ✅ `<BugCard>` | `bug_card` |
| `searchBugs` | ✅ `<BugCard>` × N | `bug_list` |
| `resolveBug` | ❌ 无 | `approval_card`（新增） |
| `getBugStats` | ❌ 无 | `stats_card`（新增） |
| `createProductStory` | ❌ 无 | `text`（现有 Markdown） |
| `getStoryInfo` | ❌ 无 | `text` |
| `searchProductStories` | ❌ 无 | `text` |
| `listProducts` | ❌ 无 | `text` |
| `createProduct` | ❌ 无 | `text` |
| `createProject` | ❌ 无 | `text` |

### A.2 Gateway 内置工具 — 2 个

| 工具名 | 前端 UI 支持 | 返回 UI Kit 类型 |
|--------|-------------|-----------------|
| `runLocalCommand` | ✅ 代码块（简陋） | `code_block`（重构） |
| `activate_skill` | ✅ 技能预览 | `text`（技能内容 Markdown） |

### A.3 前端引用但后端未实现 — 2 个

| 工具名 | 前端组件 | 状态 |
|--------|---------|------|
| `getPipelineStatus` | `<PipelineCard>` | 🔴 需实现（Jenkins MCP） |
| `proposePlan` | `<TaskPlan>` | 🔴 需实现（Skill 或内置） |

### A.4 审批流工具

| 工具名 | 前端组件 | 状态 |
|--------|---------|------|
| 任何 `wrapWithApproval` 包装的工具 | `<ApprovalCard>` | 🔴 需实现 |
