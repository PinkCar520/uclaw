# Web 端测试指南 - MCP & Skill 功能改进

> 本文档说明如何在 Web 端测试所有新增和改进的 MCP/Permission 功能。

---

## 一、启动服务

```bash
# 1. 启动 Gateway (后端)
cd apps/gateway
pnpm start:dev

# 2. 启动 Web 前端
cd apps/web
pnpm dev

# 3. 访问前端
open http://localhost:5173/settings
```

---

## 二、测试清单

### 测试 1: Permission 管理页面 UI ✅

**步骤：**
1. 登录 Web 端，进入 Settings 页面
2. 点击左侧导航栏的 **"Permissions"** 选项
3. 确认页面加载成功

**预期结果：**
- 页面显示 4 个 Permission Mode 卡片（Default, Accept Edits, Plan, Bypass）
- 显示 "MCP Output Token Limit" 输入框
- 显示 "Quick Patterns" 区域（allow/deny/ask）
- 显示 "Detailed Rules" 区域
- 显示 "Test Tool Evaluation" 区域

---

### 测试 2: 查看当前权限配置 ✅

**API 测试：**
```bash
# 在浏览器 DevTools Console 或直接用 curl
curl http://localhost:3000/api/permissions/settings
```

**预期响应：**
```json
{
  "mode": "default",
  "maxMcpOutputTokens": 25000,
  "rules": [],
  "allow": [],
  "deny": [],
  "ask": []
}
```

---

### 测试 3: 切换 Permission Mode ✅

**步骤：**
1. 在 Permissions 页面，点击 **"Bypass (CI/CD)"** 卡片
2. 确认选中状态变为橙色高亮
3. 点击 **"Save"** 按钮
4. 确认保存成功提示

**API 验证：**
```bash
curl http://localhost:3000/api/permissions/mode
# 应返回: { "mode": "bypassPermissions" }
```

---

### 测试 4: 添加工具到 allow/deny/ask 列表 ✅

**步骤：**
1. 在 "Quick Patterns" 区域找到 **"ALLOW"** 部分
2. 输入框输入：`getBugInfo`
3. 按 Enter 键或点击 "Add" 按钮
4. 确认标签出现在下方列表中
5. 重复添加：`searchBugs`, `git_status`

**预期结果：**
- 每个工具以绿色标签显示
- 每个标签右侧有删除按钮（X 图标）

---

### 测试 5: 添加详细规则（支持通配符）✅

**步骤：**
1. 在 "Detailed Rules" 区域，点击 **"Add Rule"** 按钮
2. 填写表单：
   - Action: `deny`
   - Pattern: `Bash(rm -rf:*)`
   - Comment: `禁止递归删除`
3. 点击 "Add"
4. 重复添加：
   - `deny` / `Bash(sudo:*)` / `禁止 sudo 操作`
   - `ask` / `mcp__zentao:*` / `所有禅道工具需确认`

**预期结果：**
- 规则以灰色背景行显示
- 每行显示：操作标签（颜色区分）、模式（等宽字体）、注释
- 右侧有编辑和删除按钮

---

### 测试 6: 测试工具权限评估 ✅

**步骤：**
1. 在 "Test Tool Evaluation" 区域
2. 输入框输入：`getBugInfo`
3. 点击 "Evaluate" 按钮
4. 确认显示绿色提示：`Tool "getBugInfo" → ALLOW`
5. 输入：`Bash(rm -rf:/tmp)`
6. 确认显示红色提示：`Tool "Bash(rm -rf:/tmp)" → DENY`
7. 输入：`mcp__zentao:createProduct`
8. 确认显示黄色提示：`Tool "mcp__zentao:createProduct" → ASK`

**API 验证：**
```bash
curl "http://localhost:3000/api/permissions/evaluate?toolName=getBugInfo"
# 应返回: { "toolName": "getBugInfo", "action": "allow", ... }
```

---

### 测试 7: 保存并重新加载 ✅

**步骤：**
1. 完成上述配置后，点击 **"Save"** 按钮
2. 刷新页面（F5 或 Cmd+R）
3. 确认所有配置正确恢复

---

### 测试 8: Skill 目录 API 验证 ✅

**步骤：**
1. 在浏览器 DevTools Console 执行：
```javascript
fetch('/api/skills')
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))
```

**预期结果：**
```json
[
  {
    "name": "fix-bug",
    "description": "修复禅道缺陷的完整全链路工作流...触发条件：...",
    "allowedTools": ["getBugInfo", "git_status", "read_file", "runLocalCommand", "resolveBug"],
    "requiresApproval": ["git_add", "git_commit", "resolveBug"],
    "locales": {
      "zh": { "displayName": "缺陷修复工作流", "description": "..." },
      "en": { "displayName": "Bug Fix Workflow", "description": "..." }
    }
  }
]
```

---

### 测试 9: 聊天中测试权限拦截 ✅

**步骤：**
1. 返回聊天页面
2. 发送消息："帮我修复 BUG-123"
3. 确认 AI 尝试激活 `fix-bug` skill
4. 当 AI 尝试调用需要审批的工具（如 `git_commit`）时，应弹出审批卡片
5. 审批卡片显示：
   - 工具名称
   - 将要执行的命令
   - 确认/拒绝按钮

---

### 测试 10: MCP Server 管理 ✅

**步骤：**
1. 进入 Settings → 应该可以看到 MCP Server Manager（或独立页面）
2. 确认 `zentao` 服务器状态为 Online
3. 尝试禁用 `zentao`，保存
4. 刷新页面，确认状态为 Offline
5. 重新启用

