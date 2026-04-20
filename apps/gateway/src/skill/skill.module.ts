import { Module } from '@nestjs/common';
import { SkillOrchestrator } from './skill.orchestrator';
import { SkillLoader } from './skill.loader';
import { PermissionService } from './permission.service';
import { MCPModule } from '../mcp/mcp.module';
import { RpcModule } from '../chat/rpc.module';
import { SessionModule } from '../session/session.module';
import { SkillController } from './skill.controller';
import { ApprovalModule } from './approval.module';
import { PermissionModule } from './permission.module';
import { PermissionController } from './permission.controller';

/**
 * SkillModule
 *
 * Wires up the AgentSkills-compatible skill system:
 *   - SkillLoader: Discovery, Parse, Disclose (catalog), Activate (full content)
 *   - SkillOrchestrator: System Prompt builder + activate_skill tool + stream/text API
 *   - SkillController: Serves catalog API to frontend
 *   - PermissionService: Claude Code-compatible permission rules evaluation
 *   - PermissionController: REST API for permission inspection
 *
 * SkillRegistry and AiguideLoader are removed — their logic is now in SkillLoader.
 * Depends on RpcModule (not ChatModule) to avoid circular dependency.
 * Depends on SessionModule for Server-First message persistence.
 */
import { TracingModule } from '../tracing/tracing.module';
import { RAGModule } from '../rag/rag.module';
import { ZentaoModule } from '../zentao/zentao.module';

@Module({
  imports: [MCPModule, RpcModule, SessionModule, ApprovalModule, PermissionModule, TracingModule, RAGModule, ZentaoModule],
  controllers: [SkillController, PermissionController],
  providers: [SkillOrchestrator, SkillLoader],
  exports: [SkillOrchestrator, SkillLoader],
})
export class SkillModule {}

