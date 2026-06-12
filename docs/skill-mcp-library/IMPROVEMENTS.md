# Ocean MCP & Skill 功能完善报告

> 基于 Claude Code 官方推荐的最佳实践，对 Ocean 的 MCP 和 Skill 系统进行全面升级。

---

## 一、改进前的问题清单

| 问题 | 严重度 | 状态 |
|------|--------|------|
| SKILL.md 格式不统一（自定义 AGP/1.0 vs 标准格式） | 🟡 中 | ✅ 已修复 |
| 缺少 Claude Code 兼容的权限规则系统 | 🔴 高 | ✅ 已实现 |
| 缺少多层级配置（local/project/user） | 🟡 中 | ✅ 已实现 |
| Skill 描述缺少触发关键词和元数据 | 🟡 中 | ✅ 已改进 |
| 缺少企业级治理（managed settings） | 🟢 低 | ✅ 已实现 |
| MCP 输出 Token 无限制 | 🟡 中 | ✅ 已添加 |

---

## 二、已完成的改进

### Phase 1: SKILL.md 格式标准化 ✅

**改进文件：**
- `agents/skills/fix-bug/SKILL.md`
- `agents/skills/write-prd/SKILL.md`
- `agents/skills/jenkins/SKILL.md`

**变更内容：**
1. 移除自定义 `protocol: AGP/1.0` 标记
2. 统一 frontmatter 为 Claude Code 标准格式：
   ```yaml
   name: <skill-name>          # 必需，小写+连字符，≤64字符
   description: "<描述+触发条件>" # 必需，≤1024字符
   allowed-tools:              # 可选，工具白名单
     - tool1
     - tool2
   requires-approval:          # 可选，需人工确认的工具
     - tool3
   compatibility: "<依赖说明>"  # 可选
   locales:                    # 🆕 新增，多语言支持
     zh:
       displayName: "中文名称"
       description: "中文描述"
     en:
       displayName: "English Name"
       description: "English description"
   ```
3. 所有 Skill 的 `description` 字段现在包含**精确触发条件**

### Phase 2: 增强权限系统 ✅

**新增文件：**
- `apps/gateway/src/skill/permission.types.ts` — 权限规则类型定义
- `apps/gateway/src/skill/permission.service.ts` — 权限评估服务
- `apps/gateway/src/skill/permission.module.ts` — NestJS 模块
- `apps/gateway/src/skill/permission.controller.ts` — REST API
- `.ocean/settings.example.json` — 示例配置

**功能特性：**
1. **Claude Code 兼容的权限模式：**
   - `default` — 首次使用时提示
   - `acceptEdits` — 自动批准文件编辑，提示 bash
   - `plan` — 只读模式
   - `bypassPermissions` — CI/CD 模式，无提示

2. **规则评估（自上而下，首次匹配生效）：**
   ```json
   {
     "allow": ["getBugInfo", "git_status"],
     "deny": ["Bash(rm -rf:*)", "Bash(sudo:*)"],
     "ask": ["mcp__zentao:*", "Bash(git:*)"]
   }
   ```

3. **通配符支持：**
   - `*` → 任意字符
   - `?` → 单个字符
   - 示例：`mcp__zentao:*`, `Bash(git:*)`, `Edit(src/**)`

4. **REST API：**
   - `GET /api/permissions/settings` — 查看当前配置
   - `GET /api/permissions/evaluate?toolName=xxx` — 评估工具权限
   - `POST /api/permissions/settings` — 保存配置
   - `GET /api/permissions/mode` — 查看当前模式

### Phase 3: 多层级配置系统 ✅

**新增文件：**
- `apps/gateway/src/mcp/mcp-config.loader.ts` — MCP 多层级配置加载器

**配置层级（优先级从高到低）：**
1. **Local** — `cwd/.mcp.json` 或 `cwd/.claude/mcp.json`
2. **Project** — `<workspace>/.mcp.json`（应提交到 Git）
3. **User** — `~/.ocean/mcp.json`
4. **Built-in** — `mcp.config.json`（网关内置，兜底）

**环境变量展开：**
- 支持 `${VAR}` 语法
- 支持 `${VAR:-default}` 默认值语法

### Phase 4: Skill 发现和描述改进 ✅

**改进：**
1. `SkillLoader.buildCatalogXml()` 现在包含：
   - `allowed_tools_count` — 允许的工具数量
   - `requires_approval_count` — 需要审批的工具数量
   - `compatibility` — 兼容性说明
   - `locales` — 多语言支持（zh/en）

2. 新增 `SkillLoader.getSkill(name)` 方法，可按名称获取 Skill

3. XML 目录示例：
   ```xml
   <available_skills>
     <skill>
       <name>fix-bug</name>
       <description>修复禅道缺陷的完整全链路工作流...触发条件：...</description>
       <allowed_tools_count>5</allowed_tools_count>
       <requires_approval_count>3</requires_approval_count>
       <compatibility>需要 mcp-zentao MCP Server...</compatibility>
       <locales>
         <locale lang="zh">
           <displayName>缺陷修复工作流</displayName>
           <description>修复禅道缺陷的完整全链路工作流</description>
         </locale>
       </locales>
     </skill>
   </available_skills>
   ```

### Phase 5: 企业级治理 ✅

**新增文件：**
- `apps/gateway/src/skill/enterprise-governance.types.ts` — 企业治理类型
- `.ocean/managed-settings.example.json` — 示例托管设置
- `.ocean/managed-mcp.example.json` — 示例托管 MCP 配置

