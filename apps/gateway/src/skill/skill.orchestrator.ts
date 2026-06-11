import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText, convertToModelMessages, stepCountIs, tool, UIMessage } from 'ai';
import { MCPClientManager } from '../mcp/mcp-client.manager';
import { SkillLoader } from './skill.loader';
import { PermissionService } from './permission.service';
import { RpcGateway } from '../chat/rpc.gateway';
import { SessionService } from '../session/session.service';
import { ApprovalService } from './approval.service';
import { TracingService } from '../tracing/tracing.service';
import { RAGService } from '../rag/rag.service';
import { ZentaoService } from '../zentao/zentao.service';
import { z } from 'zod';
import type { SkillContext } from '@ocean/core';

/**
 * SkillOrchestrator
 *
 * Implements the AgentSkills client-side protocol for Ocean Gateway.
 */
@Injectable()
export class SkillOrchestrator {
  private readonly logger = new Logger(SkillOrchestrator.name);

  constructor(
    private configService: ConfigService,
    private mcpManager: MCPClientManager,
    private skillLoader: SkillLoader,
    private permissionService: PermissionService,
    private rpcGateway: RpcGateway,
    private sessionService: SessionService,
    private approvalService: ApprovalService,
    private tracingService: TracingService,
    private ragService: RAGService,
    private zentaoService: ZentaoService,
    @Inject('PRISMA_CLIENT') private prisma: any,
  ) {}

  // ──────────────────────────────────────────────
  // Model
  // ──────────────────────────────────────────────
  private getModel(modelId?: string) {
    const defaultProvider = this.configService.get<string>('DEFAULT_AI_PROVIDER') || 'deepseek';
    
    // 聚合所有的配置项
    const configs: Record<string, any> = {
      deepseek: {
        apiKey: this.configService.get('DEEPSEEK_API_KEY'),
        baseURL: this.configService.get('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1',
        model: this.configService.get('DEEPSEEK_MODEL'),
      },
      anthropic: {
        apiKey: this.configService.get('ANTHROPIC_API_KEY'),
        model: this.configService.get('ANTHROPIC_MODEL'),
      },
      gemini: {
        apiKey: this.configService.get('GEMINI_API_KEY'),
        model: this.configService.get('GEMINI_MODEL'),
      },
      dashscope: {
        apiKey: this.configService.get('DASHSCOPE_API_KEY'),
        baseURL: this.configService.get('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: this.configService.get('DASHSCOPE_MODEL'),
      },
      openai: {
        apiKey: this.configService.get('OPENAI_API_KEY'),
        baseURL: this.configService.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
        model: this.configService.get('OPENAI_MODEL'),
      },
      local: {
        apiKey: this.configService.get('LOCAL_API_KEY'),
        baseURL: this.configService.get('LOCAL_BASE_URL') || 'http://localhost:11434/v1',
        model: this.configService.get('LOCAL_MODEL'),
      }
    };

    // 如果传入了明确的 modelId，可以扩展逻辑去匹配。为了简单起见，如果 modelId 是 provider 的名字，直接切换
    let activeProviderKey = defaultProvider;
    let selectedModelId = configs[defaultProvider]?.model;
    
    if (modelId) {
      if (configs[modelId]) {
        activeProviderKey = modelId;
        selectedModelId = configs[modelId].model;
      } else {
        // Find which provider owns this model
        for (const [key, conf] of Object.entries(configs)) {
          if (conf.model === modelId || conf.model?.split(',').map((m:string)=>m.trim()).includes(modelId)) {
            activeProviderKey = key;
            selectedModelId = modelId;
            break;
          }
        }
      }
    }

    const conf = configs[activeProviderKey];
    if (!conf || (!conf.apiKey && activeProviderKey !== 'local')) {
      this.logger.warn(`Provider ${activeProviderKey} is not fully configured.`);
    }

    if (activeProviderKey === 'anthropic') {
      const { createAnthropic } = require('@ai-sdk/anthropic');
      return createAnthropic({ apiKey: conf.apiKey })(selectedModelId);
    }
    
    if (activeProviderKey === 'gemini') {
      const { createGoogleGenerativeAI } = require('@ai-sdk/google');
      return createGoogleGenerativeAI({ apiKey: conf.apiKey })(selectedModelId);
    }

    // Default to OpenAI-compatible for DeepSeek, DashScope, OpenAI, Local
    const provider = createOpenAI({
      baseURL: conf.baseURL,
      apiKey: conf.apiKey || 'empty',
      ...((activeProviderKey === 'dashscope' || activeProviderKey === 'deepseek') && selectedModelId?.includes('deepseek') ? {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.body && typeof init.body === 'string') {
            try {
              const body = JSON.parse(init.body);
              if (activeProviderKey === 'deepseek') {
                body.thinking = { type: 'enabled' };
                body.reasoning_effort = 'high';
              } else {
                body.enable_thinking = true;
              }
              init.body = JSON.stringify(body);
            } catch { /* ignore parse errors */ }
          }
          return globalThis.fetch(input, init);
        },
      } : {}),
    });

    return provider.chat(selectedModelId);
  }

