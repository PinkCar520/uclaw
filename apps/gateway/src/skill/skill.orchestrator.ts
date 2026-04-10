import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText, convertToModelMessages, stepCountIs, tool } from 'ai';
import { jsonSchema } from 'ai';
import { MCPClientManager } from '../mcp/mcp-client.manager';
import { SkillLoader } from './skill.loader';
import { RpcGateway } from '../chat/rpc.gateway';
import { SessionService } from '../session/session.service';
import { ApprovalService } from './approval.service';
import { z } from 'zod';
import type { SkillContext } from '@uclaw/core';

/**
 * SkillOrchestrator
 *
 * Implements the AgentSkills client-side protocol for UClaw Gateway.
 *
 * AgentSkills 5-step flow:
 *   1. Discovery  — SkillLoader scans skills/ directory on startup
 *   2. Disclose   — System Prompt includes <available_skills> catalog (Tier 1, ~100 tokens)
 *   3. Activate   — LLM calls `activate_skill` tool when it matches a description
 *   4. Execute    — LLM reads full SKILL.md body and follows its instructions
 *   5. Manage     — Activated skill content is wrapped in <skill_content> tags (context-safe)
 *
 * Ref: https://agentskills.io/client-implementation/adding-skills-support
 */
@Injectable()
export class SkillOrchestrator {
  private readonly logger = new Logger(SkillOrchestrator.name);

  constructor(
    private configService: ConfigService,
    private mcpManager: MCPClientManager,
    private skillLoader: SkillLoader,
    private rpcGateway: RpcGateway,
    private sessionService: SessionService,
    private approvalService: ApprovalService,
  ) {}

  // ──────────────────────────────────────────────
  // Model
  // ──────────────────────────────────────────────
  // ──────────────────────────────────────────────
  // Model
  // ──────────────────────────────────────────────
  private getModel(modelId?: string) {
    const vllmModels = (this.configService.get<string>('VLLM_MODEL_NAME') || 'qwen2.5-coder:7b').split(',').map(m => m.trim());
    const omlxModel = this.configService.get<string>('AI_GATEWAY_MODEL')?.trim();
    
    // 合并所有模型池
    const allModels = [...vllmModels];
    if (omlxModel && !allModels.includes(omlxModel)) {
      allModels.push(omlxModel);
    }

    const selectedModel = (modelId && allModels.includes(modelId)) ? modelId : allModels[0];

    // 路由逻辑
    let baseURL: string;
    let apiKey: string;
    let providerLabel: string;

    const isCloudModel = selectedModel.includes('deepseek') || selectedModel.includes('omni');
    const isOmlxModel = omlxModel && selectedModel === omlxModel;

    if (isCloudModel) {
      baseURL = this.configService.get<string>('DASHSCOPE_API_BASE') || '';
      apiKey = this.configService.get<string>('DASHSCOPE_API_KEY') || '';
      providerLabel = 'DashScope (Cloud)';
    } else if (isOmlxModel) {
      baseURL = this.configService.get<string>('AI_GATEWAY_BASE_URL') || '';
      apiKey = this.configService.get<string>('AI_GATEWAY_API_KEY') || 'unused';
      providerLabel = 'oMLX (Local)';
    } else {
      baseURL = this.configService.get<string>('VLLM_API_BASE') || '';
      apiKey = this.configService.get<string>('VLLM_API_KEY') || 'ollama';
      providerLabel = 'Ollama (Local)';
    }

    this.logger.log(`[Orchestrator] Routing model "${selectedModel}" to ${providerLabel}`);

    return createOpenAI({
      baseURL,
      apiKey,
    }).chat(selectedModel);
  }

  getAvailableModels() {
    const vllmModels = (this.configService.get<string>('VLLM_MODEL_NAME') || 'qwen2.5-coder:7b').split(',').map(m => m.trim());
    const omlxModel = this.configService.get<string>('AI_GATEWAY_MODEL')?.trim();

    const allModels = [...vllmModels];
    if (omlxModel && !allModels.includes(omlxModel)) {
      allModels.push(omlxModel);
    }

    return allModels.map((modelId) => {
      const isCloud = modelId.includes('deepseek') || modelId.includes('omni');
      const isOmlx = omlxModel && modelId === omlxModel;
      
      let provider = 'Private Ollama';
      let icon = 'Cpu';
      let color = 'text-blue-500';

      if (isCloud) {
        provider = 'Alibaba Bailian';
        icon = 'Cloud';
        color = 'text-orange-500';
      } else if (isOmlx) {
        provider = 'Local oMLX';
        icon = 'Zap';
        color = 'text-purple-500';
      }

      return {
        id: modelId,
        name: modelId,
        provider,
        icon,
        color,
      };
    });
  }

