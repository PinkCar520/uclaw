# Anthropic 团队 Claude 使用工作流 · 深度指导手册

> 整理自 Boris Cherny（Claude Code 创始人）、Scott White（Anthropic 企业产品负责人）、Meaghan Choi（Claude Code 设计主管）的第一手分享。适用于开发者、产品经理、知识工作者。

**原始资料来源：**
- Boris Cherny Threads：https://www.threads.com/@boris_cherny/post/DTBVlMIkpcm/
- Boris Cherny 团队最佳实践：https://www.threads.com/@boris_cherny/post/DUMZr4VElyb/
- VentureBeat 深度解读：https://venturebeat.com/technology/the-creator-of-claude-code-just-revealed-his-workflow-and-developers-are
- Scott White 播客采访：https://creatoreconomy.so/p/inside-the-best-ai-model-for-coding-claude-scott-white
- Scott White CNBC 采访（Vibe Working）：https://www.cnbc.com/2026/02/05/anthropic-claude-opus-4-6-vibe-working.html
- Anthropic 内部研究报告：https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic

---

## 第一章：核心思维模型 — 从"使用工具"到"调度舰队"

### 1.1 最重要的认知升级

Anthropic 团队内部最核心的转变是：**把 Claude 从"对话助手"重新理解为"可并发调度的计算资源"**。

传统思维：写一个任务 → 等待回复 → 审阅 → 继续下一个任务（串行）

Anthropic 思维：同时启动 5–10 个 Claude 会话 → 各自独立执行不同任务 → 人负责方向和验收（并行）

这是生产力提升的根本来源，不是提示词技巧，是工作方式的重构。

### 1.2 三类角色的思维框架

**开发者（Boris Cherny 模式）**：你是舰队司令，Claude 是你的舰队。你不写代码，你指挥代码被写。

**产品经理（Scott White 模式）**：你是策展人，Claude 是执行层。你负责"品味"和方向，Claude 负责产出。

**知识工作者（Cowork 模式）**：你是委托人，Claude 是有能力的虚拟同事。你描述目标，Claude 完成工作。

---

## 第二章：Boris Cherny 的个人工作流（开发者视角）

### 2.1 并行会话 — 单人等于小团队的秘密

**核心做法：**
- 终端同时运行 5 个 Claude Code 会话（用 iTerm2 标签编号 1–5）
- 开启系统通知（iTerm2 Notifications），某个 Claude 需要输入时会弹出提醒
- 同时在浏览器中运行 5–10 个 claude.ai/code 会话
- 使用 `--teleport` 命令在终端和 Web 之间无缝切换会话

**为什么这样做：**
> 当一个 Agent 在跑测试，另一个在重构旧模块，第三个在写文档——这才是真正的并行生产。

**操作方法（Claude Code CLI）：**
```bash
# 在各自独立的 git worktree 中启动并行会话
claude --worktree   # 自动创建隔离的 worktree
claude --worktree --name feature-auth   # 指定名称
claude --worktree --tmux   # 在独立的 Tmux session 中启动

# 团队推荐：设置 shell 别名快速跳转
alias za='cd worktrees/a && claude'
alias zb='cd worktrees/b && claude'
alias zc='cd worktrees/c && claude'
```

**适用于 OceanPanda 项目：** 可以同时运行：
- 会话 A：处理 RSS Worker 的新功能开发
- 会话 B：调试 Clash 代理配置问题
- 会话 C：写 Next.js 前端组件
- 会话 D：专门的"分析 worktree"，只用来读 Docker 日志 / 跑 TimescaleDB 查询

---

### 2.2 Git Worktree — 并行不冲突的基础设施

**核心问题：** 多个 Claude 会话同时在同一个 repo 工作，会互相覆盖文件。

**解决方案：Git Worktree** — 让每个会话在独立的目录/分支工作，互不干扰。

