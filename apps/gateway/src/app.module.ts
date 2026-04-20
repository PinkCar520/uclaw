import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { UploadModule } from './upload/upload.module';
import { SessionModule } from './session/session.module';
import { SkillRegistryModule } from './skill-registry/skill-registry.module';
import { MCPServerModule } from './mcp-server/mcp-server.module';
import { ApprovalModule } from './skill/approval.module';
import { ProxyModule } from './proxy/proxy.module';
import { SsoAuthGuard } from './auth/sso.guard';
import { TracingModule } from './tracing/tracing.module';
import { RAGModule } from './rag/rag.module';
import { ZentaoModule } from './zentao/zentao.module';
import { SkillModule } from './skill/skill.module';

/**
 * AppModule
 *
 * 核心中枢，现在集成了 Prisma 数据库引擎、Auth 用户中心以及用户管理模块。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, // ← 全局数据库模块
    TracingModule, // ← 全局链路追踪模块
    RAGModule,     // ← 全局知识库/向量检索模块
    ZentaoModule,  // ← 禅道集成模块
    AuthModule,   // 内部包含 UserService
    ChatModule,
    UserModule,   // 对外暴露用户中心接口
    UploadModule, // 文件上传模块
    SessionModule, // 会话漫游数据接口模块
    SkillRegistryModule, // 技能注册中心
    SkillModule,  // ← Agent Skills 编排核心
    MCPServerModule, // MCP Server 管理
    ApprovalModule, // AGP 审批治理
    ProxyModule, // 图片代理
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SsoAuthGuard, // 全局认证守卫
    },
  ],
})
export class AppModule {}