  // ──────────────────────────────────────────────
  // Step 2 + 3: System Prompt (AgentSkills Tier 1 + behavioral instructions)
  // ──────────────────────────────────────────────
  private async buildSystemPrompt(ctx: SkillContext): Promise<string> {
    const onlineClis = this.rpcGateway.getOnlineUsers();

    // Base identity prompt
    let prompt = `你是银行内网 AI 助手 UClaw。
当前登录用户工号: ${ctx.userId}
来源渠道: ${ctx.source}
当前在线的本地 CLI 节点: ${onlineClis.join(', ') || '无'}

你可以调用 MCP 工具（禅道、Jenkins、GitLab 等）以及通过 runLocalCommand 在开发者本地工作站执行指令。
拿到工具执行结果后，请用中文进行通俗易懂的总结。`;

    // AgentSkills Tier 1: inject skill catalog (<available_skills>)
    // + behavioral instructions (per spec: tell LLM how to activate)
    const catalogXml = await this.skillLoader.buildCatalogXml();
    prompt += `

以下 Skills 提供了特定任务的专项指令。当用户的请求与某个 Skill 的描述匹配时，
请调用 activate_skill 工具加载该 Skill 的完整指令，然后再开始执行任务。

${catalogXml}`;

    // Always inject .AIGUIDE.md (team conventions, global)
    const guide = await this.skillLoader.loadAiguide(ctx.workspacePath);
    if (guide) {
      prompt += `\n\n## 团队开发规范（.AIGUIDE.md，必须严格遵守）\n${guide}`;
      this.logger.log('.AIGUIDE.md injected into system prompt');
    }

    return prompt;
  }

  // ──────────────────────────────────────────────
  // Tools: MCP + local CLI + activate_skill
  // ──────────────────────────────────────────────
  private async buildTools(ctx: SkillContext, sessionId?: string): Promise<Record<string, any>> {
    // MCP tools (dynamic from mcp.config.json)
    const mcpTools = await this.mcpManager.getAITools();

    // Governance: Get active skill's governance rules (for Phase 4, we apply to all tools for demonstration)
    // In a real scenario, we would look up the active skill for this session.
    const requiresApproval = this.skillLoader.getRequiresApproval('fix-bug'); // Example: apply fix-bug rules

    // Wrap tools with approval logic
    const wrappedMcpTools: Record<string, any> = {};
    for (const [name, toolDef] of Object.entries(mcpTools)) {
      if (requiresApproval.includes(name)) {
        wrappedMcpTools[name] = this.wrapWithApproval(name, toolDef, sessionId || '', ctx.userId);
      } else {
        wrappedMcpTools[name] = toolDef;
      }
    }

    // Local CLI RPC tool (until mcp-local-fs is ready)
    const localCliTools = {
      runLocalCommand: tool({
        description: '在开发者的本地工作站执行安全指令（ls、git 操作、npm 构建等）',
        inputSchema: z.object({
          userId: z.string().describe('目标用户工号'),
          command: z
            .enum(['ls', 'git_status', 'git_add', 'git_commit', 'npm_build', 'read_file'])
            .describe('执行的指令名'),
          args: z.record(z.string(), z.any()).optional().describe('指令参数'),
        }),
        execute: async ({ userId, command, args }) => {
          try {
            const result = await this.rpcGateway.sendToCli(userId, command, args || {});
            return { status: 'Success', command, result };
          } catch (err: any) {
            return { status: 'Error', message: err.message };
          }
        },
      } as any),
    };

    // AgentSkills Step 4: activate_skill tool
    // LLM calls this to load full SKILL.md body (Tier 2) when description matches
    const skillLoader = this.skillLoader;
    const logger = this.logger;
    const skillTools = {
      activate_skill: tool({
        description:
          '当用户请求与某个 Skill 的描述匹配时，调用此工具加载该 Skill 的完整执行指令。加载后按照指令执行任务。',
        inputSchema: z.object({
          skill_name: z
            .string()
            .describe('要激活的 Skill 名称，必须与 <available_skills> 中的 <name> 完全一致'),
        }),
        execute: async ({ skill_name }) => {
          const content = await skillLoader.activate(skill_name);
          if (!content) {
            logger.warn(`activate_skill: skill "${skill_name}" not found`);
            return {
              error: `Skill "${skill_name}" not found. Available skills are listed in <available_skills>.`,
            };
          }
          logger.log(`activate_skill: "${skill_name}" delivered to LLM`);
          return { 
            message: `Skill "${skill_name}" has been successfully activated. Instructions are provided below. Please follow them strictly for all subsequent steps in this task. Do NOT call activate_skill again for "${skill_name}".`,
            skill_content: content 
          };
        },
      } as any),
    };

    return { ...wrappedMcpTools, ...localCliTools, ...skillTools };
  }

