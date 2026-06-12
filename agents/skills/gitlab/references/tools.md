# MCP 工具参数参考

本文件描述 GitLab Skill 依赖的所有工具及其参数规范。所有工具由 `mcp-gitlab` MCP Server 提供。

---

## listProjects

**用途**：列出 GitLab 所有项目，可按关键词搜索

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| search | string | 否 | 搜索关键词（模糊匹配项目名称或路径） |

**返回示例**：
```
- ocean/backend: Ocean 后端服务
- ocean/frontend: Ocean 前端应用
- ocean/docs: 项目文档仓库
```

---

## listMRs

**用途**：列出指定项目的合并请求

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | number | ✅ | 项目 ID（数字类型） |
| state | enum | 否 | 状态过滤：`opened`（进行中）/ `merged`（已合并）/ `closed`（已关闭） |

**返回示例**：
```
🔵 !42: feature/user-auth → main (zhangsan)
🟢 !40: fix/login-bug → main (lisi)
🔴 !38: old-feature → develop (wangwu)
```

---

## createMR

**用途**：创建一个新的合并请求

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | number | ✅ | 项目 ID |
| title | string | ✅ | MR 标题 |
| sourceBranch | string | ✅ | 源分支名称 |
| targetBranch | string | ✅ | 目标分支名称 |
| description | string | 否 | MR 描述 |

**返回示例**：
```
✅ MR 创建成功: !43 - Fix login page bug
https://gitlab.example.com/ocean/frontend/-/merge_requests/43
```

---

## getMRChanges

**用途**：获取指定 MR 的变更文件列表和 diff 内容

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | number | ✅ | 项目 ID |
| mrIid | number | ✅ | MR 的内部 IID（即 URL 中的 `!数字`） |

**返回示例**：
```
📝 src/pages/Login.tsx
```diff
- const Login = () => {
+ const Login = ({ redirectUrl }) => {
  ...
```

🆕 src/hooks/useAuth.ts
```diff
+ export function useAuth() { ... }
```
```

---

## addReviewComment

**用途**：向指定 MR 添加评论（可定位到具体文件行号）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | number | ✅ | 项目 ID |
| mrIid | number | ✅ | MR 的内部 IID |
| body | string | ✅ | 评论内容 |
| path | string | 否 | 文件路径，用于行级评论 |
| line | number | 否 | 行号，配合 path 使用 |

**返回示例**：
```
✅ 评论已添加到 MR !42
```

---

## mergeMR

**用途**：合并指定的 MR

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | number | ✅ | 项目 ID |
| mrIid | number | ✅ | MR 的内部 IID |
| message | string | 否 | 合并提交信息（自定义 commit message） |

**返回示例**：
```
✅ MR !42 已成功合并
```

---

## 资源 (Resources)

除了上述工具，GitLab MCP Server 还提供了以下可通过 URI 直接访问的资源：

| 资源 URI 模板 | 说明 |
|---------------|------|
| `gitlab://projects/{projectId}` | 项目详情 |
| `gitlab://projects/{projectId}/merge_requests/{mrIid}` | MR 详情 |
| `gitlab://projects/{projectId}/merge_requests/{mrIid}/changes` | MR 变更文件 |

---

## 提示词 (Prompts)

| 名称 | 说明 | 参数 |
|------|------|------|
| `mr-code-review` | 对指定 MR 进行 Code Review | `projectId`, `mrIid` |
