# Phase 3.2 测试指南 — 技能导入逻辑

## 前置条件

确保 Gateway 和 Web 前端正在运行：
```bash
# Terminal 1
cd apps/gateway && pnpm start:dev

# Terminal 2
cd apps/web && pnpm dev
```

## 步骤 1：通过 API 测试导入

### 1.1 从 ClawHub 导入 (真实 API)

```bash
# 导入 ClawHub 上的公开技能
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{"source":"openclaw-hub","skillId":"fix-bug"}' | jq

# 指定版本导入
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{"source":"openclaw-hub","skillId":"fix-bug","version":"1.2.0"}' | jq
```

**原理**：调用 ClawHub 官方 API `GET https://clawhub.ai/api/v1/skills/{slug}/file?path=SKILL.md`，如果网络失败则回退到本地 `agents/skills/`。

### 1.2 导入本地 Skill (Claude Code 路径)
```bash
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{"source":"claude-code","skillPath":"/Users/caomeifengli/workspace/uwork/ocean/agents/skills/write-prd"}' | jq
```

### 1.3 直接上传 SKILL.md 内容
```bash
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{
    "source":"local",
    "fileContent":"---\nname: test-skill\ndescription: A test skill for import\nallowed-tools: ls git_status\nrequires-approval: git_commit\n---\n\n# Test Skill\n\nInstructions here."
  }' | jq
```

### 1.4 从 Git 仓库导入
```bash
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{"source":"git","url":"https://github.com/example/skill-repo"}' | jq
```

## 步骤 2：Web 端测试

### 2.1 访问导入入口
1. 打开 `http://localhost:8081`
2. 点击左侧边栏 **"MCP Servers"**
3. 点击右上角 **"Import Skill"**

### 2.2 验证导入功能

| 测试项 | 操作 | 预期结果 |
|---|---|---|
| OpenClaw Hub | 选择 "OpenClaw Hub"，输入 "fix-bug" | 成功导入并显示 "Successfully imported skill..." |
| Claude Code | 选择 "Claude Code Skill"，输入本地路径 | 成功解析并导入 SKILL.md |
| Local Upload | 选择 "Local File"，粘贴 SKILL.md 内容 | 解析 frontmatter 并创建技能 |
| Git 仓库 | 选择 "Git Repository"，输入仓库 URL | 克隆、解析并清理临时文件 |
| 错误处理 | 输入无效 ID 或路径 | 显示错误 Toast 提示 |

## 步骤 3：验证导入结果

### 3.1 检查技能库
打开 `http://localhost:8081` → **Library**，新导入的技能应出现在列表中。

### 3.2 检查数据库
```bash
# 查询最新导入的技能
cd apps/gateway
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ocean?schema=public" \
npx prisma studio
```

## 步骤 4：构建验证

```bash
# Gateway 构建
pnpm --filter gateway build

# Web 构建
pnpm --filter web build
```

两个构建都应该无错误完成。
