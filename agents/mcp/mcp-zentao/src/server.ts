#!/usr/bin/env node
/**
 * Ocean ZenTao MCP Server
 *
 * 标准的 Model Context Protocol 服务端实现。
 * 将 ZenTao 缺陷管理能力以 MCP 协议暴露给 Gateway MCPClientManager。
 *
 * 通信方式：Stdio（由 Gateway 以子进程方式启动）
 *
 * UI Protocol 集成：
 * 每个工具返回的文本中可包含 __UI__:{"uiType":"...","props":{...}} 标记，
 * 由 Gateway 的 MCPClientManager 解析并附加到结果对象中，供前端 UIRenderer 渲染。
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ZentaoTool } from '@ocean/tools-zentao';

// ──────────────────────────────────────────────
// UI Protocol 辅助函数
// ──────────────────────────────────────────────

/** 将结构化 UI 数据嵌入 MCP 返回文本中（供 Gateway 解析） */
function withUI(uiType: string, props: Record<string, unknown>, textContent: string): string {
  return `${textContent}\n\n__UI__:${JSON.stringify({ uiType, props })}`;
}

// 从环境变量读取配置（由 Gateway 启动子进程时注入）
const zentao = new ZentaoTool({
  baseUrl: process.env['ZENTAO_BASE_URL'] ?? '',
  token: process.env['ZENTAO_API_TOKEN'] ?? '',
  isMock: !process.env['ZENTAO_BASE_URL'],
});

// ──────────────────────────────────────────────
// 创建 MCP Server 实例
// ──────────────────────────────────────────────
const server = new McpServer({
  name: 'ocean-zentao',
  version: '1.0.0',
});

// ──────────────────────────────────────────────
// Resources 定义：暴露只读数据资源
// ──────────────────────────────────────────────

/**
 * 资源：单个缺陷详情
 * URI 模板: zentao://bugs/{bugId}
 */
server.registerResource(
  'bug-details',
  new ResourceTemplate('zentao://bugs/{bugId}', {
    list: undefined,
  }),
  {
    description: '获取指定缺陷的详细信息',
    mimeType: 'application/json',
  },
  async (uri, variables) => {
    const bugId = variables['bugId'] as string;
    const bug = await zentao.getBugInfo(bugId);
    if (!bug) {
      return { contents: [{ uri: uri.toString(), text: `未找到 ID 为 ${bugId} 的缺陷` }] };
    }
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(bug, null, 2), mimeType: 'application/json' }] };
  },
);

/**
 * 资源：产品缺陷列表
 * URI 模板: zentao://products/{productId}/bugs
 */
server.registerResource(
  'product-bugs',
  new ResourceTemplate('zentao://products/{productId}/bugs', {
    list: undefined,
  }),
  {
    description: '获取指定产品的缺陷列表',
    mimeType: 'application/json',
  },
  async (uri, variables) => {
    const productId = variables['productId'] as string;
    const stats = await zentao.getBugStats(parseInt(productId));
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(stats, null, 2), mimeType: 'application/json' }] };
  },
);

/**
 * 资源：需求详情
 * URI 模板: zentao://stories/{storyId}
 */
server.registerResource(
  'story-details',
  new ResourceTemplate('zentao://stories/{storyId}', {
    list: undefined,
  }),
  {
    description: '获取指定需求的详细信息',
    mimeType: 'application/json',
  },
  async (uri, variables) => {
    const storyId = variables['storyId'] as string;
    const story = await zentao.getStoryInfo(storyId);
    if (!story) {
      return { contents: [{ uri: uri.toString(), text: `未找到 ID 为 ${storyId} 的需求` }] };
    }
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(story, null, 2), mimeType: 'application/json' }] };
  },
);

/**
 * 资源：产品列表（静态资源）
 */
server.registerResource(
  'products-list',
  'zentao://products',
  {
    description: '获取所有产品列表',
    mimeType: 'application/json',
  },
  async (uri) => {
    const products = await zentao.listProducts();
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(products, null, 2), mimeType: 'application/json' }] };
  },
);

