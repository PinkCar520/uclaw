---
name: write-prd
description: "产品经理的智能需求助手：起草 PRD (产品需求文档) 并将其发布到禅道。触发条件：用户要求写需求、规划产品、创建 Story、写 PRD、起草 PRD、我要做一个功能时激活。"
allowed-tools:
  - listProducts
  - searchProductStories
  - createProduct
  - createProject
  - createProductStory
requires-approval:
  - createProductStory
  - createProduct
  - createProject
compatibility: "需要 mcp-zentao MCP Server"
locales:
  zh:
    displayName: "PRD 需求助手"
    description: "起草 PRD 产品需求文档并发布到禅道系统"
  en:
    displayName: "PRD Writer Assistant"
    description: "Draft PRD documents and publish them to ZenTao system"
---

# Write PRD — 智能需求起草与同步工作流

## 触发时机

当用户提到以下任意关键词时，激活本 Skill：
- 中文：写需求、规划产品、创建需求、写 PRD、起草 PRD、我要做一个功能
- 英文：write prd、create story、new story、product design

## 前置检查

开始前，执行以下自检：
1. 分析描述：如果描述太短（少于 10 个字），先提问：“请详细描述功能目标和业务逻辑。”
2. 环境感知：调用 `listProducts` 获取现有产品列表。
   - 如果列表为空：告知用户当前禅道环境为空，引导用户先创建一个产品线（调用 `createProduct`）。
   - 如果有产品：记录产品 ID 以备后续发布使用。

如果用户已经给出了足够的信息且确认了产品归属，则开始后续步骤。

## 执行步骤

复制此进度清单并在响应中展示给用户，随步骤完成逐项打勾：

```
PRD 起草与发布进度：
- [ ] 步骤 1：智能提炼需求标题与详述
- [ ] 步骤 2：PRD 草案确认 (需人工)
- [ ] 步骤 3：发布至禅道系统
```

### 步骤 1：智能提炼需求标题与详述

根据用户的描述，撰写出一份专业的 PRD (产品需求文档) 模板。PRD 必须包含以下结构：

1. **需求标题**：简明扼要，格式如 `【新增】积分商城入口` 
2. **需求背景及目标**：为什么要做这个功能？要解决什么痛点？
3. **核心业务逻辑**：分条列出功能点。
4. **验证标准 (Acceptance Criteria)**：测试和验收的标准。

**请直接向用户展示这份 PRD 草案（使用 Markdown 格式渲染）。**

### 步骤 2：PRD 草案确认 (⚠️ 需要用户确认)

**执行前，必须明确询问用户（参见工具确认规范）**

向用户展示完 PRD 草案后，立刻提问：
> "以上是为您起草的 PRD，如果有需要调整的地方请告诉我。如果确认无误，即将为您将其发布到禅道，确认发布吗？(Y/N/修改意见)"

收到用户 **Y** 后，进入步骤 3。
收到 **N** 则停止发布。
收到修改意见，则根据建议修改 PRD 草案并再次询问。

### 步骤 3：发布至禅道系统

调用 `createProductStory` 工具：
- `productId`：使用 `listProducts` 中确定的 ID。如果用户刚创建了新产品，请使用该新产品的 ID。
- `title`：传入步骤 1 提炼的标题
- `spec`：传入完整的 PRD Markdown 文本
- `pri`：默认优先级 3（或根据用户语境分配）

成功后，向用户汇报已成功创建的禅道 Story ID 及链接。如果需要，引导用户继续创建对应的“项目”或“执行”来推进排期。

## ⚠️ 工具确认规范

发布需求到禅道是写操作，必须在执行 `createProductStory` 前请求人工确认：
- 展示将要发布的 PRD 具体内容。
- 等待用户回复 Y（确认）或明确的修改意见。
- **不得在未收到明确发布指令的情况下自动调用创建工具**
