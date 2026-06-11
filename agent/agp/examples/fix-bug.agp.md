---
protocol: AGP/1.0
name: fix-bug
description: "修复禅道缺陷的完整全链路工作流：拉取缺陷详情、分析相关代码、应用修复、Git 提交并在禅道关闭缺陷。当用户说修复、fix bug、解决缺陷、处理 BUG-xxx、帮我修时使用。"
license: Proprietary
compatibility: "需要 mcp-zentao MCP Server 和本地 CLI 节点在线（RPC 通道）"

# AGP 动态沙盒：大模型本次会话只能看到以下工具
allowed-tools:
  - getBugInfo
  - git_status
  - read_file
  - runLocalCommand
  - resolveBug

# AGP 拦截断点：以下高危写操作必须经过人工 Y/N 确认后方可执行
requires-approval:
  - git_add
  - git_commit
  - resolveBug

metadata:
  author: pinkcar
  version: "1.1"
  target-system: ZenTao + GitLab
---

# Fix Bug — Bug 修复全链路工作流

## 触发时机

当用户提到以下任意关键词时，激活本工作流：
- 中文：修复、解决缺陷、解决 bug、处理缺陷、帮我修、关闭 bug
- 英文：fix bug、fix-bug、ocean fix、resolve bug

## 前置检查

开始前，确认以下条件：
1. 从用户消息中提取缺陷 ID（如：BUG-123、#123、禅道 ID 123）
2. 确认有在线的本地 CLI 节点（用 `runLocalCommand` → `git_status` 探测）

如果无法提取缺陷 ID，先询问用户："请提供禅道缺陷 ID，例如：BUG-123"

## 执行步骤

复制此进度清单并在响应中展示给用户，随步骤完成逐项打勾：

```
Bug 修复进度：
- [ ] 步骤 1：拉取缺陷详情
- [ ] 步骤 2：读取相关代码
- [ ] 步骤 3：检查 Git 状态
- [ ] 步骤 4：暂存改动（AGP 断点：需确认）
- [ ] 步骤 5：提交代码（AGP 断点：需确认）
- [ ] 步骤 6：关闭禅道缺陷（AGP 断点：需确认）
```

### 步骤 1：拉取缺陷详情

调用 `getBugInfo`，传入缺陷 ID。

获取到缺陷标题、描述、重现步骤、期望结果后，向用户简要说明缺陷内容，然后继续。

### 步骤 2：读取相关代码

根据缺陷描述推断相关文件路径，调用 `read_file` 读取源码。

如有不确定的文件路径，先询问用户确认，再读取。

### 步骤 3：检查 Git 状态

调用 `runLocalCommand` → `git_status`，确认工作区状态。

如果工作区有未提交的改动，告知用户并询问是否继续。

### 步骤 4：暂存改动 ⚠️

> 此步骤已在 AGP Manifest 的 `requires-approval` 中声明，网关将自动拦截请求人工确认。

向用户展示将暂存的文件列表，等待网关返回确认信号。收到 **Y** 后继续，收到 **N** 则停止。

### 步骤 5：提交代码 ⚠️

> 此步骤已在 AGP Manifest 的 `requires-approval` 中声明，网关将自动拦截请求人工确认。

自动生成符合规范的 commit message（格式：`fix: <缺陷标题> [BUG-xxx]`），展示给用户并等待确认。

### 步骤 6：关闭禅道缺陷 ⚠️

> 此步骤已在 AGP Manifest 的 `requires-approval` 中声明，网关将自动拦截请求人工确认。

调用 `resolveBug`，将缺陷标记为已解决。完成后汇报：缺陷 ID、commit hash、用时。

## Gotchas

- `runLocalCommand` 需要指定 `userId` 参数，从上下文变量 `${userId}` 获取。
- `git_commit` 时 message 必须以 `fix:` 开头并附带缺陷 ID，否则禅道无法自动关联。
- 若缺陷已处于"已解决"状态，`resolveBug` 会返回成功但不改变状态，属于正常。
