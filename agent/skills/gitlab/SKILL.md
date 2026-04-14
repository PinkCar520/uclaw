---
name: gitlab
description: "GitLab CI/CD 流水线管理与 Merge Request 操作。触发条件：用户需要列出项目、查看/创建/合并 MR、审查代码变更、管理合并请求、触发或查看流水线状态时使用。"
allowed-tools:
  - listProjects
  - listMRs
  - createMR
  - getMRChanges
  - addReviewComment
  - mergeMR
requires-approval:
  - createMR
  - mergeMR
  - addReviewComment
compatibility: "需要 mcp-gitlab MCP Server 在线"
locales:
  zh:
    displayName: "GitLab 集成管理"
    description: "GitLab CI/CD 流水线管理与 Merge Request 操作。支持触发流水线、查询状态、创建和管理 MR。"
  en:
    displayName: "GitLab Integration"
    description: "GitLab CI/CD pipeline management and Merge Request operations. Support triggering pipelines, checking status, creating and managing MRs."
---

# GitLab — GitLab 项目管理与 MR 工作流

## 触发时机

当用户提到以下任意关键词时，激活本 Skill：
- 中文：GitLab、合并请求、MR、流水线、Pipeline、代码审查、Code Review、合并、合代码、看变更、变更文件
- 英文：gitlab、merge request、MR、pipeline、code review、merge、changes、diff

## 前置检查

开始前，确认以下条件：
1. `GITLAB_BASE_URL` 和 `GITLAB_TOKEN` 环境变量已配置
2. `mcp-gitlab` MCP Server 已启动且在线

如果无法连接 GitLab，告知用户并提示检查配置。

## 执行步骤

根据用户意图选择对应工作流：

### 工作流 A：查看/管理合并请求 (MR)

```
MR 管理进度：
- [ ] 步骤 1：列出项目或定位目标项目
- [ ] 步骤 2：列出 MR（可按状态过滤）
- [ ] 步骤 3：查看 MR 详情或变更文件
- [ ] 步骤 4：Code Review 或添加评论
- [ ] 步骤 5：合并 MR（需确认）
```

### 工作流 B：创建新的合并请求

```
创建 MR 进度：
- [ ] 步骤 1：确认源分支和目标分支
- [ ] 步骤 2：创建 MR（需确认）
- [ ] 步骤 3：返回 MR 链接和详情
```

### 工作流 C：代码审查 (Code Review)

```
Code Review 进度：
- [ ] 步骤 1：获取 MR 变更文件
- [ ] 步骤 2：逐文件审查代码
- [ ] 步骤 3：生成审查报告
- [ ] 步骤 4：向 MR 添加评论（需确认）
```

---

### 步骤 1：列出项目或定位目标项目

调用 `listProjects`，可传入 `search` 参数搜索项目名称。

向用户展示项目列表，格式：
```
- path/to/project: 项目描述
```

如果用户已明确项目名称，可直接使用；如有歧义，请用户确认。

### 步骤 2：列出 MR

调用 `listMRs`，传入 `projectId`，可选传入 `state` 过滤（`opened` / `merged` / `closed`）。

向用户展示 MR 列表，格式：
```
🔵 !123: feature-branch → main (author)
🟢 !120: fix-bug → main (author)
🔴 !118: old-feature → develop (author)
```

### 步骤 3：查看 MR 详情或变更文件

调用 `getMRChanges`，传入 `projectId` 和 `mrIid`。

向用户展示变更摘要，包括：
- 变更文件列表（🆕 新增 / 🗑️ 删除 / 📝 修改）
- 关键 diff 片段（如果变更较多，简要概述）

### 步骤 4：Code Review 或添加评论

**Code Review 模式**：
- 逐文件审查变更内容，关注：代码质量、潜在 Bug、性能问题、安全风险、测试覆盖
- 生成结构化审查报告

**添加评论模式**：
- 调用 `addReviewComment`，传入 `projectId`、`mrIid`、`body`
- 可选传入 `path` 和 `line` 定位到具体代码行

### 步骤 5：合并 MR（⚠️ 需要用户确认）

**执行前，必须明确询问用户（参见工具确认规范）**

向用户展示 MR 信息，提问：
> "即将合并 MR !{mrIid}（{title}），确认执行吗？(Y/N)"

收到用户 **Y** 后，调用 `mergeMR`。
收到 **N** 则停止操作。

---

### 工作流 B — 步骤 2：创建 MR（⚠️ 需要用户确认）

调用 `createMR` 前，向用户确认以下信息：
- 项目 ID
- 源分支 → 目标分支
- MR 标题和描述

确认后调用 `createMR`，返回 MR 链接。

---

## ⚠️ 工具确认规范

以下操作为**不可逆或重大影响操作**，必须在执行前请求人工确认：

| 操作 | 确认内容 |
|------|----------|
| `createMR` | 展示将创建的 MR 完整信息（项目、分支、标题） |
| `mergeMR` | 展示将被合并的 MR（标题、分支），合并后不可回退 |
| `addReviewComment` | 展示将发送的评论内容，确认后发送 |

确认协议：
- 展示将要执行的确切操作和参数
- 等待用户回复 Y（确认）或 N（取消）
- **不得在未收到明确 Y 的情况下自动执行**

## 注意事项

- `projectId` 为 GitLab 项目的数字 ID，可通过 `listProjects` 获取
- `mrIid` 为 MR 的内部 ID（即 URL 中的 `!数字` 部分）
- Code Review 时应保持客观，指出具体问题并给出改进建议
- 如果用户要求自动化批量操作，先确认操作范围再执行

## 参考资料

- MCP Server 源码：见 `agent/mcp/mcp-gitlab/src/server.ts`
- 底层 API 工具库：见 `packages/tools/gitlab/src/index.ts`