```bash
# 手动创建 worktree
git worktree add ../project-feature-a feature-branch-a
git worktree add ../project-feature-b feature-branch-b

# 用 Claude Code 原生支持（推荐）
claude --worktree

# 清理已完成的 worktree
git worktree remove ../project-feature-a
```

**团队里有人专门设置了一个"分析 worktree"**，这个 worktree 只读不写，专门用于：
- 查看 Docker 日志
- 运行 BigQuery / 数据库查询
- 阅读和分析代码，不产生任何修改

---

### 2.3 模型选择 — 逆直觉的效率公式

**Boris 的结论：** 对于编程任务，始终使用 Claude Opus（最大模型）+ 思考模式（Extended Thinking）。

**理由：**
> "Opus 虽然更慢，但需要纠错的次数更少、工具调用更精准。算上纠错时间，用大模型往往比用小模型更快。"

**效率公式：**
```
总时间 = 生成时间 + 纠错时间 + 反复沟通时间

小模型：生成快 + 纠错多 + 反复沟通多 = 总时间长
大模型：生成慢 + 纠错少 + 沟通少   = 总时间短
```

**实践建议：**
- 复杂任务、新功能开发、架构设计 → 用 Opus + 思考模式
- 简单重复任务、格式转换 → 可以用 Sonnet 节省成本
- 调试线上问题（时间敏感）→ 先用 Sonnet 快速诊断，再用 Opus 深入修复

---

### 2.4 CLAUDE.md — 团队记忆的基础设施

**问题：** Claude 每次会话都是全新的，不记得项目的规范、踩过的坑、团队约定。

**解决方案：** `CLAUDE.md` 文件，放在项目根目录，Claude Code 每次启动自动读取。

**Boris 团队的做法：**
> "我们整个团队共用一个 CLAUDE.md，提交到 git，全团队每周多次更新。每次发现 Claude 做错了什么，就把规则加进去。每个错误都变成一条规则。"

**CLAUDE.md 文件结构模板（适合 OceanPanda）：**

```markdown
# OceanPanda 项目 Claude 使用规范

## 项目架构概述
- 后端：FastAPI + PostgreSQL/TimescaleDB + Redis
- 代理：Clash（取代 sing-box），用于路由 Bloomberg/WSJ/FT/Reuters 流量
- 前端：Next.js
- 部署：Docker Compose on Tencent Cloud
- RSS：RSSHub 实例

## 重要规范
- Docker Compose 环境变量命名：使用 SNAKE_UPPER_CASE，已知坑：RSSHub 的环境变量前缀是 RSSHUB_
- Clash 配置文件：不能直接 volume mount 到 /etc/clash/config.yaml（会变成目录），需要 mount 到父目录再软链接
- 数据库迁移：必须先备份 TimescaleDB 连续聚合视图
- 代理节点：Bloomberg/WSJ/FT 走香港节点，Reuters 可走直连，Gemini API 走美国节点

## Claude 不该做的事（踩坑记录）
- 不要直接修改 docker-compose.yml 的 volume 配置而不先检查现有 mount 点
- 不要在没有确认 Redis 连接的情况下启动 RSS Worker
- 不要用 pip install 而不加 --break-system-packages

## 每次 PR 前必须做的事
- 运行 /verify-proxy 确认代理路由正常
- 检查 TimescaleDB 连续聚合是否还在刷新
- 跑 RSS 抓取测试
```

**维护方式：**
```bash
# 每次 Claude 犯错后，立即更新
echo "- 不要...（描述错误）" >> CLAUDE.md
git add CLAUDE.md && git commit -m "docs: update Claude rules"
```

---

### 2.5 Slash Commands — 内循环任务的自动化

**核心原则：** 每天做超过一次的事，就变成一个 slash command。

**Boris 每天使用几十次的命令：`/commit-push-pr`**