  /**
   * 获取当前网关配置的模型列表
   */
  getAvailableModels() {
    const models = [
      { id: this.configService.get('DEEPSEEK_MODEL'), provider: 'deepseek', icon: 'Sparkles', color: 'text-blue-500' },
      { id: this.configService.get('ANTHROPIC_MODEL'), provider: 'anthropic', icon: 'Brain', color: 'text-purple-500' },
      { id: this.configService.get('GEMINI_MODEL'), provider: 'gemini', icon: 'Globe', color: 'text-orange-500' },
      { id: this.configService.get('DASHSCOPE_MODEL'), provider: 'dashscope', icon: 'Cloud', color: 'text-indigo-500' },
      { id: this.configService.get('OPENAI_MODEL'), provider: 'openai', icon: 'Zap', color: 'text-green-500' },
      { id: this.configService.get('LOCAL_MODEL'), provider: 'local', icon: 'Terminal', color: 'text-gray-500' }
    ];

    return models
      .filter(m => m.id)
      .map(m => ({
        id: m.id,
        name: m.id,
        provider: m.provider,
        icon: m.icon,
        color: m.color,
      }));
  }

  // ──────────────────────────────────────────────
  // Step 2 + 3: System Prompt
  // ──────────────────────────────────────────────
  private async buildSystemPrompt(ctx: SkillContext): Promise<string> {
    const onlineClis = this.rpcGateway.getOnlineUsers();
    const promptPath = this.configService.get<string>('SYSTEM_PROMPT_PATH') || 'agent/prompts/system_prompt.md';
    
    let basePrompt = `你是银行内网 AI 助手 Ocean。
当前登录用户工号: ${ctx.userId}
当前在线的本地 CLI 节点: ${onlineClis.join(', ') || '无'}

你可以调用 MCP 工具以及直接操作开发者本地工作站的文件和 Git 仓库。
拿到工具执行结果后，请用中文进行通俗易懂的总结。`;

    try {
      const fullPath = require('path').resolve(process.cwd(), promptPath);
      if (require('fs').existsSync(fullPath)) {
        basePrompt = require('fs').readFileSync(fullPath, 'utf-8');
      }
    } catch (err) {
      this.logger.warn(`Failed to load prompt from ${promptPath}, using fallback.`);
    }

    const catalogXml = await this.skillLoader.buildCatalogXml();
    let prompt = basePrompt
        .replace('{{currentUserId}}', ctx.userId)
        .replace('{{onlineClis}}', onlineClis.join(', ') || '无');

    // 注入用户自定义指令 (对标 Claude Custom Instructions)
    try {
      const prefs = await this.prisma.userPreference.findFirst({
        where: { user: { workId: ctx.userId } }
      });
      if (prefs?.customInstructions) {
        prompt += `\n\n## 用户个性化指令 (Custom Instructions)\n以下是用户定义的回复偏好，请务必严格遵守：\n${prefs.customInstructions}`;
      }
    } catch (err: any) {
      this.logger.error(`Failed to fetch user preferences: ${err.message}`);
    }
        
    prompt += `\n\n以下 Skills 提供了特定任务的专项指令。当用户的请求与某个 Skill 的描述匹配时，请调用 activate_skill 工具加载该 Skill 的完整指令。\n\n${catalogXml}`;

    const guide = await this.skillLoader.loadAiguide(ctx.workspacePath);
    if (guide) {
      prompt += `\n\n## 团队开发规范（.AIGUIDE.md）\n${guide}`;
    }

    return prompt;
  }

