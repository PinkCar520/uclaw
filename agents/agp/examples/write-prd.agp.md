---
protocol: AGP/1.0
name: write-prd
description: "产品经理的智能需求助手：起草 PRD (产品需求文档) 并将其发布到禅道。当用户要求写需求、规划产品、创建 Story、写 PRD 时使用。"
license: Proprietary
compatibility: "需要 mcp-zentao MCP Server"

# AGP 动态沙盒：大模型本次会话只能看到以下工具
allowed-tools:
  - listProducts
  - searchProductStories
  - createProduct
  - createProject
  - createProductStory

# AGP 拦截断点：以下写操作必须经过人工 Y/N 确认后方可执行
requires-approval:
  - createProductStory
  - createProduct
  - createProject

metadata:
  author: pinkcar
  version: "1.1"
  target-system: ZenTao
---

# Write PRD — 智能需求起草与同步工作流

## 触发时机

当用户提到以下任意关键词时，激活本工作流：
- 中文：写需求、规划产品、创建需求、写 PRD、起草 PRD、我要做一个功能
- 英文：write prd、create story、new story、product design

## 前置检查

开始前，执行以下自检：
1. 分析描述：如果描述太短（少于 10 个字），先提问："请详细描述功能目标和业务逻辑。"
2. 环境感知：调用 `listProducts` 获取现有产品列表。
   - 如果列表为空：告知用户，引导创建产品线（调用 `createProduct`，网关将触发 AGP 确认断点）。
   - 如果有产品：记录产品 ID 以备后续发布使用。

## 执行步骤

```
PRD 起草与发布进度：
- [ ] 步骤 1：智能提炼需求标题与详述
- [ ] 步骤 2：PRD 草案确认（AGP 断点：需人工审阅）
- [ ] 步骤 3：发布至禅道系统（AGP 断点：需确认）
```

### 步骤 1：智能提炼需求标题与详述

根据用户描述，撰写一份专业的 PRD 模板，必须包含以下结构：

1. **需求标题**：简明扼要，格式如 `【新增】积分商城入口`
2. **需求背景及目标**：为什么要做这个功能？要解决什么痛点？
3. **核心业务逻辑**：分条列出功能点。
4. **验收标准 (Acceptance Criteria)**：测试和验收的标准。

**直接向用户展示 PRD 草案（使用 Markdown 格式渲染）。**

### 步骤 2：PRD 草案确认 ⚠️

> 此处为软性人工确认（由 SOP Body 驱动），在用户确认后方进入步骤 3。

向用户展示完 PRD 草案后，立刻提问：
> "以上是为您起草的 PRD，如需调整请告诉我。确认无误后即将发布到禅道，确认吗？(Y/N/修改意见)"

- 收到 **Y**：进入步骤 3
- 收到 **N**：停止发布
- 收到修改意见：修改后再次询问

### 步骤 3：发布至禅道系统 ⚠️

> 此步骤已在 AGP Manifest 的 `requires-approval` 中声明，网关将自动拦截 `createProductStory` 调用，请求人工确认。

调用 `createProductStory`：
- `productId`：使用前置检查中确定的产品 ID
- `title`：步骤 1 提炼的标题
- `spec`：完整的 PRD Markdown 文本
- `pri`：默认优先级 3（或根据用户语境分配）

成功后汇报：已创建的禅道 Story ID 及链接。
