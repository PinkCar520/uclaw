import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RpcModule } from './rpc.module';
import { SkillModule } from '../skill/skill.module';

/**
 * ChatModule
 *
 * 负责与本地 CLI 通信的基础设施及旧版模型列表接口。
 * 核心 AI 编排逻辑已迁移到 SkillModule。
 */
@Module({
  imports: [ConfigModule, RpcModule, SkillModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
