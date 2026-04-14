#!/usr/bin/env node
/**
 * UClaw GitLab MCP Server
 *
 * 将 GitLab 仓库管理以 MCP 协议暴露给 Gateway。
 *
 * 工具列表：
 * - listMRs: 列出合并请求
 * - createMR: 创建合并请求
 * - getMRChanges: 获取 MR 变更文件
 * - addReviewComment: 添加 Review 评论
 * - mergeMR: 合并 MR
 * - listProjects: 列出项目
 *
 * 资源列表：
 * - gitlab://projects/{projectId} - 项目详情
 * - gitlab://projects/{projectId}/merge_requests/{mrId} - MR 详情
 * - gitlab://projects/{projectId}/merge_requests/{mrId}/changes - MR 变更
 *
 * 通信方式：Stdio（由 Gateway 以子进程方式启动）
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GitLabTool } from '@uclaw/tools-gitlab';

// ──────────────────────────────────────────────
// 初始化 GitLab 工具
// ──────────────────────────────────────────────

const gitlab = new GitLabTool({
  baseUrl: process.env['GITLAB_BASE_URL'] || 'https://gitlab.example.com',
  token: process.env['GITLAB_TOKEN'] || '',
});

// ──────────────────────────────────────────────
// 创建 MCP Server 实例
// ──────────────────────────────────────────────
const server = new McpServer({
  name: 'uclaw-gitlab',
  version: '1.0.0',
});

// ──────────────────────────────────────────────
// Resources 定义
// ──────────────────────────────────────────────

/**
 * 资源：项目详情
 */
server.registerResource(
  'project-details',
  new ResourceTemplate('gitlab://projects/{projectId}', { list: undefined }),
  { description: '获取 GitLab 项目详情', mimeType: 'application/json' },
  async (uri, variables) => {
    const projects = await gitlab.listProjects();
    const project = projects.find((p) => p.id === parseInt(variables['projectId'] as string));
    if (!project) {
      return { contents: [{ uri: uri.toString(), text: `未找到项目: ${variables['projectId']}` }] };
    }
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(project, null, 2), mimeType: 'application/json' }] };
  },
);

/**
 * 资源：MR 详情
 */
server.registerResource(
  'mr-details',
  new ResourceTemplate('gitlab://projects/{projectId}/merge_requests/{mrIid}', { list: undefined }),
  { description: '获取 GitLab MR 详情', mimeType: 'application/json' },
  async (uri, variables) => {
    const mrs = await gitlab.listMRs(parseInt(variables['projectId'] as string));
    const mr = mrs.find((m) => m.iid === parseInt(variables['mrIid'] as string));
    if (!mr) {
      return { contents: [{ uri: uri.toString(), text: `未找到 MR: ${variables['mrIid']}` }] };
    }
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(mr, null, 2), mimeType: 'application/json' }] };
  },
);

/**
 * 资源：MR 变更文件
 */
server.registerResource(
  'mr-changes',
  new ResourceTemplate('gitlab://projects/{projectId}/merge_requests/{mrIid}/changes', { list: undefined }),
  { description: '获取 GitLab MR 变更文件', mimeType: 'application/json' },
  async (uri, variables) => {
    const changes = await gitlab.getMRChanges(parseInt(variables['projectId'] as string), parseInt(variables['mrIid'] as string));
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(changes, null, 2), mimeType: 'application/json' }] };
  },
);

// ──────────────────────────────────────────────
// Prompts 定义
// ──────────────────────────────────────────────

/**
 * 提示词：MR Code Review
 */
server.prompt(
  'mr-code-review',
  '对指定 GitLab MR 进行 Code Review',
  {
    projectId: z.string().describe('项目 ID'),
    mrIid: z.string().describe('MR IID'),
  },
  ({ projectId, mrIid }) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `请对 MR !${mrIid} 进行 Code Review。

审查要点：
1. **代码质量**：命名规范、代码结构、可读性
2. **潜在 Bug**：逻辑错误、边界条件、异常处理
3. **性能问题**：不必要的计算、内存泄漏、数据库查询
4. **安全风险**：SQL 注入、XSS、敏感信息泄露
5. **测试覆盖**：是否有对应的单元测试

请使用 getMRChanges 获取变更文件，然后逐文件审查并提供评论。`,
        },
      },
    ],
  }),
);

// ──────────────────────────────────────────────
// 工具注册
// ──────────────────────────────────────────────

/**
 * 工具：列出项目
 */