  /**
   * Wraps a tool with approval logic.
   * If the tool is in `requires-approval`, execution is paused and a request is created.
   */
  private wrapWithApproval(toolName: string, toolDef: any, sessionId: string, userId: string): any {
    const originalExecute = toolDef.execute;
    const approvalService = this.approvalService;
    const logger = this.logger;

    return tool({
      ...toolDef,
      execute: async (args: any) => {
        logger.log(`[AGP] Tool "${toolName}" requires approval. Pausing execution...`);
        
        // Create approval request
        const requestId = approvalService.createRequest({
          sessionId,
          userId,
          toolName,
          args,
        });

        return {
          status: 'pending_approval',
          requestId,
          message: `Action "${toolName}" requires your approval. Please check the UI to proceed.`,
        };
      },
    } as any);
  }

  // ──────────────────────────────────────────────
  // Public API: streaming (Web)
  // ──────────────────────────────────────────────
  async streamResponse(
    messages: any[],
    res: Response,
    ctx: SkillContext,
    modelId?: string,
    sessionId?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`streamResponse called with ${messages?.length} messages`);
      if (!Array.isArray(messages)) {
        throw new Error('messages must be an array');
      }

      // ── Step 1: 持久化用户消息（Server-First）────────────────
      // 只持久化最后一条用户消息（新发送的那条）
      if (sessionId) {
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
          const userContent = typeof lastUserMsg.content === 'string'
            ? lastUserMsg.content
            : (Array.isArray(lastUserMsg.parts)
                ? lastUserMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
                : '');
          await this.sessionService.addMessage(sessionId, {
            role: 'user',
            content: userContent,
            parts: Array.isArray(lastUserMsg.parts) ? lastUserMsg.parts : undefined,
            attachments: lastUserMsg.experimental_attachments ?? undefined,
          });
          this.logger.log(`[Orchestrator] Persisted user message to session ${sessionId}`);
        }
      }

      // 兼容某些版本的 AI SDK (如 6.0.x)，确保 User/Assistant 消息具有 parts 属性
      // 同时把 experimental_attachments 注入为 LLM 可读的 content parts
      const sanitizedMessages = messages.map(m => {
        // Log attachments if present
        if (m.experimental_attachments?.length > 0) {
          this.logger.log(`[Orchestrator] Message from ${m.role} contains ${m.experimental_attachments.length} attachments.`);
        }

        let parts: any[] = [];

        // Build base text part
        if (Array.isArray(m.parts)) {
          parts = [...m.parts];
        } else if (typeof m.content === 'string') {
          parts = [{ type: 'text', text: m.content }];
        }

        // Inject attachment content into parts so LLM can read files
        if (m.role === 'user' && Array.isArray(m.experimental_attachments) && m.experimental_attachments.length > 0) {
          for (const attachment of m.experimental_attachments) {
            const contentType: string = attachment.contentType || attachment.type || '';
            const url: string = attachment.url || '';
            const name: string = attachment.name || 'attachment';

            if (contentType.startsWith('image/')) {
              // Image: inject as image part
              parts.push({ type: 'image', image: url, mimeType: contentType });
            } else if (url.startsWith('data:')) {
              // Text / document: decode base64 and inject as text
              try {
                const base64Data = url.split(',')[1];
                if (base64Data) {
                  const decoded = Buffer.from(base64Data, 'base64').toString('utf-8');
                  parts.push({
                    type: 'text',
                    text: `\n\n---\n📎 **文件附件: ${name}**\n\`\`\`\n${decoded}\n\`\`\`\n---`,
                  });
                  this.logger.log(`[Orchestrator] Injected file content: "${name}" (${decoded.length} chars)`);
                }
              } catch (err) {
                this.logger.warn(`[Orchestrator] Failed to decode attachment "${name}": ${err}`);
              }
            }
          }
        }

        return { ...m, parts };
      });

      const modelMessages = await convertToModelMessages(sanitizedMessages);
      this.logger.debug(`modelMessages converted: ${modelMessages?.length}`);

      const [systemPrompt, tools] = await Promise.all([
        this.buildSystemPrompt(ctx),
        this.buildTools(ctx, sessionId),
      ]);
      
      this.logger.debug(`SystemPrompt built (${systemPrompt?.length} chars)`);
      this.logger.debug(`Tools built: [${Object.keys(tools || {}).join(', ')}]`);

      this.logger.log(`[Orchestrator] AgentSkills mode for user ${ctx.userId}`);

      const result = streamText({
        model: this.getModel(modelId),
        messages: modelMessages,
        toolChoice: 'auto',
        stopWhen: stepCountIs(10),
        system: systemPrompt,
        tools,
        onStepFinish: ({ stepNumber, toolCalls }) => {
          this.logger.debug(`Step ${stepNumber} finished. Tool calls: ${toolCalls?.length || 0}`);
        },
        onFinish: async ({ text, response }) => {
          // ── Step 2: 持久化 AI 回复（流完成后写库）────────────────
          if (sessionId && text) {
            try {
              // 提取 parts（含 tool-invocation 等）
              const assistantParts = response?.messages?.[0]?.content ?? undefined;
              await this.sessionService.addMessage(sessionId, {
                role: 'assistant',
                content: text,
                parts: Array.isArray(assistantParts) ? assistantParts : undefined,
              });
              this.logger.log(`[Orchestrator] Persisted assistant reply to session ${sessionId} (${text.length} chars)`);

              // ── Step 3: 自动生成标题（第一轮对话时）─────────────
              await this.maybeSummarizeTitle(sessionId, messages, text, modelId);
            } catch (err: any) {
              this.logger.error(`Failed to persist assistant reply: ${err.message}`);
            }
          }
        },
      });

      result.pipeUIMessageStreamToResponse(res);
    } catch (err: any) {
      this.logger.error(`Stream error: ${err.message}`);
      if (err.stack) this.logger.error(err.stack);
      res.status(500).send(err.message);
    }
  }

  /**
   * 仅在会话第一轮（1条用户消息 + 1条 AI 回复）时自动生成标题
   */
  private async maybeSummarizeTitle(
    sessionId: string,
    messages: any[],
    assistantReply: string,
    modelId?: string,
  ): Promise<void> {
    // 只在第一条用户消息 + 第一条 AI 回复时触发
    const userMsgCount = messages.filter(m => m.role === 'user').length;
    if (userMsgCount !== 1) return;

    const firstUserMsg = messages.find(m => m.role === 'user');
    const userContent = typeof firstUserMsg?.content === 'string'
      ? firstUserMsg.content
      : '';
    if (!userContent) return;

    try {
      const title = await this.generateTitle(userContent, modelId);
      // 通过 sessionId 直接更新数据库标题（不需要 userId 鉴权，内部调用）
      await this.sessionService['prisma'].session.update({
        where: { id: sessionId },
        data: { title },
      });
      this.logger.log(`[Orchestrator] Auto-titled session ${sessionId}: "${title}"`);
    } catch (err: any) {
      this.logger.warn(`Auto-title generation failed: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────
  // Public API: text response (IM Bot)
  // ──────────────────────────────────────────────
  async textResponse(userId: string, content: string, source: 'im' | 'cli' = 'im'): Promise<string> {
    try {
      const ctx: SkillContext = {
        userId,
        source,
        userMessage: content,
      };

      const [systemPrompt, tools] = await Promise.all([
        this.buildSystemPrompt(ctx),
        this.buildTools(ctx, undefined),
      ]);

      const { text } = await generateText({
        model: this.getModel(),
        messages: [{ role: 'user', content }],
        toolChoice: 'auto',
        stopWhen: stepCountIs(10),
        system: systemPrompt,
        tools,
      });

      return text;
    } catch (err: any) {
      this.logger.error(`Text response error: ${err.message}`);
      return `抱歉，处理您的请求时发生了错误: ${err.message}`;
    }
  }

  /**
   * 为会话生成简短摘要标题 (LLM 自动总结)
   */
  async generateTitle(userContent: string, modelId?: string): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.getModel(modelId),
        system: '你是一个标题生成助手。请根据用户提供的第一条对话内容，总结一个 5 字以内的中文标题，不要包含标点符号。直接返回标题文字。请尽量精准且干脆。',
        messages: [{ role: 'user', content: userContent }],
      });
      return text.trim().replace(/[。？！，、]/g, '');
    } catch (err: any) {
      this.logger.error(`Generate title error: ${err?.message || String(err)}`);
      return userContent.slice(0, 15);
    }
  }
}
