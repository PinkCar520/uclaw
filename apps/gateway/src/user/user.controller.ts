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
   * POST /api/user/node/create-local-project
   * RPC: 请求本地助手创建一个新的项目文件夹
   */
  @Post('node/create-local-project')
  async createLocalProject(@Req() req: any, @Body() body: any) {
    const { projectName, category } = body;
    try {
      const result = await this.rpcGateway.sendToCli(req.user.workId, 'create_local_project', {
        name: projectName,
        category
      });
      return {
        success: true,
        path: result.path
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * GET /api/user/profile
   * 返回当前用户的完整档案信息
   */
  @Get('profile')
  async getProfile(@Req() req: any) {
    const profile = await this.userService.getUserFullProfile(req.user.workId);
    
    // 动态计算统计信息
    const [sessionCount, messageCount] = await Promise.all([
      this.prisma.session.count({ where: { userId: req.user.dbId } }),
      this.prisma.message.count({ 
        where: { 
          session: { userId: req.user.dbId },
          role: 'user'
        } 
      }),
    ]);

    return {
      success: true,
      profile: {
        ...profile,
        stats: {
          sessionCount,
          messageCount,
          storageUsed: '1.2 GB', // 暂存占位
        }
      },
    };
  }

  /**
   * PATCH /api/user/profile
   * 更新用户基础资料（姓名、邮箱）
   */
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() body: any) {
    const updated = await this.prisma.user.update({
      where: { id: req.user.dbId },
      data: {
        name: body.name || undefined,
        email: body.email || undefined,
        avatar: body.avatar || undefined,
      },
    });

    return {
      success: true,
      user: updated,
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
        customInstructions: body.customInstructions !== undefined ? body.customInstructions : undefined,
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
