# MCP 工具参数参考

本文件描述 fix-bug Skill 依赖的所有工具及其参数规范。

---

## getBugInfo

**来源**：mcp-zentao MCP Server  
**用途**：从禅道拉取指定 ID 的缺陷详情

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bugId | string | ✅ | 禅道缺陷 ID，如 "123" 或 "BUG-123" |

**返回示例**：
```json
{
  "id": "123",
  "title": "登录页面在 iOS 15 下白屏",
  "status": "active",
  "severity": "3",
  "steps": "1. 打开 App\n2. 点击登录",
  "expected": "正常显示登录界面",
  "files": ["src/pages/Login.tsx"]
}
```

---

## resolveBug

**来源**：mcp-zentao MCP Server  
**用途**：将禅道缺陷标记为已解决

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bugId | string | ✅ | 禅道缺陷 ID |
| resolution | string | 否 | 解决说明，默认 "已修复" |
| commitHash | string | 否 | 关联的 Git commit hash |

---

## runLocalCommand

**来源**：Ocean RPC Gateway（本地 CLI 代理）  
**用途**：在开发者本地工作站执行 CLI 指令

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | ✅ | 目标用户工号（从上下文获取） |
| command | enum | ✅ | 指令名，见下表 |
| args | object | 否 | 指令参数 |

**支持的 command 值**：

| command | 说明 | args 示例 |
|---------|------|-----------|
| `git_status` | 检查工作区状态 | `{}` |
| `git_add` | 暂存文件 | `{ "files": "." }` |
| `git_commit` | 提交变更 | `{ "message": "fix: ..." }` |
| `read_file` | 读取文件内容 | `{ "path": "src/xxx.ts" }` |
| `ls` | 列出目录内容 | `{ "path": "." }` |
| `npm_build` | 执行构建 | `{}` |

---

## read_file

**说明**：通过 `runLocalCommand` 的 `read_file` 命令实现，见上表。
