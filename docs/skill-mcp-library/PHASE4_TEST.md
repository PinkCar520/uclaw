# Phase 4 测试指南 — 权限与治理 (AGP)

## 前置条件

确保 Gateway 和 Web 前端正在运行：
```bash
# Terminal 1
cd apps/gateway && pnpm start:dev

# Terminal 2
cd apps/web && pnpm dev
```

## 步骤 1：后端 AGP 逻辑验证

### 1.1 工具过滤 (Allowed Tools)
在 `skill.loader.ts` 中，`fix-bug` 技能定义了 `allowed-tools`。
启动后，Gateway 日志应显示 `[AGP] Tool "..." requires approval`（对于 requires-approval 列表中的工具）。

### 1.2 审批拦截 (Requires Approval)
目前 `fix-bug` 技能在 SKILL.md 中定义了 `requires-approval`：
```yaml
requires-approval:
  - git_add
  - git_commit
  - resolveBug
```
当 AI 尝试调用这些工具时，执行会被暂停，并在 `ApprovalService` 中创建待审批请求。

### 1.3 API 直接测试

```bash
# 查询某会话的待审批请求
curl http://localhost:3000/api/chat/approvals/<SESSION_ID> | jq

# 批准请求
curl -X POST http://localhost:3000/api/chat/approvals/<REQUEST_ID>/respond \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}' | jq

# 拒绝请求
curl -X POST http://localhost:3000/api/chat/approvals/<REQUEST_ID>/respond \
  -H "Content-Type: application/json" \
  -d '{"status":"denied"}' | jq
```

## 步骤 2：Web 端测试 — 审批弹窗

### 2.1 触发审批
1. 在聊天界面发送一条消息，触发 AI 调用需要审批的工具（如 "Fix bug BUG-123"）。
2. 当 AI 准备执行 `git_commit` 或 `resolveBug` 时，工具执行会返回 `pending_approval`。
3. 前端轮询（每 2 秒）会检测到待审批请求，并弹出 **审批模态框**。

### 2.2 验证审批交互

| 测试项 | 操作 | 预期结果 |
|---|---|---|
| 模态框弹出 | 触发审批 | 弹出带有 "Action Requires Approval" 标题的模态框 |
| 显示工具名 | 查看模态框 | 显示正确的工具名称（如 `git_commit`） |
| 显示参数 | 查看 Arguments 区域 | 显示即将执行的参数 JSON |
| 批准操作 | 点击 "Approve" | 模态框关闭，AI 继续执行后续步骤 |
| 拒绝操作 | 点击 "Deny" | 模态框关闭，AI 收到拒绝结果并停止或调整 |

## 步骤 3：构建验证

```bash
# Gateway 构建
pnpm --filter gateway build

# Web 构建
pnpm --filter web build
```

两个构建都应该无错误完成。