```bash
# .claude/commands/commit-push-pr.md
---
description: 提交当前变更，推送到远端，创建 PR
---

!git status --short
!git diff --stat

请：
1. 根据上面的变更内容，生成一个符合 conventional commits 规范的 commit message
2. 执行 git add -A && git commit -m "[你生成的消息]"
3. git push origin HEAD
4. 使用 gh pr create 创建 PR，标题基于 commit message，body 描述变更内容
```

**团队推荐的 slash commands：**

```bash
# /techdebt - 每次会话结束时运行，清理技术债务
# .claude/commands/techdebt.md
扫描当前会话中修改过的文件，找出：
1. 重复代码（超过3处相似逻辑）
2. 未使用的 imports
3. TODO/FIXME 注释
4. 过长的函数（超过50行）
列出问题清单，询问我是否现在处理。

# /sync-context - 每天开始时同步上下文
# .claude/commands/sync-context.md  
!git log --oneline -20
!cat CLAUDE.md
!docker compose ps
读取最近 7 天的 git 提交记录、项目当前状态，告诉我项目现在处于什么状态，今天适合做什么工作。
```

**适合 OceanPanda 的自定义 commands：**
```
/check-proxy    — 测试所有代理节点连通性（Bloomberg/WSJ/Gemini）
/rss-test      — 运行全量 RSS 源抓取测试，输出成功率报告
/db-backup     — 备份 TimescaleDB 关键表
/deploy        — 拉取最新代码，重启 Docker 服务，检查健康状态
```

---

### 2.6 Subagents — 专业化的工作流分工

**概念：** 创建有特定角色和详细指令的子 Agent，处理特定阶段的工作。

**Boris 使用的 Subagents：**
- `code-simplifier`：主体工作完成后运行，简化和重构代码
- `verify-app`：提交前端到端测试整个应用

**创建方式（agent frontmatter）：**
```markdown
---
name: code-reviewer
description: 以资深工程师视角审查代码变更
model: claude-opus-4-6
isolation: worktree
---

你是一个有10年经验的后端工程师。审查以下代码变更，重点关注：
1. 安全漏洞（SQL注入、未验证输入等）
2. 性能问题（N+1查询、未加索引等）  
3. 错误处理是否完整
4. 是否符合 CLAUDE.md 中的项目规范

给出具体、可操作的改进建议，格式为编号列表。
```

---

### 2.7 Plan Mode — 复杂任务的正确打开方式

**核心原则：** 复杂任务先规划，后执行。把精力集中在计划质量上，让 Claude 一次性完成实现。

**最强的双 Claude 审查模式（Claude Code 团队内部使用）：**

```
第一步：让 Claude A 写计划
"请为以下任务制定详细实现计划，但先不要写代码：[任务描述]
 计划应包含：技术方案、文件变更列表、潜在风险、测试策略"

第二步：让 Claude B 审计划（以资深工程师身份）
"你是资深工程师。以下是一个实现计划，请以批判性视角审查：
 [粘贴第一步的计划]
 找出潜在问题、遗漏的边界条件、更好的替代方案"

第三步：整合反馈后，开始实现
"根据以上审查意见，修改计划并开始实现"
```

**何时切换回 Plan Mode：**
> "一旦发现事情走偏，立刻切回 Plan Mode 重新规划，而不是在错误路径上继续调试。"

---

### 2.8 Debug 最佳实践 — 让 Claude 自己修 Bug

**直接指向错误源头，不要手动复制粘贴：**

```bash
# 把 Docker 日志直接丢给 Claude
docker compose logs rss-worker --tail=100 | claude "分析这些日志，找出错误原因并修复"

# 让 Claude 直接去修 CI 失败
claude "Go fix the failing CI tests."  # 不要说"如何"，直接说"去修"

# Slack MCP 集成（如果启用）
# 粘贴 bug 报告的 Slack 链接给 Claude，说 "fix"，零上下文切换
```

**挑战 Claude 做代码审查：**
```
"Grill me on these changes and don't make a PR until I pass your test."
（用这次变更来考我，我通过测试之前不要创建 PR）
```