  // ──────────────────────────────────────────────
  // Tools: Atomic Local Tools + MCP + activate_skill
  // ──────────────────────────────────────────────
  private async buildTools(ctx: SkillContext, sessionId?: string): Promise<Record<string, any>> {
    const currentUserId = ctx.userId;

    const atomicTools = {
      getBugInfo: tool({
        description: '获取指定 Bug ID 的详细信息，结果将以卡片形式展示',
        inputSchema: z.object({
          bugId: z.string().describe('缺陷的 ID，如 BUG-2048'),
        }),
        execute: async ({ bugId }) => {
          const bug = await this.zentaoService.getBugInfo(bugId);
          if (!bug) {
            return { found: false, message: `未找到 BUG-${bugId}` };
          }
          return {
            found: true,
            bugId: bug.id,
            ui: {
              uiType: 'bug_card',
              props: {
                id: bug.id,
                title: bug.title,
                status: bug.status,
                assignee: bug.assignee,
                severity: bug.severity,
                description: bug.description,
                createdAt: bug.createdAt,
              },
            },
          };
        },
      }),

      searchBugs: tool({
        description: '根据关键词在禅道中搜索缺陷',
        inputSchema: z.object({
          query: z.string().describe('搜索关键词'),
        }),
        execute: async ({ query }) => {
          return await this.zentaoService.searchBugs(query);
        },
      }),

      resolveBug: tool({
        description: '在禅道中将指定的 Bug 标记为已解决（Resolved）',
        inputSchema: z.object({
          bugId: z.string().describe('缺陷的 ID，如 BUG-5'),
        }),
        execute: async ({ bugId }) => {
          const success = await this.zentaoService.resolveBug(bugId);
          return { status: success ? 'Success' : 'Error', bugId };
        },
      }),

      local_file_read: tool({
        description: '读取开发者本地工作站的文件内容',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径'),
        }),
        execute: async ({ path }) => {
          const result = await this.rpcGateway.sendToCli(currentUserId, 'read_file', { path });
          return {
            status: 'Success',
            path,
            content: result,
            ui: {
              uiType: 'code_block',
              props: { command: `read_file ${path}`, output: result, status: 'success', language: path.split('.').pop() || 'text' },
            },
            // Metadata for Active Context
            activeContext: {
              type: 'file',
              name: path.split('/').pop() || path,
              path: path,
              status: 'DONE',
              progress: 100
            }
          };
        },
      }),

      rag_search: tool({
        description: '在 Ocean 知识库（RAG）中搜索相关文档。适用于回答银行业务规则、系统使用说明、代码库规范等问题。',
        inputSchema: z.object({
          query: z.string().describe('搜索关键词或语义查询'),
          limit: z.number().optional().default(5).describe('返回结果条数'),
        }),
        execute: async ({ query, limit }) => {
          return await this.tracingService.traceCall('RAG Search', { query, limit }, async (span) => {
            const results = await this.ragService.searchSimilarity(query, limit);
            span.setAttribute('results_count', results.length);
            return {
              status: 'Success',
              results: results.map(r => ({
                title: r.title,
                content: r.content,
                score: r.distance,
              }))
            };
          });
        },
      }),

      local_file_edit: tool({
        description: '通过精准匹配旧代码块并替换为新代码块来修改本地文件。',
        inputSchema: z.object({
          path: z.string().describe('文件相对路径'),
          oldString: z.string().describe('要被替换的原始代码块（必须完全匹配）'),
          newString: z.string().describe('替换后的新代码块'),
        }),
        execute: async ({ path, oldString, newString }) => {
          const result = await this.rpcGateway.sendToCli(currentUserId, 'local_file_edit', { path, oldString, newString, sessionId });
          return {
            status: 'Success',
            path,
            ui: {
              uiType: 'diff_viewer',
              props: { fileName: path, diff: [{ type: 'deletion', content: oldString }, { type: 'addition', content: newString }] },
            },
            activeContext: {
              type: 'file',
              name: path.split('/').pop() || path,
              path: path,
              status: 'SAVED',
              progress: 100
            }
          };
        },
      }),

