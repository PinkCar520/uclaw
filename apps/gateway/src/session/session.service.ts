import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface CreateMessageDto {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parentId?: string;
  parts?: any;
  attachments?: any;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

@Injectable()
export class SessionService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: PrismaClient) {}

  // ── Session CRUD ──────────────────────────────────────────────

  async getSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, status: 'active' },
      select: {
        id: true,
        title: true,
        channel: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      channel: s.channel,
      status: s.status,
      messageCount: s._count.messages,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }));
  }

  async createSession(userId: string, channel = 'web', title = 'New Chat') {
    return this.prisma.session.create({
      data: { userId, channel, title, status: 'active' },
    });
  }

  async getSessionById(id: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id, userId },
    });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  async updateSession(id: string, userId: string, data: { title?: string; status?: string }) {
    await this.assertOwnership(id, userId);
    return this.prisma.session.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async deleteSession(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    // messages 因 onDelete: Cascade 自动级联删除
    await this.prisma.session.delete({ where: { id } });
    return { success: true };
  }

  async deleteAllSessions(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
    return { success: true };
  }

  // ── Message CRUD ──────────────────────────────────────────────

  /**
   * 追加单条消息到会话（流式完成后由 ChatService 调用）
   * @returns 创建的消息 ID（用于关联 CapsuleSnapshot）
   */
  async addMessage(sessionId: string, dto: CreateMessageDto): Promise<string> {
    // 如果没有显式提供 parentId，尝试找到该会话的最后一条消息作为父节点
    let parentId = dto.parentId;
    if (!parentId) {
      const lastMsg = await this.prisma.message.findFirst({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      parentId = lastMsg?.id;
    }

    const created = await this.prisma.message.create({
      data: {
        sessionId,
        parentId,
        role: dto.role,
        content: dto.content,
        parts: dto.parts ?? undefined,
        attachments: dto.attachments ?? undefined,
        usage: dto.usage ?? undefined,
      },
    });

    // 更新会话的 updatedAt，让列表排序正确
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return created.id;
  }

  /**
   * 获取会话的所有消息 — 刷新恢复的关键接口
   */
  async getMessages(sessionId: string, userId: string) {
    // 先鉴权：确认该会话属于当前用户
    await this.assertOwnership(sessionId, userId);

    const rows = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' }, // 改为按时间升序，前端负责根据 parentId 构建树
    });

    // 转换为 Vercel AI SDK UIMessage 格式，前端 useChat 可直接消费
    return rows.map((row) => ({
      id: row.id,
      parentId: row.parentId ?? undefined,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      parts: row.parts ?? undefined,
      experimental_attachments: row.attachments ?? undefined,
      usage: row.usage ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  /**
   * 删除会话内所有消息（重新生成时使用）
   */
  async clearMessages(sessionId: string, userId: string): Promise<void> {
    await this.assertOwnership(sessionId, userId);
    await this.prisma.message.deleteMany({ where: { sessionId } });
  }

  // ── Internal ──────────────────────────────────────────────────

  private async assertOwnership(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.userId !== userId) {
      throw new ForbiddenException(`Session ${sessionId} does not belong to current user`);
    }
  }
}
