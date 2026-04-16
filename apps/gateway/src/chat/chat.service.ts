import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import {
  streamText,
  generateText,
  convertToModelMessages,
  tool,
  stepCountIs,
} from 'ai';
import { z } from 'zod';
import { ZentaoService } from './zentao.service';
import { RpcGateway } from './rpc.gateway';
import { MCPClientManager } from '../mcp/mcp-client.manager';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ChatService {
  constructor(
    private configService: ConfigService,
    private zentaoService: ZentaoService,
    private rpcGateway: RpcGateway,
    private mcpManager: MCPClientManager,
  ) { }

  private getModel(modelId?: string) {
    const modelsRaw = this.configService.get<string>('VLLM_MODEL_NAME') || 'qwen2.5-coder:7b';
    const models = modelsRaw.split(',').map(m => m.trim());
    const selectedModel = (modelId && models.includes(modelId)) ? modelId : models[0];

    const isCloudModel = selectedModel.includes('deepseek') || selectedModel.includes('omni') || selectedModel.includes('qwen');
    
    const baseURL = isCloudModel 
      ? this.configService.get<string>('DASHSCOPE_API_BASE') 
      : this.configService.get<string>('VLLM_API_BASE');
      
    const apiKey = isCloudModel 
      ? this.configService.get<string>('DASHSCOPE_API_KEY') 
      : (this.configService.get<string>('VLLM_API_KEY') || 'ollama');

    console.log(`[ChatService] Routing model "${selectedModel}" to ${isCloudModel ? 'DashScope' : 'Ollama'}`);

    return createOpenAI({
      baseURL,
      apiKey,
    }).chat(selectedModel);
  }

  /**
   * 获取当前网关配置的模型列表 (供前端动态展示)
   */
  getAvailableModels() {
    const modelsRaw = this.configService.get<string>('VLLM_MODEL_NAME') || 'qwen2.5-coder:7b';
    return modelsRaw.split(',').map((id) => {
      const modelId = id.trim();
      const isCloud = modelId.includes('deepseek') || modelId.includes('omni');
      
      return {
        id: modelId,
        name: modelId,
        provider: isCloud ? 'Alibaba Bailian' : 'Private Ollama',
        icon: isCloud ? 'Cloud' : 'Cpu',
        color: isCloud ? 'text-orange-500' : 'text-blue-500',
      };
    });
  }

  private getTools(currentUserId: string, sessionId?: string) {
    return {
      getBugInfo: tool({
        description: '获取指定 Bug ID 的详细信息，结果将以卡片形式展示',
        inputSchema: z.object({
          bugId: z.string().describe('缺陷的 ID，如 BUG-2048'),
        }),
        execute: async ({ bugId }) => {
          const bug = await this.zentaoService.getBugInfo(bugId);
          if (!bug) {
            return { found: false, message: `未找到 BUG-${bugId}` };
          }
          return {
            found: true,
            bugId: bug.id,
            ui: {
              uiType: 'bug_card',
              props: {
                id: bug.id,
                title: bug.title,
                status: bug.status,
                assignee: bug.assignee,
                severity: bug.severity,
                description: bug.description,
                createdAt: bug.createdAt,
              },
            },
          };
        },
      }),
      searchBugs: tool({
        description: '根据关键词在禅道中搜索缺陷',
        inputSchema: z.object({
          query: z.string().describe('搜索关键词'),
        }),
        execute: async ({ query }) => {
          return await this.zentaoService.searchBugs(query);
        },
      }),
      resolveBug: tool({
        description: '在禅道中将指定的 Bug 标记为已解决（Resolved）',
        inputSchema: z.object({
          bugId: z.string().describe('缺陷的 ID，如 BUG-5'),
        }),
        execute: async ({ bugId }) => {
          const success = await this.zentaoService.resolveBug(bugId);
          return { status: success ? 'Success' : 'Error', bugId };
        },
      }),

      // --- New Atomic Local Tools ---

      local_file_read: tool({
        description: '读取开发者本地工作站的文件内容',
        inputSchema: z.object({
          userId: z.string().optional().describe('目标用户的 ID'),
          path: z.string().describe('文件相对路径'),
        }),
        execute: async ({ userId, path }) => {
          const targetUserId = userId || currentUserId;
          const result = await this.rpcGateway.sendToCli(targetUserId, 'read_file', { path });
          return { status: 'Success', path, content: result };
        },
      }),

      local_file_edit: tool({
        description: '通过精准匹配旧代码块并替换为新代码块来修改本地文件。比全量写入更安全可靠。',
        inputSchema: z.object({
          userId: z.string().optional().describe('目标用户的 ID'),
          path: z.string().describe('文件相对路径'),
          oldString: z.string().describe('要被替换的原始代码块（必须完全匹配，包括空格和缩进）'),
          newString: z.string().describe('替换后的新代码块'),
        }),
        execute: async ({ userId, path, oldString, newString }) => {
          try {
            const targetUserId = userId || currentUserId;
            const result = await this.rpcGateway.sendToCli(targetUserId, 'local_file_edit', { path, oldString, newString, sessionId });
            return { status: 'Success', path, result };
          } catch (err: any) {
            return { status: 'Error', message: err.message };
          }
        },
      }),

      local_git_status: tool({
        description: '获取开发者本地工作区的 Git 状态（查看改动文件、当前分支等）',
        inputSchema: z.object({
          userId: z.string().optional().describe('目标用户的 ID'),
        }),
        execute: async ({ userId }) => {
          const targetUserId = userId || currentUserId;
          const result = await this.rpcGateway.sendToCli(targetUserId, 'local_git', { action: 'status' });
          return { status: 'Success', ...result };
        },
      }),

      local_bash: tool({
        description: '在开发者本地工作站执行 Shell 指令。适用于运行测试、编译、列出目录等。',
        inputSchema: z.object({
          userId: z.string().optional().describe('目标用户的 ID (可选，默认为当前用户)'),
          command: z.string().describe('要执行的完整 Shell 指令'),
        }),
        execute: async ({ userId, command }) => {
          try {
            const targetUserId = userId || currentUserId;
            const result = await this.rpcGateway.sendToCli(targetUserId, 'bash', { command, sessionId });
            return { status: 'Success', output: result };
          } catch (err: any) {
            return { status: 'Error', message: err.message };
          }
        },
      }),
    };
  }

  private getSystemPrompt(currentUserId: string, onlineClis: string[]) {
    const promptPath = path.resolve(process.cwd(), 'agent/prompts/system_prompt.md');
    let template = `你是一个银行内网 AI 助手 UClaw。
当前登录用户: {{currentUserId}}
当前在线的本地 CLI 节点: {{onlineClis}}

(注：动态加载提示词失败，正在使用回退配置)`;

    try {
      if (fs.existsSync(promptPath)) {
        template = fs.readFileSync(promptPath, 'utf-8');
      }
    } catch (err) {
      console.error(`[ChatService] Failed to load system prompt from ${promptPath}:`, err);
    }

    return template
      .replace('{{currentUserId}}', currentUserId)
      .replace('{{onlineClis}}', onlineClis.join(', ') || '无');
  }

  /**
   * 为 Web 提供流式响应
   */
  async generateChatStream(messages: any[], res: Response, req?: any, modelId?: string) {
    try {
      const modelMessages = await convertToModelMessages(messages);
      
      const attachmentCount = messages.reduce((count, m) => count + (m.experimental_attachments?.length || 0), 0);
      if (attachmentCount > 0) {
        console.log(`[Gateway] Received ${attachmentCount} total attachments across history.`);
      }
      
      const onlineClis = this.rpcGateway.getOnlineUsers();
      const currentUserId = req?.user?.workId || 'Anonymous';
      const sessionId = req?.body?.sessionId;

      // Load MCP tools dynamically
      const mcpTools = await this.mcpManager.getAITools();
      const allTools = {
        ...this.getTools(currentUserId, sessionId),
        ...mcpTools,
      };

      const result = streamText({
        model: this.getModel(modelId),
        messages: modelMessages,
        toolChoice: 'auto',
        stopWhen: stepCountIs(5),
        system: this.getSystemPrompt(currentUserId, onlineClis),
        tools: allTools,
        onStepFinish: ({ stepNumber, text, toolCalls, toolResults }) => {
          console.log(`[Gateway] [Stream] Step ${stepNumber} finished. Tools: ${toolCalls.length}`);
        },
      });

      result.pipeUIMessageStreamToResponse(res);
    } catch (err: any) {
      console.error('[Gateway Stream ERROR]:', err);
      res.status(500).send(err.message);
    }
  }

  /**
   * 为 IM 提供非流式文本响应
   */
  async generateChatText(userId: string, content: string): Promise<string> {
    try {
      const onlineClis = this.rpcGateway.getOnlineUsers();

      const mcpTools = await this.mcpManager.getAITools();
      const allTools = {
        ...this.getTools(userId),
        ...mcpTools,
      };

      const { text } = await generateText({
        model: this.getModel(),
        messages: [{ role: 'user', content }],
        toolChoice: 'auto',
        stopWhen: stepCountIs(5),
        system: this.getSystemPrompt(userId, onlineClis),
        tools: allTools,
      });

      return text;
    } catch (err: any) {
      console.error('[Gateway Text ERROR]:', err);
      return `抱歉，处理您的请求时发生了错误: ${err.message}`;
    }
  }
}
