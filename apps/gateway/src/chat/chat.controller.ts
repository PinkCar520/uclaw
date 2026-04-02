import { Controller, Get, Post, Body, Req, Res, Headers } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { UpChatHandler } from '@uclaw/channel-im';

@Controller('api/chat')
export class ChatController {
  private imHandler = new UpChatHandler();

  constructor(private readonly chatService: ChatService) {}

  @Get('models')
  async getModels() {
    return this.chatService.getAvailableModels();
  }

  @Post()
  async handleChatStream(
    @Body() body: any,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const requestId = Math.random().toString(36).substring(7);
    const messages = body.messages || (body.text ? [{ role: 'user', content: body.text }] : []);
    
    console.log(`[Gateway] [${requestId}] Received prompt from Employee ID: ${req.user?.id}`);
    console.log(`[Gateway] [${requestId}] Body: ${JSON.stringify(body).slice(0, 100)}...`);
    console.log(`[Gateway] [${requestId}] Extracted messages count: ${messages.length}`);
    
    // 给 req 注入 requestId 方便 Service 追踪
    (req as any).id = requestId;
    const modelId = body.modelId || body.model;
    await this.chatService.generateChatStream(messages, res, req, modelId);
  }

  @Post('webhook-im')
  async handleImWebhook(
    @Body() payload: any, 
    @Res() res: Response,
    @Headers('x-up-signature') signature: string, // 银联专用签名头
  ) {
    // 银联签名校验逻辑 (POC 期间仅记录日志)
    if (signature) {
      console.log(`[Gateway] Verifying UnionPay UpChat signature: ${signature}`);
    }

    const message = this.imHandler.parseWebhook(payload);
    if (!message) {
      return res.status(200).send('Ignored');
    }

    console.log(`[Gateway] UpChat Webhook from ${message.senderName} (${message.senderId}): ${message.content}`);
    
    // 立即返回 200 给银联服务器防止超时重试
    res.status(200).send('OK');

    // 异步处理 Agent 逻辑
    const replyText = await this.chatService.generateChatText(message.senderId, message.content);
    
    console.log(`[Gateway] Agent Reply to UpChat (${message.senderId}): ${replyText}`);
    
    // 真实生产环境：this.imHandler.sendReply(message.chatId, { text: replyText });
  }
}
