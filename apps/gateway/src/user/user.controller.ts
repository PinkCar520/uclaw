import { Controller, Get, Post, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { UserService } from '../auth/user.service';
import { SsoAuthGuard } from '../auth/sso.guard';
import { PrismaClient } from '@prisma/client';
import { Inject } from '@nestjs/common';
import { RpcGateway } from '../chat/rpc.gateway';

@Controller('api/user')
@UseGuards(SsoAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private readonly rpcGateway: RpcGateway,
  ) {}

  /**
   * GET /api/user/node-status
   * 返回当前用户的本地 CLI 节点在线状态
   */
  @Get('node-status')
  async getNodeStatus(@Req() req: any) {
    const isOnline = this.rpcGateway.isUserOnline(req.user.workId);
    return {
      success: true,
      isOnline,
    };
  }

  /**
   * GET /api/user/profile
   * 返回当前用户的完整档案信息
   */
  @Get('profile')
  async getProfile(@Req() req: any) {
    const profile = await this.userService.getUserFullProfile(req.user.workId);
    return {
      success: true,
      profile,
    };
  }

  /**
   * PATCH /api/user/preferences
   * 更新用户的 AI 偏好设置
   */
  @Patch('preferences')
  async updatePreferences(@Req() req: any, @Body() body: any) {
    const updated = await this.prisma.userPreference.update({
      where: { userId: req.user.dbId },
      data: {
        defaultModel: body.defaultModel || undefined,
        language: body.language || undefined,
        theme: body.theme || undefined,
        config: body.config || undefined,
      },
    });

    return {
      success: true,
      preferences: updated,
    };
  }

  /**
   * POST /api/user/credentials
   * 同步外部系统凭证（如禅道 Token）
   */
  @Post('credentials')
  async updateCredentials(@Req() req: any, @Body() body: any) {
    const { systemType, token, username } = body;
    
    const updated = await this.prisma.userCredential.upsert({
      where: {
        userId_systemType: {
          userId: req.user.dbId,
          systemType,
        },
      },
      update: {
        token, // 生产环境应加密存储
        username,
        updatedAt: new Date(),
      },
      create: {
        userId: req.user.dbId,
        systemType,
        token,
        username,
      },
    });

    return {
      success: true,
      credential: {
        id: updated.id,
        systemType: updated.systemType,
        username: updated.username,
        updatedAt: updated.updatedAt,
      },
    };
  }
}
