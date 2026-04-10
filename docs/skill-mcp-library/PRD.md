# 插件与 MCP 库 v3 — 产品需求文档

## 1. 背景

当前 `SkillLibrary` 仅为前端展示页面，无后端能力支撑。为支持企业级 AI Agent 生态，需要建立统一的 **Skill & MCP Registry**，遵循业界标准协议，兼容多来源技能包。

## 2. 协议标准

UClaw 的技能与 MCP 系统遵循以下三层协议架构：

| 层级 | 协议 | 来源 | 说明 |
|---|---|---|---|
| L1 | **MCP (Model Context Protocol)** | Anthropic 标准 | 工具/数据源接入层，JSON-RPC 协议 |
| L2 | **SKILL.md (Agent Skills)** | Claude Code / OpenClaw 标准 | 可复用指令打包格式 |
| L3 | **AGP (Agent Governance Protocol)** | UClaw 原创 | 企业级权限管控与工作流编排 |

### 2.1 MCP 标准（L1）

遵循 [modelcontextprotocol.io](https://modelcontextprotocol.io/specification/) 规范：

- **Tool 定义**：每个 MCP Server 通过 `tools/list` 暴露可用工具
- **Prompt 模板**：支持 `prompts/list` 提供预设对话模板
- **Resource 资源**：支持 `resources/list` 提供数据访问入口
- **传输协议**：stdio / SSE / HTTP

### 2.2 SKILL.md 标准（L2）

兼容 **Claude Code** 与 **OpenClaw Hub** 的技能包格式：

```markdown
---
name: skill-name                    # 必填：技能唯一标识
description: "技能的简短描述"        # 必填：用于 Agent 决策是否调用
version: "1.0.0"                    # 可选：语义化版本
author: "作者名"                     # 可选
license: "MIT"                      # 可选：开源协议
compatibility: "需要 xxx MCP Server" # 可选：依赖声明
---

# Skill 名称

## 触发时机
当用户 xxx 时使用此技能。

## 执行步骤
1. 第一步...
2. 第二步...

## 输出格式
期望的输出结构说明。
```

**OpenClaw Hub 扩展字段**（提案中 skill.yaml）：
```yaml
name: weather-fetcher
version: 1.0.0
author:
  name: SociableClawd
  url: https://...
tags: [weather, api]
category: data
tools_required:
  - http-fetch
  - json-parse
```

### 2.3 AGP 扩展（L3 — UClaw 企业增强）

在标准 SKILL.md 基础上增加企业治理字段：

```yaml
---
# AGP 动态沙盒：限定本次会话可见的工具集
allowed-tools:
  - getBugInfo
  - git_status
  - runLocalCommand

# AWP 拦截断点：高危操作需人工确认
requires-approval:
  - git_commit
  - resolveBug

# 工作空间隔离
workspace-scope: ["dev-team", "qa-team"]
---
```

## 3. 后端能力需求

### 3.1 技能注册中心（Skill Registry）

| API | 方法 | 说明 |
|---|---|---|
| `/api/skills` | GET | 获取技能列表，支持 `?category=&q=&source=` 筛选 |
| `/api/skills/:id` | GET | 获取技能详情（含 SKILL.md 完整内容） |
| `/api/skills/:id/install` | POST | 安装技能到工作空间 |
| `/api/skills/:id/uninstall` | DELETE | 从工作空间移除技能 |
| `/api/skills/import` | POST | 从外部源导入技能（URL / Git / Hub） |

**技能来源支持**：

| 来源 | 导入方式 |
|---|---|
| OpenClaw Hub | `POST /api/skills/import` body: `{ source: "openclaw-hub", skillId: "xxx" }` |
| Claude Code Skill | `POST /api/skills/import` body: `{ source: "claude-code", skillPath: "/path/to/skill" }` |
| Git 仓库 | `POST /api/skills/import` body: `{ source: "git", url: "https://..." }` |
| 本地上传 | `POST /api/skills/import` multipart/form-data 上传 ZIP |
| 内部自建 | 直接写入 `agent/skills/` 目录并注册 |

### 3.2 MCP Server 管理

| API | 方法 | 说明 |
|---|---|---|
| `/api/mcp-servers` | GET | 获取已配置的 MCP Server 列表 |
| `/api/mcp-servers/:id/status` | GET | 健康检查（online / degraded / offline） |
| `/api/mcp-servers` | POST | 注册新 MCP Server |
| `/api/mcp-servers/:id` | PUT | 更新 MCP Server 配置 |
| `/api/mcp-servers/:id` | DELETE | 移除 MCP Server |
| `/api/mcp-servers/:id/tools` | GET | 获取该 Server 暴露的工具列表 |

**MCP Server 配置结构**：
```json
{
  "id": "zentao",
  "name": "ZenTao MCP",
  "description": "禅道项目管理 MCP Server",
  "category": "pm",
  "transport": "stdio",
  "command": "node",
  "args": ["../../../agent/mcp/mcp-zentao/dist/server.js"],
  "env": {
    "ZENTAO_URL": "https://zentao.example.com",
    "ZENTAO_TOKEN": "${SECRET}"
  },
  "enabled": true
}
```

### 3.3 技能安装与管理

| API | 方法 | 说明 |
|---|---|---|
| `/api/workspaces/:id/skills` | GET | 获取工作空间已安装的技能 |
| `/api/workspaces/:id/skills/:skillId` | PUT | 更新技能配置（启用/禁用/权限） |
| `/api/users/:id/skills` | GET | 获取用户可用的技能 |

### 3.4 权限与隔离

- **RBAC**：技能按角色可见（admin / developer / pm / viewer）
- **工作空间隔离**：不同部门/团队的技能独立管理
- **MCP 工具级权限**：`allowed-tools` 动态注入，默认最小权限
- **审批流**：`requires-approval` 标记的工具调用需人工 Y/N 确认

## 4. 数据模型

### 4.1 Skill

```sql
CREATE TABLE skills (
  id            VARCHAR(64) PRIMARY KEY,   -- 技能唯一标识
  name          VARCHAR(128) NOT NULL,     -- 显示名称
  slug          VARCHAR(128) UNIQUE,       -- URL 友好标识
  description   TEXT,                      -- 描述
  category      VARCHAR(32),               -- pm/cicd/vc/communication/data_science
  source        VARCHAR(32),               -- openclaw-hub / claude-code / git / local / internal
  source_url    VARCHAR(512),              -- 原始来源链接
  version       VARCHAR(16),               -- 语义化版本
  author        VARCHAR(128),
  license       VARCHAR(64),
  compatibility TEXT,                      -- 依赖声明（JSON）
  manifest      JSONB,                     -- SKILL.md 原始 frontmatter
  content       TEXT,                      -- SKILL.md body 内容
  is_featured   BOOLEAN DEFAULT FALSE,     -- 是否推荐
  is_public     BOOLEAN DEFAULT TRUE,      -- 是否公开可见
  icon          VARCHAR(32),               -- lucide icon 名称
  tags          TEXT[],                    -- 标签数组
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 SkillInstallation

```sql
CREATE TABLE skill_installations (
  id            SERIAL PRIMARY KEY,
  skill_id      VARCHAR(64) REFERENCES skills(id),
  workspace_id  VARCHAR(64),
  installed_by  VARCHAR(64),
  status        VARCHAR(16) DEFAULT 'active',  -- active / disabled / pending
  config        JSONB,                         -- 用户自定义配置
  installed_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 MCPServer

```sql
CREATE TABLE mcp_servers (
  id            VARCHAR(64) PRIMARY KEY,
  name          VARCHAR(128) NOT NULL,
  description   TEXT,
  category      VARCHAR(32),
  transport     VARCHAR(16),               -- stdio / sse / http
  command       VARCHAR(256),
  args          JSONB,
  env           JSONB,
  status        VARCHAR(16) DEFAULT 'unknown',  -- online / degraded / offline
  last_check    TIMESTAMPTZ,
  enabled       BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

## 5. 前端对接

### 5.1 SkillLibrary 页面改造

当前 UI 已具备，需对接以下 API：

| UI 元素 | 数据源 |
|---|---|
| 卡片列表 | `GET /api/skills` |
| 筛选分类 | `?category=pm` 等 |
| 搜索 | `?q=keyword` |
| 统计标签 | `GET /api/skills/stats` |
| Install 按钮 | `POST /api/skills/:id/install` |
| 来源标签 | 根据 `source` 字段显示 "OpenClaw Hub" / "Claude Code" / "Internal" |

### 5.2 新增页面

| 页面 | 路径 | 说明 |
|---|---|---|
| MCP Server 管理 | `/settings/mcp` | 配置 MCP Server 连接 |
| 技能导入 | `/skills/import` | 从外部源导入技能 |
| 已安装技能 | `/skills/installed` | 管理工作空间已安装的技能 |

## 6. 实施阶段

### Phase 1：基础注册中心（2-3 天）
- [ ] 创建 Skill 数据表
- [ ] 实现 `GET /api/skills` 列表接口
- [ ] 前端 SkillLibrary 对接真实数据
- [ ] 内置技能（fix-bug, write-prd, jenkins）注册

### Phase 2：MCP Server 管理（2 天）
- [ ] MCP Server CRUD API
- [ ] 健康检查定时任务
- [ ] MCP 配置管理页面

### Phase 3：技能安装与导入（3 天）
- [ ] 技能安装/卸载 API
- [ ] OpenClaw Hub 导入适配器
- [ ] Claude Code Skill 导入适配器
- [ ] Git 仓库导入支持

### Phase 4：权限与治理（2 天）
- [ ] RBAC 权限集成
- [ ] `allowed-tools` 动态注入
- [ ] `requires-approval` 审批流

## 7. 兼容性矩阵

| 来源 | SKILL.md 格式 | 导入方式 | 状态 |
|---|---|---|---|
| OpenClaw Hub | 标准 SKILL.md + skill.yaml | HTTP API | Phase 3 |
| Claude Code | 标准 SKILL.md | 本地路径 / ZIP | Phase 3 |
| UClaw 自建 | AGP 扩展 SKILL.md | 内置 | Phase 1 |
| 自定义 Git | SKILL.md 在仓库根目录 | Git clone | Phase 3 |
