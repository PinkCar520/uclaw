#!/usr/bin/env node
/**
 * Ocean Jenkins MCP Server
 *
 * 将 Jenkins CI/CD 能力以 MCP 协议暴露给 Gateway。
 *
 * 工具列表：
 * - getBuildStatus: 获取构建状态
 * - triggerBuild: 触发构建
 * - getBuildLog: 获取构建日志
 * - approveDeployment: 审批部署
 * - listJobs: 列出所有任务
 * - getJobInfo: 获取任务详情
 *
 * 资源列表：
 * - jenkins://jobs/{jobName} - 任务详情
 * - jenkins://jobs/{jobName}/builds/{buildNumber} - 构建详情
 * - jenkins://jobs/{jobName}/builds/{buildNumber}/log - 构建日志
 *
 * 通信方式：Stdio（由 Gateway 以子进程方式启动）
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { JenkinsTool } from '@ocean/tools-jenkins';

// ──────────────────────────────────────────────
// 初始化 Jenkins 工具
// ──────────────────────────────────────────────

const jenkins = new JenkinsTool({
  baseUrl: process.env['JENKINS_BASE_URL'] || 'https://jenkins.example.com',
  token: process.env['JENKINS_TOKEN'] || '',
  username: process.env['JENKINS_USERNAME'] || '',
});

// ──────────────────────────────────────────────
// 创建 MCP Server 实例
// ──────────────────────────────────────────────
const server = new McpServer({
  name: 'ocean-jenkins',
  version: '1.0.0',
});

// ──────────────────────────────────────────────
// Resources 定义
// ──────────────────────────────────────────────

/**
 * 资源：任务详情
 */
server.registerResource(
  'job-details',
  new ResourceTemplate('jenkins://jobs/{jobName}', { list: undefined }),
  { description: '获取 Jenkins 任务详情', mimeType: 'application/json' },
  async (uri, variables) => {
    const job = await jenkins.getJobInfo(variables['jobName'] as string);
    if (!job) {
      return { contents: [{ uri: uri.toString(), text: `未找到任务: ${variables['jobName']}` }] };
    }
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(job, null, 2), mimeType: 'application/json' }] };
  },
);

/**
 * 资源：构建详情
 */
server.registerResource(
  'build-details',
  new ResourceTemplate('jenkins://jobs/{jobName}/builds/{buildNumber}', { list: undefined }),
  { description: '获取 Jenkins 构建详情', mimeType: 'application/json' },
  async (uri, variables) => {
    const build = await jenkins.getBuildStatus(variables['jobName'] as string, parseInt(variables['buildNumber'] as string));
    if (!build) {
      return { contents: [{ uri: uri.toString(), text: `未找到构建: ${variables['jobName']} #${variables['buildNumber']}` }] };
    }
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(build, null, 2), mimeType: 'application/json' }] };
  },
);

/**
 * 资源：构建日志
 */
server.registerResource(
  'build-log',
  new ResourceTemplate('jenkins://jobs/{jobName}/builds/{buildNumber}/log', { list: undefined }),
  { description: '获取 Jenkins 构建日志', mimeType: 'text/plain' },
  async (uri, variables) => {
    const log = await jenkins.getBuildLog(variables['jobName'] as string, parseInt(variables['buildNumber'] as string));
    return { contents: [{ uri: uri.toString(), text: log, mimeType: 'text/plain' }] };
  },
);

// ──────────────────────────────────────────────
// Prompts 定义
// ──────────────────────────────────────────────

/**
 * 提示词：构建失败分析
 */
server.prompt(
  'build-failure-analysis',
  '分析 Jenkins 构建失败原因并提供修复建议',
  {
    jobName: z.string().describe('任务名称'),
    buildNumber: z.string().optional().describe('构建编号（可选，默认最新）'),
  },
  ({ jobName, buildNumber }) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `请分析 Jenkins 任务 "${jobName}" 的构建失败原因。${
            buildNumber ? `具体查看构建 #${buildNumber}。` : '请查看最新的构建。'
          }

分析步骤：
1. 使用 getBuildStatus 获取构建状态
2. 使用 getBuildLog 获取详细日志
3. 分析错误原因
4. 提供修复建议