server.tool(
  'listProjects',
  '列出 GitLab 所有项目',
  {
    search: z.string().optional().describe('搜索关键词（可选）'),
  },
  async ({ search }) => {
    const projects = await gitlab.listProjects(search);
    const textContent = projects.map((p) => `- ${p.pathWithNamespace}: ${p.description || '无描述'}`).join('\n');
    return {
      content: [{ type: 'text' as const, text: textContent || '暂无项目' }],
    };
  },
);

/**
 * 工具：列出 MR
 */
server.tool(
  'listMRs',
  '列出指定项目的合并请求',
  {
    projectId: z.number().describe('项目 ID'),
    state: z.enum(['opened', 'merged', 'closed']).optional().describe('状态过滤（可选）'),
  },
  async ({ projectId, state }) => {
    const mrs = await gitlab.listMRs(projectId, state);
    const textContent = mrs.map((mr) => {
      const stateIcon = mr.state === 'opened' ? '●' : mr.state === 'merged' ? '✓' : '✗';
      return `${stateIcon} !${mr.iid}: ${mr.sourceBranch} → ${mr.targetBranch} (${mr.author})`;
    }).join('\n');
    return {
      content: [{ type: 'text' as const, text: textContent || '暂无 MR' }],
    };
  },
);

/**
 * 工具：创建 MR
 */
server.tool(
  'createMR',
  '创建一个新的合并请求',
  {
    projectId: z.number().describe('项目 ID'),
    title: z.string().describe('MR 标题'),
    sourceBranch: z.string().describe('源分支'),
    targetBranch: z.string().describe('目标分支'),
    description: z.string().optional().describe('MR 描述（可选）'),
  },
  async ({ projectId, title, sourceBranch, targetBranch, description }) => {
    const mr = await gitlab.createMR(projectId, { title, sourceBranch, targetBranch, description });
    return {
      content: [{ type: 'text' as const, text: `✓ MR 创建成功: !${mr.iid} - ${mr.title}\n${mr.webUrl}` }],
    };
  },
);

/**
 * 工具：获取 MR 变更
 */
server.tool(
  'getMRChanges',
  '获取指定 MR 的变更文件列表和 diff',
  {
    projectId: z.number().describe('项目 ID'),
    mrIid: z.number().describe('MR IID'),
  },
  async ({ projectId, mrIid }) => {
    const changes = await gitlab.getMRChanges(projectId, mrIid);
    const textContent = changes.map((c) => {
      const type = c.newFile ? '+' : c.deletedFile ? '-' : 'M';
      return `${type} ${c.newPath}\n\`\`\`diff\n${c.diff}\n\`\`\``;
    }).join('\n\n');
    return {
      content: [{ type: 'text' as const, text: textContent || '暂无变更' }],
    };
  },
);

/**
 * 工具：添加 Review 评论
 */
server.tool(
  'addReviewComment',
  '向指定 MR 添加评论',
  {
    projectId: z.number().describe('项目 ID'),
    mrIid: z.number().describe('MR IID'),
    body: z.string().describe('评论内容'),
    path: z.string().optional().describe('文件路径（可选）'),
    line: z.number().optional().describe('行号（可选）'),
  },
  async ({ projectId, mrIid, body, path, line }) => {
    const success = await gitlab.addReviewComment(projectId, mrIid, { body, path, line });
    if (!success) {
      return {
        content: [{ type: 'text' as const, text: '✗ 添加评论失败' }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: `✓ 评论已添加到 MR !${mrIid}` }],
    };
  },
);

/**
 * 工具：合并 MR
 */
server.tool(
  'mergeMR',
  '合并指定的 MR',
  {
    projectId: z.number().describe('项目 ID'),
    mrIid: z.number().describe('MR IID'),
    message: z.string().optional().describe('合并提交信息（可选）'),
  },
  async ({ projectId, mrIid, message }) => {
    const success = await gitlab.mergeMR(projectId, mrIid, message);
    if (!success) {
      return {
        content: [{ type: 'text' as const, text: '✗ 合并失败' }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: `✓ MR !${mrIid} 已成功合并` }],
    };
  },
);

// ──────────────────────────────────────────────
// 启动服务
// ──────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[mcp-gitlab] GitLab MCP Server started via stdio\n');

  const shutdown = () => {
    process.stderr.write('[mcp-gitlab] Shutting down...\n');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.stdin.on('end', shutdown);
  process.stdin.resume();
}

main().catch((err: Error) => {
  process.stderr.write(`[mcp-gitlab] Fatal error: ${err.message}\n`);
  process.exit(1);
});