**API 验证：**
```bash
curl http://localhost:3000/api/mcp-servers
# 应返回所有 MCP Server 列表
```

---

## 三、完整测试场景

### 场景 A: 标准开发工作流（Default 模式）

1. 设置 Mode 为 `default`
2. 在聊天中请求："帮我创建一个新的产品需求"
3. 预期行为：
   - AI 激活 `write-prd` skill
   - 起草 PRD 并展示
   - 发布到禅道前弹出审批请求
   - 用户确认后执行

### 场景 B: 只读审查模式（Plan 模式）

1. 设置 Mode 为 `plan`
2. 在聊天中请求："查看当前 BUG-123 的状态"
3. 预期行为：
   - AI 可以调用 `getBugInfo` 读取数据
   - **不能**执行任何写操作（如 `resolveBug`）

### 场景 C: CI/CD 自动化模式（Bypass 模式）

1. 设置 Mode 为 `bypassPermissions`
2. 在聊天中请求："触发 Jenkins 构建 #123"
3. 预期行为：
   - AI 直接执行，**无需任何审批**
   - 立即返回构建结果

### 场景 D: 自定义规则测试

1. 添加规则：`deny` / `Read(.env*)`
2. 在聊天中请求："读取 .env 文件内容"
3. 预期行为：
   - AI 拒绝执行或告知权限不足

---

## 四、调试技巧

### 1. 查看 Gateway 日志

```bash
docker logs ocean-gateway -f | grep -i permission
# 或
docker logs ocean-gateway -f | grep -i "AGP"
```

### 2. 查看浏览器 Network 请求

打开 DevTools → Network 标签，过滤：
- `/api/permissions/*` — 权限 API 调用
- `/api/skills/*` — Skill 相关调用
- `/api/mcp-servers/*` — MCP Server 调用

### 3. 测试通配符匹配

在 Test Tool Evaluation 中输入以下测试用例：

| 输入工具名 | 预期结果 | 匹配规则 |
|-----------|---------|---------|
| `mcp__zentao:getBugInfo` | ASK | `mcp__zentao:*` |
| `mcp__zentao:createProduct` | ASK | `mcp__zentao:*` |
| `Bash(git status)` | ASK | `Bash(git:*)` |
| `Bash(git commit -m "fix")` | ASK | `Bash(git:*)` |
| `Bash(rm -rf /tmp/test)` | DENY | `Bash(rm -rf:*)` |
| `getBugInfo` | ALLOW | 在 allow 列表中 |
| `unknownTool` | ASK | 默认行为（无匹配） |

---

## 五、故障排查

### 问题 1: Permissions 页面加载失败

**症状：** 页面显示 "Failed to fetch settings"

**排查：**
```bash
# 检查 Gateway 是否正常运行
curl http://localhost:3000/api/health

# 检查权限 API 是否可用
curl http://localhost:3000/api/permissions/settings

# 检查 Gateway 日志
docker logs ocean-gateway 2>&1 | tail -50
```

### 问题 2: 保存设置后刷新丢失

**排查：**
```bash
# 检查配置文件是否写入
cat .ocean/settings.json  # 或 ~/.ocean/settings.json

# 检查文件权限
ls -la .ocean/settings.json
```

### 问题 3: Skill 未显示在目录中

**排查：**
```bash
# 检查 Skill 文件是否存在
cat agents/skills/fix-bug/SKILL.md

# 检查 Gateway 日志中的 Skills 加载信息
docker logs ocean-gateway 2>&1 | grep -i "skills"
```

---

## 六、自动化测试脚本（可选）

```bash
#!/bin/bash
# test-permissions.sh

GATEWAY_URL="http://localhost:3000"

echo "=== Testing Permission API ==="

# Test 1: Get settings
echo -n "1. GET /api/permissions/settings ... "
RESP=$(curl -s "$GATEWAY_URL/api/permissions/settings")
if echo "$RESP" | grep -q "mode"; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 2: Evaluate tool
echo -n "2. GET /api/permissions/evaluate ... "
RESP=$(curl -s "$GATEWAY_URL/api/permissions/evaluate?toolName=getBugInfo")
if echo "$RESP" | grep -q "action"; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 3: Save settings
echo -n "3. POST /api/permissions/settings ... "
RESP=$(curl -s -X POST "$GATEWAY_URL/api/permissions/settings" \
  -H "Content-Type: application/json" \
  -d '{"mode":"default","maxMcpOutputTokens":25000,"rules":[],"allow":[],"deny":[],"ask":[]}')
if echo "$RESP" | grep -q "success"; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 4: Get skills
echo -n "4. GET /api/skills ... "
RESP=$(curl -s "$GATEWAY_URL/api/skills")
if echo "$RESP" | grep -q "fix-bug"; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

echo "=== Tests Complete ==="
```

运行：
```bash
chmod +x test-permissions.sh
./test-permissions.sh
```

---

## 七、验收标准

- [ ] Permissions 页面正常加载
- [ ] 可以切换 Permission Mode 并保存
- [ ] 可以添加/删除 allow/deny/ask 模式
- [ ] 可以添加/编辑/删除详细规则
- [ ] 工具评估返回正确结果
- [ ] 通配符匹配工作正常
- [ ] 刷新页面后配置不丢失
- [ ] 聊天中权限拦截正常触发
- [ ] Skill 目录显示标准化后的描述
- [ ] MCP Server 状态正确