**功能：**
1. **Managed Settings** (`managed-settings.json`)
   - 不可覆盖的组织级策略
   - 强制权限规则
   - 禁止敏感操作（rm -rf, sudo, 读取 .env）

2. **Managed MCP Config** (`managed-mcp.json`)
   - 组织级 MCP Server denylist
   - 强制启用的 Server 配置
   - Denylist 具有绝对优先权

---

## 三、文件变更清单

### 修改的文件
| 文件 | 变更类型 |
|------|----------|
| `agents/skills/fix-bug/SKILL.md` | 格式标准化 |
| `agents/skills/write-prd/SKILL.md` | 格式标准化 |
| `agents/skills/jenkins/SKILL.md` | 补充 frontmatter |
| `apps/gateway/src/skill/skill.loader.ts` | 增强 catalog XML |
| `apps/gateway/src/skill/skill.orchestrator.ts` | 集成 PermissionService |
| `apps/gateway/src/skill/skill.module.ts` | 添加 PermissionModule |
| `apps/gateway/src/mcp/mcp.module.ts` | 添加 MCPConfigLoader |

### 新增的文件
| 文件 | 用途 |
|------|------|
| `apps/gateway/src/skill/permission.types.ts` | 权限规则类型 |
| `apps/gateway/src/skill/permission.service.ts` | 权限评估服务 |
| `apps/gateway/src/skill/permission.module.ts` | 权限模块 |
| `apps/gateway/src/skill/permission.controller.ts` | 权限 REST API |
| `apps/gateway/src/skill/enterprise-governance.types.ts` | 企业治理类型 |
| `apps/gateway/src/mcp/mcp-config.loader.ts` | MCP 多层级配置加载 |
| `.ocean/settings.example.json` | 权限配置示例 |
| `.ocean/managed-settings.example.json` | 企业设置示例 |
| `.ocean/managed-mcp.example.json` | 企业 MCP 配置示例 |

---

## 四、与 Claude Code 官方推荐的对比

| 特性 | Claude Code | Ocean (改进后) | 状态 |
|------|-------------|-----------------|------|
| SKILL.md 标准格式 | ✅ | ✅ | 兼容 |
| 权限规则 (allow/deny/ask) | ✅ | ✅ | 兼容 |
| 通配符匹配 | ✅ | ✅ | 兼容 |
| 权限模式 (default/plan/bypass) | ✅ | ✅ | 兼容 |
| 多层级配置 | ✅ | ✅ | 兼容 |
| 环境变量展开 | ✅ | ✅ | 兼容 |
| MCP 输出 Token 限制 | ✅ | ✅ | 兼容 |
| 企业托管设置 | ✅ | ✅ | 兼容 |
| MCP Server denylist | ✅ | ✅ | 兼容 |
| Sub-Agent 机制 | ✅ | ❌ 待实现 | 规划中 |
| PreToolUse Hooks | ✅ | ❌ 待实现 | 规划中 |
| PermissionRequest Hooks | ✅ | ❌ 待实现 | 规划中 |

---

## 五、后续建议

### 短期（1-2 周）
1. **实现 PreToolUse Hooks** — 允许 deterministic 工具拦截
2. **实现 Sub-Agent 机制** — 支持隔离执行环境
3. **前端权限管理 UI** — 可视化编辑 settings.json

### 中期（1 个月）
1. **MCP OAuth 认证** — 支持标准 OAuth flow
2. **Skill 执行审计日志** — 记录所有工具调用
3. **PermissionRequest Hooks** — 自定义审批工作流

### 长期（季度）
1. **Skill 市场** — 社区分享和安装 Skill
2. **MCP Server 健康监控** — 自动降级和恢复
3. **多租户支持** — 不同团队的不同策略

---

## 六、使用示例

### 1. 创建项目级 settings.json

```bash
mkdir -p .ocean
cat > .ocean/settings.json << 'EOF'
{
  "mode": "default",
  "allow": ["getBugInfo", "git_status"],
  "deny": ["Bash(rm -rf:*)"],
  "ask": ["mcp__zentao:*"]
}
EOF
```

### 2. 创建项目级 MCP 配置

```bash
cat > .mcp.json << 'EOF'
{
  "mcpServers": [
    {
      "id": "my-custom-server",
      "name": "My Custom MCP Server",
      "command": "node",
      "args": ["./my-server.js"],
      "enabled": true
    }
  ]
}
EOF
```

### 3. 查看当前权限配置

```bash
curl http://localhost:3000/api/permissions/settings
```

### 4. 评估工具权限

```bash
curl "http://localhost:3000/api/permissions/evaluate?toolName=getBugInfo"
```

---

## 七、总结

本次改进使 Ocean 的 MCP 和 Skill 系统与 Claude Code 官方推荐**高度兼容**，主要成就：

1. ✅ **标准化** — 所有 SKILL.md 遵循统一格式
2. ✅ **细粒度权限** — 支持 allow/deny/ask 规则和通配符
3. ✅ **多层级配置** — local > project > user > built-in
4. ✅ **企业治理** — 不可覆盖的托管设置和 MCP denylist
5. ✅ **向后兼容** — 保留 AGP 格式支持，平滑迁移

系统现在可以：
- 根据 `settings.json` 精确控制哪些工具可用
- 支持通配符规则匹配（如 `mcp__zentao:*`）
- 在 CI/CD 环境下完全跳过审批流程
- 企业部署时强制执行安全策略