---

## 第三章：Scott White 的工作流（产品经理视角）

### 3.1 "Vibe Working" 时代的 PM 工作方式

**核心理念：**
> "Vibe Coding 让人们能把想法直接变成软件。现在我们正在进入 Vibe Working 时代——不只是代码，所有知识工作都可以这样做。"

**PM 现在能做的事（以前需要一个团队）：**
- 自己写 PRD，自己创建 evals，自己实现并验证 evals
- 用 Extended Thinking 连接多个文档的逻辑
- 用 Claude 生成用户流程图，直接发给工程师和设计师

---

### 3.2 Scott White 的 PRD 工作流（产品需求文档）

**完整流程：**

```
第一步：收集材料，建立 Claude Project
→ 把客户反馈、用户调研、竞品分析全部丢进一个 Claude Project

第二步：口述问题和方案
→ "我要解决的问题是 [X]，我想到的解决方案是 [Y]，帮我写 PRD"

第三步：Claude 写 PRD 初稿
→ 你审阅，补充"品味"和业务判断

第四步：基于 PRD 创建 Evals（关键步骤！）
→ "基于这份 PRD，为 Claude 的 [具体能力] 写评估标准"

第五步：实现并运行 Evals
→ 用 Claude 写测试用例，自动化运行，看 pass rate

第六步：用 Extended Thinking 跨文档连接
→ "综合这个 PRD、这些 evals 结果、这份用户反馈，告诉我产品下一步应该怎么走"
```

---

### 3.3 Evals 驱动的产品开发

这是 Scott White 最独特的方法论，也是 Anthropic 内部的核心工作方式。

**传统 PM：** 写需求 → 工程师实现 → QA 测试 → 上线

**Scott White：** 写需求 → **写 evals（先定义"什么叫做好"）** → 工程师+Claude 实现 → evals 自动验证 → 上线

**Eval 写法示例：**

```markdown
# Eval：Claude 的领域专家解释风格

## 测试场景
用户偏好字符串：「我是软件工程师，不熟悉金融」

## 测试提示
"请解释什么是做市商机制"

## 评估标准（让 Claude 自己打分）
Claude 的回答应该：
- [必须] 使用技术类比（比如 API、缓存等工程概念）
- [必须] 不要假设用户懂金融术语，要先解释
- [加分] 给出代码思维视角的类比
- [扣分] 使用未解释的金融专业词汇

请给这个回答打分（0-10）并解释原因。
```

**让 Claude 做 Eval 的评委：**
```
"这是我们的评估标准：[evals]
这是 Claude 的实际输出：[output]
请评估这个输出是否满足标准，给出分数和具体理由"
```

---

### 3.4 普通 Claude vs Extended Thinking 的使用边界

| 任务类型 | 使用模式 | 原因 |
|---------|---------|------|
| 写文档、PRD | 普通 Claude | 线性创作，不需要深度推理 |
| 邮件、摘要 | 普通 Claude | 快速、成本低 |
| 跨文档连接逻辑 | Extended Thinking | 需要在大量信息间找关联 |
| 复杂编码任务 | Extended Thinking | 减少错误，少纠错 |
| 生成用户流程图 | Extended Thinking | 需要理解全局再可视化 |
| 多 PRD 的战略分析 | Extended Thinking | 跨文档推理 |

---

### 3.5 Claude Projects 的正确使用姿势

**Scott White 的 Project 组织方式：**

每个大型产品 Initiative 建立一个独立的 Project，放入：
- PRD 文档
- Evals 文件
- 用户反馈汇总
- 竞品分析
- 工程约束文档

**好处：** Claude 能在 Extended Thinking 模式下把所有这些文档关联起来，给出跨文档的洞察。