      local_git: tool({
        description: '操作本地 Git 仓库（status, add, commit, push, log, diff, branch）。',
        inputSchema: z.object({
          action: z.enum(['status', 'add', 'commit', 'push', 'log', 'diff', 'branch']).describe('Git 动作'),
          args: z.string().optional().describe('动作参数，如 "." 或 "-m \"message\""'),
        }),
        execute: async ({ action, args }) => {
          const result = await this.rpcGateway.sendToCli(currentUserId, 'local_git', { action, args, sessionId });
          
          const response: any = {
            status: 'Success',
            ...result,
            ui: { 
              uiType: 'code_block', 
              props: { 
                command: `git ${action} ${args || ''}`.trim(),
                output: result.raw || (typeof result === 'string' ? result : JSON.stringify(result, null, 2)),
                status: 'success'
              } 
            },
          };

          // Workspace Update for Active Context
          if (action === 'status' && result.branch) {
            response.activeContext = {
              workspace: {
                name: result.gitDir?.split('/').pop() || 'Ocean',
                branch: result.branch,
                isClean: result.isClean,
                path: result.cwd || ''
              }
            };
          }

          return response;
        },
      }),

      local_bash: tool({
        description: '在开发者本地工作站执行 Shell 指令（编译、测试、安装依赖等）。',
        inputSchema: z.object({
          command: z.string().describe('要执行的完整 Shell 指令'),
        }),
        execute: async ({ command }) => {
          const result = await this.rpcGateway.sendToCli(currentUserId, 'bash', { command, sessionId });
          return {
            status: 'Success',
            output: result,
            ui: { uiType: 'code_block', props: { command, output: result, status: 'success' } },
          };
        },
      }),

      local_plan: tool({
        description: '管理复杂任务的执行计划（编排工作流）。',
        inputSchema: z.object({
          action: z.enum(['start', 'update', 'list', 'exit']).describe('操作'),
          subjects: z.array(z.string()).optional().describe('步骤列表'),
          id: z.string().optional().describe('任务 ID'),
          status: z.enum(['todo', 'doing', 'done', 'failed']).optional().describe('状态'),
        }),
        execute: async (params) => {
          const result = await this.rpcGateway.sendToCli(currentUserId, 'local_plan', { ...params, sessionId });
          return { status: 'Success', ...result, ui: { uiType: 'task_plan', props: result } };
        },
      }),

