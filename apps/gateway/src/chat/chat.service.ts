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
import * as fs from 'fs';
import * as path from 'path';

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

    const isCloudModel = selectedModel.includes('deepseek') || selectedModel.includes('omni');
    
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
      
      // Log received attachments for debugging/verification
      const attachmentCount = messages.reduce((count, m) => count + (m.experimental_attachments?.length || 0), 0);
      if (attachmentCount > 0) {
        console.log(`[Gateway] Received ${attachmentCount} total attachments across history.`);
      }
      
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

      const { text } = await generateText({
        model: this.getModel(),
        messages: [{ role: 'user', content }],
        toolChoice: 'auto',
        stopWhen: stepCountIs(5),
        system: this.getSystemPrompt(userId, onlineClis),
        tools: this.getTools(),
      });

      return text;
    } catch (err: any) {
      console.error('[Gateway Text ERROR]:', err);
      return `抱歉，处理您的请求时发生了错误: ${err.message}`;
    }
  }
}
