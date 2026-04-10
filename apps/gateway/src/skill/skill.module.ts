import { Module } from '@nestjs/common';
import { SkillOrchestrator } from './skill.orchestrator';
import { SkillLoader } from './skill.loader';
import { MCPModule } from '../mcp/mcp.module';
import { RpcModule } from '../chat/rpc.module';
import { SessionModule } from '../session/session.module';
import { SkillController } from './skill.controller';
import { ApprovalModule } from './approval.module';

/**
 * SkillModule
 *
 * Wires up the AgentSkills-compatible skill system:
 *   - SkillLoader: Discovery, Parse, Disclose (catalog), Activate (full content)
 *   - SkillOrchestrator: System Prompt builder + activate_skill tool + stream/text API
 *   - SkillController: Serves catalog API to frontend
 *
 * SkillRegistry and AiguideLoader are removed — their logic is now in SkillLoader.
 * Depends on RpcModule (not ChatModule) to avoid circular dependency.
 * Depends on SessionModule for Server-First message persistence.
 */
@Module({
  imports: [MCPModule, RpcModule, SessionModule, ApprovalModule],
  controllers: [SkillController],
  providers: [SkillOrchestrator, SkillLoader],
  exports: [SkillOrchestrator, SkillLoader],
})
export class SkillModule {}