**实际操作：**
```
1. 创建 Project "OceanPanda - 国际新闻代理优化"
2. 上传：
   - 当前 Clash 配置文档
   - 各新闻源的抓取成功率报告
   - Tencent Cloud 网络架构图
3. 提问："综合这些资料，给出最优的代理路由策略，
         重点考虑延迟、成本和稳定性的平衡"
```

---

## 第四章：Cowork 与知识工作新范式（企业工作流）

### 4.1 核心理念："完整协作者"而非"助手"

**Scott White：**
> "Claude 已经从'你可以和它对话完成小任务'，变成了'你可以把真正重要的工作托付给它'。"

**思维转变：**
- 旧模式：我来做，Claude 来辅助
- 新模式：Claude 来做，我来把关方向和质量

---

### 4.2 Cowork 的任务委托模式

**Dispatch 模式（把整个任务丢出去）：**

```
不要说："帮我想想这个邮件怎么写"
应该说："起草一封给 Tencent Cloud 技术支持的邮件，
         说明我们在使用 CVM + Docker 时遇到的 IPv6 路由问题，
         附上我们已经尝试过的排查步骤（见附件），
         要求他们给出具体解决方案，语气专业但有紧迫感"
```

**Boris Cherny 用 Cowork 做项目管理的案例：**
> "我用它自动在 Slack 上提醒没有更新共享表格的团队成员——这是以前我需要自己盯着做的事。"

---

### 4.3 MCP 集成 — 消除上下文切换

**最高效的 Cowork 模式是 Claude 直接连接你的工具：**

```bash
# 启用 Slack MCP 后
"把这个 Slack bug 报告帖子粘贴给 Claude，说 'fix'"
→ Claude 直接读取帖子，理解问题，修复代码，不需要你手动复制

# GitHub + Jira 集成
"从 Jira 票 OCEAN-142 取任务描述，实现对应功能，创建 PR"
→ Claude 全程自动，你只需审 PR
```

**适合 OceanPanda 的 MCP 集成：**
- Slack MCP：让 Claude 直接看 bug 报告频道
- GitHub MCP：让 Claude 自己创建 PR、查 CI 状态
- Docker（通过 bash 工具）：让 Claude 直接看容器日志

---

### 4.4 "平台思维"而非"产品思维"

**Scott White 对 Claude 的定位：**
> "我们把自己定位为平台，不是产品，试图覆盖每一个工作流。Claude 现在可以直接嵌入到 Excel、PowerPoint 等工具中拉取数据，无需用户在应用之间复制粘贴。"

**对你的启示：**
- 不要把 Claude 当成一个单独的工具
- 要思考：我的哪些工作流可以让 Claude 直接接入数据源？
- 优先级：消除手动的"复制粘贴"步骤，让 Claude 直连数据

---

## 第五章：Meaghan Choi 的工作流（设计 × 代码）

### 5.1 设计主管为什么自己写代码

Meaghan Choi 是 Claude Code 的设计主管，她自己也写代码、提交 PR。

**原因：**
> "当你能自己实现设计，反馈循环从几天缩短到几小时。工程师不需要猜测你的意图，因为你直接给他们可以运行的代码。"

### 5.2 设计到代码的工作流

```
第一步：用 Extended Thinking 生成用户流程图
→ "根据这个 PRD，生成用户完成 [核心任务] 的完整流程图，
   以 Mermaid 格式输出，高亮关键决策点"

第二步：用 Claude Code 生成 UI 组件原型
→ "根据这个流程图，生成对应的 React 组件，
   使用 Tailwind CSS，风格参考 [项目设计系统]"

第三步：迭代细节
→ "这个按钮的 hover 状态不对，应该是..."
→ "间距需要调整，参照 8px 网格系统"

第四步：直接提交 PR
→ /commit-push-pr
```

### 5.3 设计师的 Top 3 Claude Code 使用场景

1. **快速原型**：把线框图描述给 Claude，立刻得到可运行的 HTML/React 原型
2. **设计系统维护**：用 Claude 批量更新旧组件，使其符合新的设计 token
3. **跨平台一致性检查**：让 Claude 对比 Web 和 Mobile 实现，找出视觉差异

