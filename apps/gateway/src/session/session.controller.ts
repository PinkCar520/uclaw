import { Controller, Get, Post, Patch, Delete, Param, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { SessionService } from './session.service';

@Controller('api/sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * GET /api/sessions
   * 返回当前用户的所有活跃会话（摘要，不含消息体）
   * 前端侧边栏列表使用
   */
  @Get()
  async getSessions(@Req() req: any) {
    const userId = req.user?.dbId;
    const sessions = await this.sessionService.getSessions(userId);
    return { success: true, data: sessions };
  }

  /**
   * POST /api/sessions
   * 创建新会话，返回 sessionId（前端发第一条消息前调用）
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Body() body: any, @Req() req: any) {
    const userId = req.user?.dbId;
    const session = await this.sessionService.createSession(
      userId,
      body.channel || 'web',
      body.title || 'New Chat',
    );
    return { success: true, data: session };
  }

  /**
   * GET /api/sessions/:id/messages
   * 查询会话的完整消息列表（Server-First 刷新恢复的核心接口）
   */
  @Get(':id/messages')
  async getMessages(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.dbId;
    const messages = await this.sessionService.getMessages(id, userId);
    return { success: true, data: messages };
  }

  /**
   * GET /api/sessions/:id
   * 查询会话元数据（不含消息体）
   */
  @Get(':id')
  async getSessionById(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.dbId;
    const session = await this.sessionService.getSessionById(id, userId);
    return { success: true, data: session };
  }

  /**
   * PATCH /api/sessions/:id
   * 更新会话元数据（重命名、归档）
   */
  @Patch(':id')
  async updateSession(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.dbId;
    const session = await this.sessionService.updateSession(id, userId, {
      title: body.title,
      status: body.status,
    });
    return { success: true, data: session };
  }

  @Delete('all')
  @HttpCode(HttpStatus.OK)
  async deleteAllSessions(@Req() req: any) {
    const userId = req.user?.dbId;
    await this.sessionService.deleteAllSessions(userId);
    return { success: true };
  }

  /**
   * DELETE /api/sessions/:id
   * 删除会话（级联删除所有消息）
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.dbId;
    await this.sessionService.deleteSession(id, userId);
    return { success: true };
  }
}