// ──────────────────────────────────────────────
// Prompts 定义：预定义提示词模板
// ──────────────────────────────────────────────

/**
 * 提示词：缺陷分析报告
 */
server.prompt(
  'bug-analysis-report',
  '生成指定禅道缺陷的详细分析报告，包括根因分析、影响评估和修复建议',
  {
    bugId: z.string().describe('缺陷 ID'),
    includeStats: z.boolean().optional().default(false).describe('是否包含产品缺陷统计'),
  },
  ({ bugId, includeStats }) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `请基于缺陷 #${bugId} 生成一份详细的分析报告。

报告应包含：
1. **缺陷概述**：标题、状态、严重程度、指派人
2. **根因分析**：可能的原因和触发条件
3. **影响评估**：受影响的用户群体和业务场景
4. **修复建议**：具体的修复步骤和测试策略
5. **预防措施**：如何避免类似问题${
            includeStats
              ? `\n6. **产品缺陷统计**：当前产品的整体质量趋势`
              : ''
          }

请使用 getBugInfo 工具获取缺陷详情，${
            includeStats ? 'getBugStats 获取统计数据，' : ''
          }然后生成报告。`,
        },
      },
    ],
  }),
);

/**
 * 提示词：需求评审助手
 */
server.prompt(
  'story-review',
  '对指定禅道需求进行评审，检查完整性、清晰度和可测试性',
  {
    storyId: z.string().describe('需求 ID'),
  },
  ({ storyId }) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `请对需求 #${storyId} 进行评审。

评审要点：
1. **需求完整性**：是否包含所有必要信息（目标、范围、验收标准）
2. **需求清晰度**：描述是否明确，是否存在歧义
3. **可测试性**：是否有明确的测试场景和预期结果
4. **依赖识别**：是否识别了外部依赖和风险
5. **改进建议**：具体的优化建议

请使用 getStoryInfo 工具获取需求详情，然后生成评审报告。`,
        },
      },
    ],
  }),
);

/**
 * 提示词：产品健康度报告
 */