---

## 第六章：通用最佳实践 — 适用于所有人

### 6.1 任务委托决策框架

**适合委托给 Claude 的任务（优先委托）：**
- 结果容易验证（有对错标准）
- 低风险（错了可以撤销）
- 你自己"觉得无聊、不感兴趣"的任务
- 重复性工作（超过一次）

**建议自己做的任务（暂时保留）：**
- 需要深度业务判断的决策
- 涉及人际关系的沟通（先起草，但自己把关语气）
- 你想通过做这件事来保持技能的任务

**Anthropic 工程师的原话：**
> "我越兴奋想做的任务，越不会用 Claude。兴奋感说明这是我想亲自做的事。"

---

### 6.2 防止技能退化的刻意练习

**Anthropic 内部工程师的做法：**
> "每隔一段时间，即使我知道 Claude 能搞定，我也会不用它，自己做。这帮我保持思维敏锐。"

**实践建议：**
- 每周留 1–2 个小任务给自己独立完成
- 用 Claude 做的工作，尽量理解原理（不只是复制结果）
- 在 CLAUDE.md 里记下你自己"学到的东西"，不只是 Claude 的规则

---

### 6.3 提示词质量的提升路径

**Level 1（基础）：** 描述你要什么
```
"帮我写一个 Python 脚本，从 RSS feed 抓取文章"
```

**Level 2（进阶）：** 给出上下文 + 约束 + 验收标准
```
"帮我写一个 Python 脚本，从 RSS feed 抓取文章。
 要求：使用 async/aiohttp，错误处理要完善，
 单个 feed 失败不影响其他 feed，
 输出格式是 JSON，包含 title/url/published_at/content 字段。
 完成后告诉我怎么测试它。"
```

**Level 3（Anthropic 团队模式）：** Plan First + 明确角色 + 挑战结果
```
"第一步先不要写代码，给我一个实现计划：
 [任务描述]
 计划需要包含：方案对比（至少两个）、风险点、我需要做的决定。

 计划通过后再开始实现。

 实现完成后，列出你认为可能的边缘案例，
 并说明你的代码如何处理它们。"
```

---

### 6.4 每日/每周工作流模板

**每天开始（5 分钟）：**
```
运行 /sync-context
→ Claude 读取最近 git 记录 + CLAUDE.md + 服务状态
→ 告诉你"项目现状 + 今天适合做什么"
```

**开始新任务前：**
```
切换到 Plan Mode
→ 先出计划，再执行
→ 复杂任务用双 Claude 审计划
```

**每次 PR 前：**
```
运行 verify-app subagent
→ 端到端测试
→ /commit-push-pr
```

**每次会话结束后：**
```
运行 /techdebt
→ 找重复代码、TODO、未处理的错误
→ 更新 CLAUDE.md（如果 Claude 犯了新错误）
```

**每周一次：**
```
回顾 CLAUDE.md
→ 有哪些规则可以合并？
→ 有哪些新踩的坑需要加入？
→ 哪些 slash commands 值得创建？
```

---

## 附录：快速参考卡

### 并行工作
```bash
claude --worktree --name [任务名]   # 新建隔离会话
claude --worktree --tmux            # Tmux 模式
```

### 记忆系统
```
CLAUDE.md → 项目规范 + 踩坑记录
.claude/commands/ → slash commands
agent frontmatter → subagent 定义
```

### 模型选择
```
复杂任务 → Opus + Extended Thinking
日常任务 → Sonnet
简单格式 → Haiku
```

### 任务触发语
```
Bug 修复："Go fix the failing CI tests."（不解释如何）
代码审查："Grill me on these changes."
提交："run /commit-push-pr"
规划："先给我计划，不要写代码"
```

---

*文档版本：2026年3月 | 基于 Boris Cherny、Scott White、Meaghan Choi 的公开分享整理*
