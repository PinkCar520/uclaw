---
name: gitlab
description: "远程 GitLab 仓库管理。包括项目初始化、Issue 需求追踪、CI/CD 流水线诊断与 Merge Request 操作。触发条件：用户明确要求对远程项目进行创建、列出、管理任务单、审查代码、合并 MR 或分析流水线失败。注意：本地代码查看请使用本地工具。"
allowed-tools:
  - gitlab__listProjects
  - gitlab__createProject
  - gitlab__listIssues
  - gitlab__createIssue
  - gitlab__createBranch
  - gitlab__getFileContent
  - gitlab__listMRs
  - gitlab__mergeMR
  - gitlab__listPipelines
  - gitlab__getJobLog
requires-approval:
  - gitlab__createProject
  - gitlab__createIssue
  - gitlab__mergeMR
  - gitlab__createBranch
compatibility: "需要 mcp-gitlab MCP Server v2.0 在线"
locales:
  zh:
    displayName: "GitLab 生产级全托管"
    description: "远程 GitLab 仓库管理。支持项目生命周期、需求追踪、流水线诊断及 MR 管理。注意：本地代码查看请使用本地指令。"
  en:
    displayName: "GitLab Pro Integration"
    description: "Production-grade GitLab management. Supports project lifecycle, issue tracking, pipeline diagnosis, and MR management."
---

# GitLab 专家系统 2.0 — 远程仓库管理与全链路工作流

## 触发时机

当用户明确提到以下远程操作关键词时，激活本 Skill：
- 中文：新建项目、GitLab、任务单、Issue、合并请求、MR、流水线、Pipeline、报错日志、Code Review
- 英文：create project, gitlab, issue, merge request, MR, pipeline, job log, code review

**重要区分**：
- 如果用户只是说“看代码”、“看本地改动”，优先使用本地工作站指令。
- 只有涉及远程同步、创建远端资源、或分析远端 CI 报错时，才激活本 Skill。

## 前置检查

1. 确认 `GITLAB_BASE_URL` 和 `GITLAB_TOKEN` 已配置。
2. 确认 `mcp-gitlab` v2.0 已启动。

---

## 执行步骤 (精细化工作流)

### 工作流 A：项目初始化与远端同步 (🆕 新增)

```
项目初始化进度：
- [ ] 步骤 1：调用 createProject 创建远端仓库（确认可见性）
- [ ] 步骤 2：指导用户在本地执行 git init
- [ ] 步骤 3：调用 local_bash 执行 git remote add origin
- [ ] 步骤 4：首次提交代码并推送到远端
```

### 工作流 B：需求驱动开发 (Issue-Driven) (🆕 新增)

```
需求处理进度：
- [ ] 步骤 1：调用 listIssues 获取任务列表或定位目标 Issue
- [ ] 步骤 2：调用 createBranch 创建对应的功能/修复分支
- [ ] 步骤 3：调用 local_bash 切换到新分支并开始修复
- [ ] 步骤 4：提交时在 commit 信息中关联 Close #ID
```

### 工作流 C：查看/管理合并请求 (MR) (保留原有)

```
MR 管理进度：
- [ ] 步骤 1：定位目标项目（listProjects）
- [ ] 步骤 2：列出 MR（listMRs，可按状态过滤）
- [ ] 步骤 3：查看 MR 详情或变更文件
- [ ] 步骤 4：执行 Code Review 或添加评论
- [ ] 步骤 5：合并 MR（mergeMR，⚠️ 需先检查流水线）
```

### 工作流 D：CI/CD 故障自愈 (🆕 新增)

```
故障诊断进度：
- [ ] 步骤 1：调用 listPipelines 确认失败的流水线 ID
- [ ] 步骤 2：调用 getJobLog 抓取失败 Job 的末尾日志
- [ ] 步骤 3：利用反向采样 (Sampling) 请求网关协助诊断报错根因
- [ ] 步骤 4：调用 local_file_edit 修复代码并重新 Push 验证
```

---

## ⚠️ 工具确认规范 (保留并扩展)

以下操作必须在执行前请求人工确认：

| 操作 | 确认内容 | 风险等级 |
|------|----------|---------|
| `createProject` | 确认项目名称、可见性（Private/Public） | 中 |
| `createIssue` | 确认 Issue 标题、标签和指派人 | 低 |
| `createBranch` | 确认起始基准（ref）和新分支名 | 低 |
| `mergeMR` | **强制确认**：展示标题和分支，确认合并后不可撤销 | 高 |

确认协议：
- 展示将要执行的确切操作和参数。
- **利用 Generative UI (如代码块) 展示具体变更内容。**
- 等待用户回复 Y 或 N，严禁自动执行。

---

## ⚠️ 生产化安全红线

1. **禁止删除**: 严禁在对话中主动删除项目或分支，必须引导用户至 Web 端操作。
2. **凭证保护**: 严禁在任何回复中打印或泄露 `GITLAB_TOKEN`。
3. **权限边界**: 仅操作用户指定的项目，严禁扫描非关联仓库。

## 交互与展示准则

1. **UI 优先**: 调用 `getFileContent` 或 `getJobLog` 后，结果会自动渲染为 `code_block`，你只需概括核心逻辑或报错点。
2. **行动导向**: 每次步骤完成后，必须给出下一步建议（如：“项目已建好，是否为您关联本地代码？”）。

---
请以资深 GitLab 专家身份，用简洁、专业的中文协助用户。