      activate_skill: tool({
        description: '加载特定 Skill 的完整执行指令。',
        inputSchema: z.object({
          skill_name: z.string().describe('Skill 名称'),
        }),
        execute: async ({ skill_name }) => {
          const content = await this.skillLoader.activate(skill_name);
          if (!content) return { error: `Skill "${skill_name}" not found.` };
          return { message: `Skill "${skill_name}" activated.`, skill_content: content };
        },
      }),
    };

    // Wrap high-risk tools with approval
    const finalTools: Record<string, any> = { ...atomicTools };
    if (sessionId) {
      finalTools.local_file_edit = this.wrapWithApproval('local_file_edit', atomicTools.local_file_edit, sessionId, currentUserId);
      finalTools.local_bash = this.wrapWithApproval('local_bash', atomicTools.local_bash, sessionId, currentUserId);
      
      const mcpTools = await this.mcpManager.getAITools();
      for (const [name, toolDef] of Object.entries(mcpTools)) {
        finalTools[name] = this.wrapWithApproval(name, toolDef, sessionId, currentUserId);
      }
    } else {
      const mcpTools = await this.mcpManager.getAITools();
      Object.assign(finalTools, mcpTools);
    }

    return finalTools;
  }

  private wrapWithApproval(toolName: string, toolDef: any, sessionId: string, userId: string): any {
    const originalExecute = toolDef.execute;
    const approvalService = this.approvalService;
    return tool({
      ...toolDef,
      execute: async (args: any) => {
        if (this.permissionService.isAutoAllowed(toolName)) return originalExecute(args);
        if (this.permissionService.isDenied(toolName)) throw new Error(`Permission Denied: ${toolName}`);

        const requestId = await approvalService.createRequest({ sessionId, toolName, args });
        const approved = await approvalService.waitForApproval(requestId, 5 * 60 * 1000);
        if (!approved) return { status: 'denied', message: `Action "${toolName}" was denied by user.` };
        return originalExecute(args);
      },
    } as any);
  }

  async streamResponse(messages: any[], res: Response, ctx: SkillContext, modelId?: string, sessionId?: string): Promise<void> {
    const isSearchMode = (ctx as any).search === true;
    const isKnowledgeMode = (ctx as any).knowledge === true;

    return await this.tracingService.traceCall('streamResponse', { 
      sessionId, 
      userId: ctx.userId,
      isSearch: isSearchMode,
      isKnowledge: isKnowledgeMode
    }, async (span) => {
      try {
        this.logger.log(`[Orchestrator] streamResponse session=${sessionId} messages=${messages?.length}`);
        
        let newUserMsgId: string | undefined;

        if (sessionId && Array.isArray(messages)) {
          const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
          if (lastUserMsg) {
            const userContent = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '';
            newUserMsgId = await this.sessionService.addMessage(sessionId, {
              role: 'user',
              content: userContent,
              parentId: (lastUserMsg as any).parentId,
              parts: lastUserMsg.parts,
              attachments: lastUserMsg.experimental_attachments,
            });
          }
        }

        // Robustly ensure messages have parts for the SDK
        const sanitizedMessages = (messages || []).map(m => {
          if (!m) return { role: 'user', content: '', parts: [] };
          let parts = m.parts;
          if (!parts && typeof m.content === 'string') {
            parts = [{ type: 'text', text: m.content }];
          }
          return { ...m, parts: parts || [] };
        });

        // --- RAG Context Injection ---
        if (isSearchMode || isKnowledgeMode) {
          const lastUserText = ctx.userMessage;
          if (lastUserText) {
            const contextResults = await this.ragService.searchSimilarity(lastUserText, 3);
            if (contextResults.length > 0) {
              const contextText = contextResults
                .map(r => `[Document: ${r.title}]\n${r.content}`)
                .join('\n\n');
              
              const ragPrompt = `以下是来自 Ocean 知识库的相关背景资料，请结合这些信息回答用户问题：\n\n${contextText}`;
              
              const lastIdx = sanitizedMessages.length - 1;
              if (lastIdx >= 0 && sanitizedMessages[lastIdx].role === 'user') {
                sanitizedMessages[lastIdx].content = `${ragPrompt}\n\n用户问题：${sanitizedMessages[lastIdx].content}`;
                // Also update parts if they exist
                if (sanitizedMessages[lastIdx].parts) {
                    sanitizedMessages[lastIdx].parts = [{ type: 'text', text: sanitizedMessages[lastIdx].content }];
                }
              }
              span.setAttribute('rag_context_injected', true);
            }
          }
        }

        const modelMessages = await convertToModelMessages(sanitizedMessages);
        const [systemPrompt, tools] = await Promise.all([this.buildSystemPrompt(ctx), this.buildTools(ctx, sessionId)]);

        const allParts: any[] = [];
        let fullText = '';

        const result = streamText({
          model: this.getModel(modelId),
          messages: modelMessages,
          toolChoice: 'auto',
          stopWhen: stepCountIs(10),
          system: systemPrompt,
          tools,
          onStepFinish: (event) => {
            const { text, toolCalls, toolResults } = event;
            
            // 1. 记录文本
            if (text) { 
              fullText += text; 
              allParts.push({ type: 'text', text }); 
            }

            // 2. 闭环审计逻辑：确保每一个 toolCall 都有对应的结果进入 allParts
            const handledCallIds = new Set<string>();

            // 先处理已经有真实结果的调用
            if (toolResults && Array.isArray(toolResults)) {
              for (const tr of toolResults) {
                const part = { 
                  type: 'tool-invocation', 
                  toolCallId: tr.toolCallId, 
                  toolName: tr.toolName, 
                  args: tr.input, 
                  result: tr.output 
                };
                allParts.push(part);
                handledCallIds.add(tr.toolCallId);
              }
            }

            // 补全审计：如果某些 toolCalls 丢失了结果（如异常中断），补全占位符防止 SDK 报错
            if (toolCalls && Array.isArray(toolCalls)) {
              for (const tc of toolCalls) {
                if (!handledCallIds.has(tc.toolCallId)) {
                  this.logger.warn(`[Orchestrator] Missing result for tool call ${tc.toolCallId} (${tc.toolName}). Injecting placeholder.`);
                  allParts.push({
                    type: 'tool-invocation',
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    args: (tc as any).args,
                    result: { error: 'Execution was interrupted or failed to return a valid result.' }
                  });
                }
              }
            }
          },
          onFinish: async ({ totalUsage }: any) => {
            if (totalUsage) {
                span.setAttribute('total_tokens', totalUsage.totalTokens || 0);
                span.setAttribute('prompt_tokens', totalUsage.inputTokens || 0);
                span.setAttribute('completion_tokens', totalUsage.outputTokens || 0);
            }

            // 修改持久化逻辑：只要有文本或者有工具调用记录 (allParts)，就必须保存
            if (sessionId && (fullText || allParts.length > 0)) {
              try {
                const usage = totalUsage ? { 
                  inputTokens: totalUsage.inputTokens ?? 0, 
                  outputTokens: totalUsage.outputTokens ?? 0, 
                  totalTokens: totalUsage.totalTokens ?? 0 
                } : undefined;
                
                await this.sessionService.addMessage(sessionId, { 
                  role: 'assistant', 
                  content: fullText || '', // 允许内容为空，只要 parts 有数据
                  parentId: newUserMsgId, // 指向刚创建的 User 消息
                  parts: allParts, 
                  usage 
                });
                this.logger.log(`[Orchestrator] Persisted assistant reply. Parts count: ${allParts.length}`);
              } catch (dbErr: any) {
                this.logger.error(`[Orchestrator] Failed to persist message: ${dbErr.message}`);
              }
            }
          },
        });

        result.pipeUIMessageStreamToResponse(res);
      } catch (err: any) {
        this.logger.error(`Stream error: ${err.message}`);
        span.recordException(err);
        if (err.stack) this.logger.error(err.stack);
        if (!res.headersSent) res.status(500).send(err.message);
      }
    });
  }

  async textResponse(userId: string, content: string, source: 'im' | 'cli' = 'im'): Promise<string> {
    try {
      const ctx: SkillContext = { userId, source, userMessage: content };
      const [systemPrompt, tools] = await Promise.all([this.buildSystemPrompt(ctx), this.buildTools(ctx)]);
      const { text } = await generateText({ model: this.getModel(), messages: [{ role: 'user', content }], system: systemPrompt, tools, stopWhen: stepCountIs(10) });
      return text;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  }

  /**
   * 为会话生成简短摘要标题
   */
  async generateTitle(userContent: string, modelId?: string): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.getModel(modelId),
        system: '你是一个标题生成助手。总结一个 5 字以内的中文标题，不要标点符号。直接返回文字。',
        messages: [{ role: 'user', content: userContent }],
      });
      return text.trim().replace(/[。？！，、]/g, '');
    } catch (err: any) {
      this.logger.error(`Generate title error: ${err?.message || String(err)}`);
      return userContent.slice(0, 15);
    }
  }

  /**
   * AI 智能补全 (Ghost Text)
   * 基于用户输入的前缀，预测并补全为更专业的 Prompt
   */
  async autocomplete(prefix: string): Promise<string> {
    try {
      const models = this.getAvailableModels();
      if (models.length === 0) return '';

      const fastModelId = models.find(m => 
        m.name.toLowerCase().includes('llama') || 
        m.name.toLowerCase().includes('3b') || 
        m.name.toLowerCase().includes('flash') || 
        m.name.toLowerCase().includes('coder')
      )?.id || models[0].id;

      const { text } = await generateText({        model: this.getModel(fastModelId),
        system: `You are a Ghost-Text generator for a professional AI workspace.
Your ONLY goal is to continue or refine the user's input text to make it a better prompt.

CRITICAL RULES:
1. NEVER answer the user's question.
2. ONLY provide text that completes the user's thought or adds professional constraints.
3. Start exactly where the user left off.
4. Keep it under 12 words.
5. If the input is already professional, return nothing.

EXAMPLES:
- User: "帮我看看这个合同" -> Completion: "，重点检查知识产权条款和违约责任。"
- User: "ocean是什么项目？" -> Completion: "，请从技术架构和法律AI产品的定位进行深度解析。"
- User: "写一段代码" -> Completion: "实现一个基于 React 的高度自适应文本框。"`,
        messages: [{ role: 'user', content: prefix }],
        temperature: 0.1,
      });

      return text.trim();
    } catch (err: any) {
      this.logger.error(`Autocomplete error: ${err?.message || String(err)}`);
      return '';
    }
  }
}