请生成一份详细的失败分析报告。`,
        },
      },
    ],
  }),
);

// ──────────────────────────────────────────────
// 工具注册
// ──────────────────────────────────────────────

/**
 * 工具：列出所有任务
 */
server.tool(
  'listJobs',
  '列出 Jenkins 所有构建任务',
  {},
  async () => {
    const jobs = await jenkins.listJobs();
    const textContent = jobs.map((job) => {
      const status = job.color === 'blue' ? '✓ 成功' :
                     job.color === 'red' ? '✗ 失败' :
                     job.color === 'yellow' ? '⏳ 运行中' :
                     job.color === 'aborted' ? '⚠ 中止' : '⏸ 禁用';
      return `- ${job.fullName}: ${status}${
        job.lastBuild ? ` (最新: #${job.lastBuild.number})` : ''
      }`;
    }).join('\n');

    return {
      content: [{ type: 'text' as const, text: textContent || '暂无任务' }],
    };
  },
);

/**
 * 工具：获取任务详情
 */
server.tool(
  'getJobInfo',
  '获取 Jenkins 指定任务的详细信息',
  {
    jobName: z.string().describe('任务名称，例如 ocean-gateway-build'),
  },
  async ({ jobName }) => {
    const job = await jenkins.getJobInfo(jobName);
    if (!job) {
      return {
        content: [{ type: 'text' as const, text: `未找到任务: ${jobName}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(job, null, 2) }],
    };
  },
);

/**
 * 工具：获取构建状态
 */
server.tool(
  'getBuildStatus',
  '获取 Jenkins 指定构建的状态信息',
  {
    jobName: z.string().describe('任务名称'),
    buildNumber: z.number().optional().describe('构建编号，默认最新'),
  },
  async ({ jobName, buildNumber }) => {
    const build = await jenkins.getBuildStatus(jobName, buildNumber);
    if (!build) {
      return {
        content: [{ type: 'text' as const, text: `未找到构建: ${jobName}${buildNumber ? ` #${buildNumber}` : ''}` }],
        isError: true,
      };
    }
    const statusText = build.status === 'success' ? '✓ 成功' :
                       build.status === 'failure' ? '✗ 失败' :
                       build.status === 'running' ? '⏳ 运行中' :
                       build.status === 'queued' ? '▸ 排队中' : '⚠ 已中止';
    const textSummary = `构建 ${jobName} #${build.number}: ${statusText}\n开始时间: ${build.startTime}\n耗时: ${build.duration ? `${build.duration / 1000}秒` : '进行中'}`;
    return {
      content: [{ type: 'text' as const, text: textSummary }],
    };
  },
);

/**
 * 工具：触发构建
 */
server.tool(
  'triggerBuild',
  '触发 Jenkins 构建',
  {
    jobName: z.string().describe('任务名称'),
    params: z.record(z.string(), z.string()).optional().describe('构建参数（可选）'),
  },
  async ({ jobName, params }) => {
    const result = await jenkins.triggerBuild(jobName, params as Record<string, string> | undefined);
    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `✗ 触发构建失败: ${jobName}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: `✓ 成功触发构建: ${jobName} #${result.buildNumber}` }],
    };
  },
);

/**
 * 工具：获取构建日志
 */
server.tool(
  'getBuildLog',
  '获取 Jenkins 指定构建的完整日志',
  {
    jobName: z.string().describe('任务名称'),
    buildNumber: z.number().describe('构建编号'),
  },
  async ({ jobName, buildNumber }) => {
    const log = await jenkins.getBuildLog(jobName, buildNumber);
    return {
      content: [{ type: 'text' as const, text: log || '日志为空' }],
    };
  },
);

/**
 * 工具：审批部署
 */
server.tool(
  'approveDeployment',
  '审批 Jenkins 部署构建（需管理员权限）',
  {
    buildNumber: z.number().describe('部署构建编号'),
    approved: z.boolean().describe('是否批准'),
    comment: z.string().optional().describe('审批意见（可选）'),
  },
  async ({ buildNumber, approved, comment }) => {
    const success = await jenkins.approveDeployment(buildNumber, approved, comment);
    if (!success) {
      return {
        content: [{ type: 'text' as const, text: `✗ 审批失败: 部署 #${buildNumber}` }],
        isError: true,
      };
    }
    const action = approved ? '✓ 已批准' : '✗ 已拒绝';
    return {
      content: [{ type: 'text' as const, text: `${action}部署 #${buildNumber}${comment ? `\n审批意见: ${comment}` : ''}` }],
    };
  },
);

// ──────────────────────────────────────────────
// 启动服务（Stdio Transport）
// ──────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[mcp-jenkins] Jenkins MCP Server started via stdio\n');

  const shutdown = () => {
    process.stderr.write('[mcp-jenkins] Shutting down...\n');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.stdin.on('end', shutdown);
  process.stdin.resume();
}

main().catch((err: Error) => {
  process.stderr.write(`[mcp-jenkins] Fatal error: ${err.message}\n`);
  process.exit(1);
});