server.prompt(
  'product-health-report',
  '生成产品整体健康度报告，包括缺陷趋势、活跃需求和风险点',
  {
    productId: z.number().optional().default(4).describe('产品 ID，默认为 4'),
  },
  ({ productId }) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `请生成产品 #${productId} 的整体健康度报告。

报告应包含：
1. **缺陷概览**：总缺陷数、活跃缺陷、已解决缺陷
2. **趋势分析**：缺陷创建 vs 解决趋势
3. **需求状态**：活跃需求数、待开发需求
4. **风险识别**：高严重度缺陷、阻塞需求
5. **质量评分**：基于缺陷密度和解决速度的整体评分
6. **改进建议**：提升产品质量的具体行动

请使用 getBugStats 获取缺陷统计，listProducts 确认产品信息，然后生成综合报告。`,
        },
      },
    ],
  }),
);
server.tool(
  'getBugInfo',
  '获取禅道指定缺陷的详细信息（标题、状态、指派人、严重程度）',
  {
    bugId: z.string().describe('缺陷 ID，例如 BUG-2048 或纯数字 2048'),
  },
  async ({ bugId }) => {
    const bug = await zentao.getBugInfo(bugId);
    if (!bug) {
      return {
        content: [{ type: 'text' as const, text: `未找到 ID 为 ${bugId} 的缺陷` }],
        isError: true,
      };
    }
    const textSummary = `缺陷 #${bug.id}: ${bug.title}\n状态: ${bug.status}\n指派人: ${bug.assignee}\n严重程度: ${bug.severity}`;
    return {
      content: [{
        type: 'text' as const,
        text: withUI('bug_card', {
          id: String(bug.id),
          title: bug.title,
          status: bug.status,
          assignee: bug.assignee,
          severity: bug.severity,
          description: bug.description,
          createdAt: bug.createdAt,
        }, textSummary),
      }],
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：searchBugs
// ──────────────────────────────────────────────
server.tool(
  'searchBugs',
  '根据关键词在禅道中搜索缺陷列表',
  {
    query: z.string().describe('搜索关键词，如功能模块名、错误信息片段'),
  },
  async ({ query }) => {
    const bugs = await zentao.searchBugs(query);
    const textContent = bugs.length > 0
      ? `找到 ${bugs.length} 个与 "${query}" 相关的缺陷\n${bugs.map((b: any) => `  #${b.id}: ${b.title} [${b.status}]`).join('\n')}`
      : `未找到与 "${query}" 相关的缺陷`;
    return {
      content: [{
        type: 'text' as const,
        text: withUI('bug_list', {
          title: `搜索结果: "${query}"`,
          items: bugs.map((b: any) => ({
            id: String(b.id),
            title: b.title,
            status: b.status,
            assignee: b.assignee,
            severity: b.severity,
            description: b.description,
            createdAt: b.createdAt,
          })),
        }, textContent),
      }],
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：resolveBug
// ──────────────────────────────────────────────
server.tool(
  'resolveBug',
  '将禅道中指定缺陷标记为"已解决"（Resolved）状态',
  {
    bugId: z.string().describe('缺陷 ID，例如 BUG-5 或纯数字 5'),
    resolution: z
      .enum(['fixed', 'wontfix', 'bydesign', 'duplicate', 'external'])
      .optional()
      .default('fixed')
      .describe('解决方案类型，默认为 fixed（已修复）'),
  },
  async ({ bugId, resolution }) => {
    const res = (resolution ?? 'fixed') as 'fixed' | 'wontfix' | 'bydesign' | 'duplicate' | 'external';
    const success = await zentao.resolveBug(bugId, res);
    const textMsg = success
      ? `✓ 缺陷 ${bugId} 已成功标记为已解决（${res}）`
      : `✗ 解决缺陷 ${bugId} 失败，请检查权限或缺陷状态`;
    return {
      content: [{
        type: 'text' as const,
        text: success
          ? withUI('approval_card', {
              requestId: `resolve-${bugId}-${Date.now()}`,
              toolName: 'resolveBug',
              description: `将缺陷 #${bugId} 标记为已解决（方案: ${res}）`,
              args: { bugId, resolution: res },
              status: success ? 'approved' as const : 'rejected' as const,
            }, textMsg)
          : textMsg,
      }],
      isError: !success,
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：getBugStats
// ──────────────────────────────────────────────
server.tool(
  'getBugStats',
  '获取禅道产品的缺陷统计数据（总数、活跃、已解决）',
  {
    productId: z
      .number()
      .optional()
      .default(4)
      .describe('禅道产品 ID，默认为 4（Ocean 产品）'),
  },
  async ({ productId }) => {
    const pid = productId ?? 4;
    const stats = await zentao.getBugStats(pid);
    const summary = `共 ${stats.total} 个缺陷，活跃 ${stats.active} 个，已解决 ${stats.resolved} 个`;
    return {
      content: [{
        type: 'text' as const,
        text: withUI('stats_card', {
          title: '禅道产品缺陷统计',
          metrics: [
            { label: '总缺陷', value: stats.total ?? 0, trend: 'neutral' as const },
            { label: '活跃', value: stats.active ?? 0, trend: 'down' as const },
            { label: '已解决', value: stats.resolved ?? 0, trend: 'up' as const },
          ],
        }, summary),
      }],
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：createProductStory
// ──────────────────────────────────────────────
server.tool(
  'createProductStory',
  '在禅道指定产品下创建一个新需求（Story）',
  {
    productId: z.number().describe('产品的 ID。如果不知道可以默认传入 4。'),
    title: z.string().describe('需求的标题，应简明扼要。'),
    spec: z.string().describe('需求的详述，支持 Markdown 格式。'),
    pri: z.number().optional().describe('优先级 (1=高, 2=中, 3=低, 4=最低)'),
    estimate: z.number().optional().describe('预估工时'),
  },
  async ({ productId, title, spec, pri, estimate }) => {
    const res = await zentao.createStory(productId, { title, spec, pri, estimate });
    if (!res.success) {
      return {
        content: [{ type: 'text' as const, text: `✗ 创建需求失败：${JSON.stringify(res.error)}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: `✓ 需求创建成功！\n\n${JSON.stringify(res.data, null, 2)}` }],
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：getStoryInfo
// ──────────────────────────────────────────────
server.tool(
  'getStoryInfo',
  '获取禅道指定需求的详细信息',
  {
    storyId: z.string().describe('需求 ID，例如 STORY-101 或纯数字 101'),
  },
  async ({ storyId }) => {
    const story = await zentao.getStoryInfo(storyId);
    if (!story) {
      return {
        content: [{ type: 'text' as const, text: `未找到 ID 为 ${storyId} 的需求` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(story, null, 2) }],
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：searchProductStories
// ──────────────────────────────────────────────
server.tool(
  'searchProductStories',
  '根据关键词在禅道中搜索需求列表',
  {
    query: z.string().describe('搜索关键词，如需求标题片段'),
  },
  async ({ query }) => {
    const stories = await zentao.searchStories(query);
    return {
      content: [
        {
          type: 'text' as const,
          text:
            stories.length > 0
              ? JSON.stringify(stories, null, 2)
              : `未找到与 "${query}" 相关的需求`,
        },
      ],
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：listProducts
// ──────────────────────────────────────────────
server.tool(
  'listProducts',
  '列出禅道中所有的产品列表',
  {},
  async () => {
    const products = await zentao.listProducts();
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(products, null, 2) }],
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：createProduct
// ──────────────────────────────────────────────
server.tool(
  'createProduct',
  '在禅道中创建一个新产品',
  {
    name: z.string().describe('产品名称'),
    code: z.string().describe('产品代号（英文标识）'),
    type: z.enum(['normal', 'multibranch', 'branch']).optional().default('normal').describe('产品类型'),
    desc: z.string().optional().describe('产品描述'),
  },
  async ({ name, code, type, desc }) => {
    const res = await zentao.createProduct({ name, code, type, desc });
    if (!res.success) {
      return {
        content: [{ type: 'text' as const, text: `✗ 创建产品失败：${JSON.stringify(res.error)}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: `✓ 产品创建成功！\n\n${JSON.stringify(res.data, null, 2)}` }],
    };
  },
);

// ──────────────────────────────────────────────
// 工具注册：createProject
// ──────────────────────────────────────────────
server.tool(
  'createProject',
  '在禅道中创建一个新项目或执行周期',
  {
    name: z.string().describe('项目名称'),
    code: z.string().describe('项目代号（英文标识）'),
    begin: z.string().describe('开始日期 (YYYY-MM-DD)'),
    end: z.string().describe('结束日期 (YYYY-MM-DD)'),
    desc: z.string().optional().describe('项目描述'),
    productIds: z.array(z.number()).optional().describe('关联的产品 ID 列表'),
  },
  async ({ name, code, begin, end, desc, productIds }) => {
    const res = await zentao.createProject({ name, code, begin, end, desc, productIds });
    if (!res.success) {
      return {
        content: [{ type: 'text' as const, text: `✗ 创建项目失败：${JSON.stringify(res.error)}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: `✓ 项目创建成功！\n\n${JSON.stringify(res.data, null, 2)}` }],
    };
  },
);

// ──────────────────────────────────────────────
// 启动服务（Stdio Transport）
// ──────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[mcp-zentao] ZenTao MCP Server started via stdio\n');

  // Graceful shutdown on parent disconnect or signal
  const shutdown = () => {
    process.stderr.write('[mcp-zentao] Shutting down...\n');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Also exit when stdin closes (parent disconnected the pipe)
  process.stdin.on('end', shutdown);
  process.stdin.resume(); // keep stdin open until parent closes it
}

main().catch((err: Error) => {
  process.stderr.write(`[mcp-zentao] Fatal error: ${err.message}\n`);
  process.exit(1);
});
