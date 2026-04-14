import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ZentaoService } from './zentao.service';
import { RpcModule } from './rpc.module';
import { SkillModule } from '../skill/skill.module';
import { MCPModule } from '../mcp/mcp.module';

/**
 * ChatModule
 *
 * - 导入 RpcModule（提供 RpcGateway，供 ZentaoService 等使用）
 * - 导入 SkillModule（提供 SkillOrchestrator，供 ChatController 切换到新链路）
 * - 导入 MCPModule（提供 MCPClientManager，供 ChatService 使用）
 * - ChatService 继续保留，负责 models 列表等非 AI 核心逻辑
 */
@Module({
  imports: [ConfigModule, RpcModule, SkillModule, MCPModule],
  controllers: [ChatController],
  providers: [ChatService, ZentaoService],
  exports: [ChatService],
})
export class ChatModule {}

