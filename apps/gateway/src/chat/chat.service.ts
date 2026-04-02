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

@Injectable()
export class ChatService {
  constructor(
    private configService: ConfigService,
    private zentaoService: ZentaoService,
    private rpcGateway: RpcGateway,
  ) { }

  private getModel(modelId?: string) {
    const modelsRaw = this.configService.get<string>('VLLM_MODEL_NAME') || 'qwen2.5-coder:7b';
    const models = modelsRaw.split(',').map(m => m.trim());
    const selectedModel = (modelId && models.includes(modelId)) ? modelId : models[0];

    return createOpenAI({
      baseURL: this.configService.get<string>('VLLM_API_BASE'),
      apiKey: this.configService.get<string>('VLLM_API_KEY') || 'ollama',
    }).chat(selectedModel);
  }

  /**
   * 获取当前网关配置的模型列表 (供前端动态展示)
   */
  getAvailableModels() {
    const modelsRaw = this.configService.get<string>('VLLM_MODEL_NAME') || 'qwen2.5-coder:7b';
    const modelIds = modelsRaw.split(',').map(m => m.trim());
    
    return modelIds.map(id => ({
      id,
      name: id, // 使用 ID 作为展示名
      provider: 'Enterprise',
      icon: 'Sparkles',
      color: 'text-blue-500', 
    }));
  }

  private getTools() {
    return {
      getBugInfo: tool({
        description: '获取指定 Bug ID 的详细信息',
        inputSchema: z.object({
          bugId: z.string().describe('缺陷的 ID，如 BUG-2048'),
        }),
        execute: async ({ bugId }) => {
          return await this.zentaoService.getBugInfo(bugId);
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
      runLocalCommand: tool({
        description: '在开发者的本地工作站执行安全指令',
        inputSchema: z.object({
          userId: z.string().describe('目标用户的 ID（如 local_dev 或工号）'),
          command: z.enum(['ls', 'git_status', 'git_add', 'git_commit', 'npm_build', 'read_file']).describe('执行的指令名'),
          args: z.record(z.string(), z.any()).optional().describe('指令所需的参数'),
        }),
        execute: async ({ userId, command, args }) => {
          try {
            // 内部逻辑优化：确保大模型知道 git_add 是暂存，git_commit 是提交暂存区
            const result = await this.rpcGateway.sendToCli(userId, command, args || {});
            return { status: 'Success', command, result };
          } catch (err) {
            return { status: 'Error', message: err.message };
          }
        },
      }),
    };
  }

  private getSystemPrompt(currentUserId: string, onlineClis: string[]) {
    return `你是一个银行内网 AI 助手 UClaw。
当前登录用户: ${currentUserId}
当前在线的本地 CLI 节点: ${onlineClis.join(', ') || '无'}

你可以调用工具来查询禅道（ZenTao）中的缺陷（Bug）信息。
如果你需要操作用户本地工作站（CLI），请使用 runLocalCommand 工具。
- 注意：请优先选择与当前登录用户匹配的 CLI 节点。
- 目前支持指令：ls, git_status, git_add, git_commit, npm_build, read_file。
- Git 流程：在提交代码前，你必须先调用 git_add (args: { files: "." }) 来暂存改动，然后再调用 git_commit。
- 安全提示：git_add 和 git_commit 都会触发用户的物理确认。
拿到工具执行结果后，请用中文进行通俗易懂的总结。`;
  }

  /**
   * 为 Web 提供流式响应
   */
  async generateChatStream(messages: any[], res: Response, req?: any, modelId?: string) {
    try {
      const modelMessages = await convertToModelMessages(messages);
      const onlineClis = this.rpcGateway.getOnlineUsers();
      const currentUserId = req?.user?.id || 'Anonymous';

      const result = streamText({
        model: this.getModel(modelId),
        messages: modelMessages,
        toolChoice: 'auto',
        stopWhen: stepCountIs(5),
        system: this.getSystemPrompt(currentUserId, onlineClis),
        tools: this.getTools(),
        onStepFinish: ({ stepNumber, text, toolCalls, toolResults }) => {
          console.log(`[Gateway] [Stream] Step ${stepNumber} finished. Tools: ${toolCalls.length}`);
        },
      });

      result.pipeUIMessageStreamToResponse(res);
    } catch (err) {
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

      const { text } = await generateText({
        model: this.getModel(),
        messages: [{ role: 'user', content }],
        toolChoice: 'auto',
        stopWhen: stepCountIs(5),
        system: this.getSystemPrompt(userId, onlineClis),
        tools: this.getTools(),
      });

      return text;
    } catch (err) {
      console.error('[Gateway Text ERROR]:', err);
      return `抱歉，处理您的请求时发生了错误: ${err.message}`;
    }
  }
}
