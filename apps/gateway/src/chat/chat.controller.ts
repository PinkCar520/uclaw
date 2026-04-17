import { Controller, Get, Post, Body, Req, Res, Headers, SetMetadata } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { SkillOrchestrator } from '../skill/skill.orchestrator';
import { SkillLoader } from '../skill/skill.loader';
import { RpcGateway } from './rpc.gateway';
import { UpChatHandler } from '@uclaw/mcp-im';
import type { SkillContext } from '@uclaw/core';
import { IS_PUBLIC_KEY } from '../auth/sso.guard';

const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller('api/chat')
export class ChatController {
  private imHandler = new UpChatHandler();

  constructor(
    private readonly chatService: ChatService,
    private readonly skillOrchestrator: SkillOrchestrator,
    private readonly skillLoader: SkillLoader,
    private readonly rpcGateway: RpcGateway,
  ) {}

  /**
   * GET /api/chat/skills
   * 返回当前 Gateway 发现的所有技能列表（SKILL.md frontmatter）
   */
  @Public()
  @Get('skills')
  async getSkills() {
    const skills = await this.skillLoader.discover();
    return {
      success: true,
      skills: skills.map(s => ({
        id: s.name,
        name: s.name,
        description: s.description,
        version: s.metadata?.version || '1.0.0',
        compatibility: s.compatibility,
        author: s.metadata?.author,
      })),
    };
  }

  /**
   * GET /api/chat/models
   * 返回当前 Gateway 可用的模型列表，并附带当前影子用户的持久化 ID
   */
  @Public()
  @Get('models')
  async getModels(@Req() req: any) {
    const models = this.skillOrchestrator.getAvailableModels();
    return {
      models,
      debug: {
        dbId: req.user?.dbId, // 验证影子用户 UUID
        workId: req.user?.workId,
        synced: !!req.user?.dbId
      }
    };
  }

  /**
   * GET /api/chat/me
   * 返回当前登录用户的影子用户详情（由 SsoAuthGuard 注入）
   */
  @Get('me')
  async getMe(@Req() req: any) {
    // req.user 是由 SsoAuthGuard 在鉴权通过后注入的
    return {
      success: true,
      user: req.user,
      platform: 'UClaw Workbuddy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /api/chat
   * Web 端主聊天接口（SSE 流式）
   * 🔄 已切换到 SkillOrchestrator（MCP + Skill 新链路）
   */
  @Post()
  async handleChatStream(
    @Body() body: any,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const requestId = Math.random().toString(36).substring(7);
    const messages = body.messages || (body.text ? [{ role: 'user', content: body.text }] : []);
    const sessionId: string | undefined = body.sessionId;
    
    // 提取最后一条用户消息文本，用于意图识别
    const userMessage: string =
      body.text ||
      (Array.isArray(messages) && messages.length > 0
        ? (messages.at(-1)?.content ?? '')
        : '');
    const modelId: string | undefined = body.modelId || body.model;

    console.log(`[Gateway] [${requestId}] Skill mode. Employee: ${req.user?.workId} (${req.user?.dbId}), session: ${sessionId || 'none'}, msg: "${userMessage.slice(0, 60)}..."`);

    const ctx: SkillContext = {
      userId: req.user?.workId || 'Anonymous',
      source: 'web',
      userMessage,
      workspacePath: body.workspacePath,
    };

    await this.skillOrchestrator.streamResponse(messages, res, ctx, modelId, sessionId);
  }

  /**
   * POST /api/chat/webhook-im
   * 银联 UpChat IM Bot Webhook
   * 🔄 已切换到 SkillOrchestrator（非流式文本响应）
   */
  @Public()
  @Post('webhook-im')
  async handleImWebhook(
    @Body() payload: any,
    @Res() res: Response,
    @Headers('x-up-signature') signature: string,
  ) {
    if (signature) {
      console.log(`[Gateway] Verifying UnionPay UpChat signature: ${signature}`);
    }

    const message = this.imHandler.parseWebhook(payload);
    if (!message) {
      return res.status(200).send('Ignored');
    }

    console.log(`[Gateway] UpChat Webhook from ${message.senderName} (${message.senderId}): ${message.content}`);

    // 立即返回 200 防止银联服务器超时重试
    res.status(200).send('OK');

    // 异步走 Skill 编排
    const replyText = await this.skillOrchestrator.textResponse(
      message.senderId,
      message.content,
      'im',
    );

    console.log(`[Gateway] Agent Reply to UpChat (${message.senderId}): ${replyText}`);
    // 真实生产环境：this.imHandler.sendReply(message.chatId, { text: replyText });
  }

  /**
   * POST /api/chat/generate-title
   * 为对话生成摘要标题
   */
  @Public()
  @Post('generate-title')
  async generateTitle(@Body() body: any) {
    const { message, modelId } = body;
    if (!message) return { success: false, error: 'Message is required' };
    
    const title = await this.skillOrchestrator.generateTitle(message, modelId);
    return { success: true, title };
  }
}
