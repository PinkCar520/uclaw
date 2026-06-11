---
name: fix-bug
description: "修复禅道缺陷的完整全链路工作流：拉取缺陷详情、分析相关代码、应用修复、Git 提交并在禅道关闭缺陷。触发条件：用户提到修复、fix bug、解决缺陷、处理 BUG-xxx、帮我修、关闭 bug 时激活。"
allowed-tools:
  - zentao__getBugInfo
  - local_git
  - local_file_read
  - local_bash
  - local_file_edit
  - zentao__resolveBug
requires-approval:
  - local_git
  - local_bash
  - zentao__resolveBug
compatibility: "需要 mcp-zentao MCP Server 和本地 CLI 节点在线（RPC 通道）"
locales:
  zh:
    displayName: "缺陷修复工作流"
    description: "修复禅道缺陷的完整全链路工作流：拉取缺陷详情、分析相关代码、应用修复、Git 提交并在禅道关闭缺陷。"
  en:
    displayName: "Bug Fix Workflow"
    description: "Complete workflow for fixing ZenTao bugs: fetch details, analyze code, apply fix, git commit, and resolve in ZenTao."
---

# Fix Bug — Bug 修复全链路工作流

## 触发时机

当用户提到以下任意关键词时，激活本 Skill：
- 中文：修复、解决缺陷、解决 bug、处理缺陷、帮我修、关闭 bug
- 英文：fix bug、fix-bug、ocean fix、resolve bug

## 前置检查

开始前，确认以下条件：
1. 从用户消息中提取缺陷 ID（如：BUG-123、#123、禅道 ID 123）
2. 确认有在线的本地 CLI 节点（用 `local_git` → `status` 探测）

如果无法提取缺陷 ID，先询问用户："请提供禅道缺陷 ID，例如：BUG-123"

## 执行步骤

复制此进度清单并在响应中展示给用户，随步骤完成逐项打勾：

```
Bug 修复进度：
- [ ] 步骤 1：拉取缺陷详情
- [ ] 步骤 2：读取相关代码
- [ ] 步骤 3：检查 Git 状态
- [ ] 步骤 4：暂存改动（需确认）
- [ ] 步骤 5：提交代码（需确认）
- [ ] 步骤 6：关闭禅道缺陷
```

### 步骤 1：拉取缺陷详情

调用 `getBugInfo`，传入缺陷 ID。

获取到缺陷标题、描述、重现步骤、期望结果后，向用户简要说明缺陷内容，然后继续。

### 步骤 2：读取相关代码

根据缺陷描述推断相关文件路径，调用 `read_file` 读取源码。

如有不确定的文件路径，先询问用户确认，再读取。

### 步骤 3：检查 Git 状态

调用 `local_git` (action: 'status')，确认工作区状态。

如果工作区有未提交的改动，告知用户并询问是否继续。

### 步骤 4：暂存改动（⚠️ 需要用户确认）

**执行前，必须明确询问用户（参见工具确认规范）**

向用户展示将暂存的文件列表，提问：
> "即将执行 `git add .` 暂存上述改动，确认执行吗？(Y/N)"

收到用户 **Y** 后，调用 `local_git` (action: 'add', args: '.')。
收到 **N** 则停止工作流，告知用户原因。

### 步骤 5：提交代码（⚠️ 需要用户确认）

**执行前，必须明确询问用户（参见工具确认规范）**

自动生成符合规范的 commit message（格式：`fix: <缺陷标题> [BUG-xxx]`），展示给用户，提问：
> "即将以如上 commit message 提交代码，确认执行吗？(Y/N)"

收到用户 **Y** 后，调用 `local_git` (action: 'commit', args: '-m "..."')。
收到 **N** 则允许用户修改 commit message，再次确认。

### 步骤 6：关闭禅道缺陷

调用 `resolveBug`，将缺陷标记为已解决。

完成后，向用户汇报完整结果：已关闭的缺陷 ID、commit hash、用时。

## ⚠️ 工具确认规范

Git 写操作（`git_add`、`git_commit`）是**不可逆操作**，必须在执行前请求人工确认：
- 展示将要执行的确切命令和参数
- 等待用户回复 Y（确认）或 N（取消）
- **不得在未收到明确 Y 的情况下自动执行**

## Gotchas

- 本地操作请使用 `local_*` 系列原子工具（不再使用 runLocalCommand）。
- `local_git` 时 message 必须以 `fix:` 开头并附带缺陷 ID，否则禅道无法自动关联。
- 若缺陷已处于"已解决"状态，`resolveBug` 会返回成功但不改变状态，属于正常。

## 参考资料

- MCP 工具参数详情：见 [references/tools.md](references/tools.md)
