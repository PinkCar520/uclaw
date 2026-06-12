#!/usr/bin/env node
/**
 * Ocean GitLab MCP Server v2.0 (Production Grade)
 * 
 * 对齐 GitLab Duo MCP 标准，并集成 Ocean Generative UI。
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GitLabTool } from '@ocean/tools-gitlab';

// ──────────────────────────────────────────────
// 初始化 GitLab 工具
// ──────────────────────────────────────────────

const gitlab = new GitLabTool({
  baseUrl: process.env['GITLAB_BASE_URL'] || 'https://gitlab.com',
  token: process.env['GITLAB_TOKEN'] || '',
});

const server = new McpServer({
  name: 'ocean-gitlab',
  version: '2.0.0',
});

// ──────────────────────────────────────────────
// 1. 项目管理 (Project Lifecycle)
// ──────────────────────────────────────────────

server.tool(
  'listProjects',
  '搜索并列出你有权访问的 GitLab 项目。',
  { search: z.string().optional().describe('项目搜索关键词') },
  async ({ search }) => {
    const projects = await gitlab.listProjects(search);
    const text = projects.map(p => `[ID: ${p.id}] ${p.pathWithNamespace} - ${p.description || 'No description'}`).join('\n');
    return { content: [{ type: 'text', text: text || '未找到匹配项目' }] };
  }
);

server.tool(
  'createProject',
  '在 GitLab 中创建一个新项目。',
  {
    name: z.string().describe('项目名称'),
    description: z.string().optional().describe('项目描述'),
    visibility: z.enum(['private', 'internal', 'public']).default('private').describe('可见性等级'),
  },
  async ({ name, description, visibility }) => {
    const p = await gitlab.createProject({ name, description, visibility });
    return {
      content: [{ 
        type: 'text', 
        text: `✓ 项目创建成功！\n名称: ${p.name}\nURL: ${p.webUrl}\nID: ${p.id}\n可见性: ${p.visibility}` 
      }]
    };
  }
);

// ──────────────────────────────────────────────
// 2. 需求与缺陷管理 (Issues)
// ──────────────────────────────────────────────

server.tool(
  'listIssues',
  '列出指定项目的 Issue 列表。',
  {
    projectId: z.number().describe('项目 ID'),
    state: z.enum(['opened', 'closed']).default('opened'),
  },
  async ({ projectId, state }) => {
    const issues = await gitlab.listIssues(projectId, state);
    const text = issues.map(i => `[#${i.iid}] ${i.title} (状态: ${i.state}, 指派给: ${i.assignee || '未指派'})`).join('\n');
    return {
      content: [{ type: 'text', text: text || '该项目暂无 Issue' }]
    };
  }
);

server.tool(
  'createIssue',
  '为指定项目创建一个新的 Issue 或缺陷单。',
  {
    projectId: z.number().describe('项目 ID'),
    title: z.string().describe('Issue 标题'),
    description: z.string().optional().describe('详细描述'),
    labels: z.array(z.string()).optional().describe('标签列表，如 ["bug", "critical"]'),
  },
  async ({ projectId, title, description, labels }) => {
    const i = await gitlab.createIssue(projectId, { title, description, labels });
    return {
      content: [{ type: 'text', text: `✓ Issue #${i.iid} 创建成功！\n地址: ${i.webUrl}` }]
    };
  }
);

// ──────────────────────────────────────────────
// 3. 仓库与分支操作 (Repo & Branches)
// ──────────────────────────────────────────────

server.tool(
  'createBranch',
  '基于特定基准创建新分支。',
  {
    projectId: z.number().describe('项目 ID'),
    branch: z.string().describe('新分支名称'),
    ref: z.string().describe('起始基准，如 "main" 或 Commit SHA'),
  },
  async ({ projectId, branch, ref }) => {
    const b = await gitlab.createBranch(projectId, branch, ref);
    return {
      content: [{ type: 'text', text: `✓ 分支 "${b.name}" 创建完成。` }]
    };
  }
);

server.tool(
  'getFileContent',
  '远程读取仓库中文件的原始内容。',
  {
    projectId: z.number().describe('项目 ID'),
    path: z.string().describe('文件路径'),
    ref: z.string().default('main').describe('分支或标签'),
  },
  async ({ projectId, path, ref }) => {
    const content = await gitlab.getFileRaw(projectId, path, ref);
    return {
      content: [{ type: 'text', text: `__UI__:{"uiType":"code_block","props":{"command":"cat ${path}","output":${JSON.stringify(content)},"status":"success","language":"${path.split('.').pop()}"}}` }]
    };
  }
);

// ──────────────────────────────────────────────
// 4. 合并请求与代码审查 (MR & CR)
// ──────────────────────────────────────────────

server.tool(
  'listMRs',
  '查看项目的合并请求列表。',
  {
    projectId: z.number().describe('项目 ID'),
    state: z.enum(['opened', 'merged', 'closed', 'all']).default('opened'),
  },
  async ({ projectId, state }) => {
    const mrs = await gitlab.listMRs(projectId, state);
    const text = mrs.map(m => `!${m.iid}: ${m.sourceBranch} -> ${m.targetBranch} (${m.title})`).join('\n');
    return { content: [{ type: 'text', text: text || '暂无 MR' }] };
  }
);

server.tool(
  'mergeMR',
  '通过审核后合并指定的 MR。',
  {
    projectId: z.number().describe('项目 ID'),
    mrIid: z.number().describe('MR IID'),
    message: z.string().optional().describe('合并提交信息'),
  },
  async ({ projectId, mrIid, message }) => {
    await gitlab.mergeMR(projectId, mrIid, message);
    return { content: [{ type: 'text', text: `✓ MR !${mrIid} 已成功合并并关闭。` }] };
  }
);

// ──────────────────────────────────────────────
// 5. CI/CD 运维 (Pipelines)
// ──────────────────────────────────────────────

server.tool(
  'listPipelines',
  '获取项目的流水线运行历史。',
  { projectId: z.number().describe('项目 ID') },
  async ({ projectId }) => {
    const pipelines = await gitlab.listPipelines(projectId);
    const text = pipelines.map(p => `ID: ${p.id} | 分支: ${p.ref} | 状态: ${p.status}`).join('\n');
    return { content: [{ type: 'text', text: text || '未找到流水线记录' }] };
  }
);

server.tool(
  'getJobLog',
  '获取失败流水线的 Job 日志，用于诊断根因。',
  {
    projectId: z.number().describe('项目 ID'),
    jobId: z.number().describe('Job ID'),
  },
  async ({ projectId, jobId }) => {
    const log = await gitlab.getJobLog(projectId, jobId);
    // 截取最后 50 行关键日志避免 Token 溢出，并触发 code_block
    const lines = log.split('\n');
    const tailLog = lines.slice(-50).join('\n');
    return {
      content: [{ 
        type: 'text', 
        text: `__UI__:{"uiType":"code_block","props":{"command":"tail -n 50 job_log","output":${JSON.stringify(tailLog)},"status":"error","language":"log"}}` 
      }]
    };
  }
);

// ──────────────────────────────────────────────
// 启动服务
// ──────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[mcp-gitlab] GitLab Pro MCP Server started\n');
}

main().catch((err) => {
  process.stderr.write(`[mcp-gitlab] Fatal: ${err.message}\n`);
  process.exit(1);
});
