# Phase 3 测试指南 — 技能安装与导入

## 前置条件

确保 Gateway 和 Web 前端正在运行：
```bash
# Terminal 1
cd apps/gateway && pnpm start:dev

# Terminal 2
cd apps/web && pnpm dev
```

## 步骤 1：Web 端测试 — 技能安装/卸载

### 1.1 访问技能库页面

浏览器打开 `http://localhost:8081`，点击左侧边栏的 **"Library"**。

### 1.2 验证安装功能

| 测试项 | 操作 | 预期结果 |
|---|---|---|
| 初始状态 | 打开页面 | "Install" 按钮显示为橙色文字 |
| 安装技能 | 点击 "Install" | 按钮显示 "..." 加载状态，随后变为 "Installed"（橙色背景） |
| 卸载技能 | 点击 "Installed" | 按钮变回 "Install" 样式 |
| 防重复点击 | 快速多次点击 | 只触发一次请求 |
| 筛选后状态 | 切换分类再切回 | 安装状态保持正确 |

### 1.3 API 直接测试

```bash
# 安装技能
curl -X POST http://localhost:3000/api/skills/<SKILL_ID>/install \
  -H "Content-Type: application/json" \
  -d '{"config":{}}' | jq

# 查询安装状态
curl http://localhost:3000/api/skills/<SKILL_ID>/install/status | jq

# 卸载技能
curl -X DELETE http://localhost:3000/api/skills/<SKILL_ID>/install | jq
```

## 步骤 2：Web 端测试 — 技能导入

### 2.1 访问导入入口

点击左侧边栏 **"MCP Servers"**，点击页面右上角 **"Import Skill"** 按钮。

### 2.2 验证导入功能

| 测试项 | 操作 | 预期结果 |
|---|---|---|
| 打开弹窗 | 点击 "Import Skill" | 弹出导入表单 |
| 选择来源 | 下拉框切换 | OpenClaw Hub / Claude Code / Git / Local |
| 输入 ID/URL | 输入内容并点击 Import | 弹出 Toast 提示 "Import from xxx is coming in the next update" |

### 2.3 API 直接测试

```bash
# 导入 OpenClaw Hub 技能
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{"source":"openclaw-hub","skillId":"fix-bug"}' | jq

# 导入 Git 仓库技能
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{"source":"git","url":"https://github.com/user/skill-repo"}' | jq
```

## 步骤 3：构建验证

```bash
# Gateway 构建
pnpm --filter gateway build

# Web 构建
pnpm --filter web build
```

两个构建都应该无错误完成。
