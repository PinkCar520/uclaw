import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { GetPromptResult, CreateMessageRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tool, jsonSchema } from 'ai';
import * as fs from 'fs';
import * as path from 'path';
import type {
  MCPServerConfig,
  MCPServerFileConfig,
  MCPResource,
  MCPResourceContents,
  MCPResourceTemplate,
  MCPPrompt,
  MCPElicitationRequest,
  MCPElicitationResponse,
  MCPTransportType,
} from './mcp.types';
import { createTransport } from './mcp-transport.factory';
import { RpcGateway } from '../chat/rpc.gateway';

interface ManagedMCPClient {
  client: Client;
  transport: Transport;
  config: MCPServerConfig;
  transportType: MCPTransportType;
  /** 资源缓存 */
  resourceCache?: Map<string, { content: MCPResourceContents; expiresAt: number }>;
  /** 征求回调映射 */
  elicitationCallbacks?: Map<string, (response: MCPElicitationResponse) => void>;
}

/**
 * MCPClientManager
 *
 * Gateway 侧的 MCP 客户端管理器，负责：
 * 1. 从 mcp.config.json 读取所有 MCP Server 配置
 * 2. 动态启动并连接各 MCP Server (Stdio, SSE, HTTP)
 * 3. 聚合所有工具，向 ChatService 提供统一的 AI SDK 工具集
 * 4. 实现 Sampling (反向采样) 和 Elicitation (用户征求)
 */
@Injectable()
export class MCPClientManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MCPClientManager.name);
  private clients = new Map<string, ManagedMCPClient>();

  /** 聚合后的工具定义缓存 */
  private cachedAITools: Record<string, any> | null = null;

  constructor(
    private configService: ConfigService,
    private moduleRef: ModuleRef,
    @Inject(forwardRef(() => RpcGateway))
    private rpcGateway: RpcGateway,
  ) {}

  private replaceVars(value: string): string {
    return value.replace(/\$\{(\w+)\}/g, (_, name) => {
      return this.configService.get<string>(name) || process.env[name] || '';
    });
  }

  private resolveServerConfig(config: MCPServerConfig): MCPServerConfig {
    return {
      ...config,
      command: config.command ? this.replaceVars(config.command) : undefined,
      args: (config.args || []).map((arg) => this.replaceVars(arg)),
      url: config.url ? this.replaceVars(config.url) : undefined,
      headers: Object.fromEntries(
        Object.entries(config.headers || {}).map(([key, val]) => [key, this.replaceVars(val)]),
      ),
      env: Object.fromEntries(
        Object.entries(config.env || {}).map(([key, val]) => [key, this.replaceVars(val)]),
      ),
    };
  }

  // ──────────────────────────────────────────────
  // 生命周期：启动
  // ──────────────────────────────────────────────
  async onModuleInit() {
    const configPath = path.join(process.cwd(), 'mcp.config.json');

    if (!fs.existsSync(configPath)) {
      this.logger.warn(`mcp.config.json not found at ${configPath}. MCP layer disabled.`);
      return;
    }

    let fileConfig: MCPServerFileConfig;
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch (err) {
      this.logger.error(`Failed to parse mcp.config.json: ${(err as Error).message}`);
      return;
    }

    const resolvedServers = fileConfig.mcpServers.map((srv) => this.resolveServerConfig(srv));

    const enabledServers = resolvedServers.filter((s) => s.enabled);
    this.logger.log(`Found ${enabledServers.length} enabled MCP server(s): ${enabledServers.map((s) => s.id).join(', ')}`);

    // 并行启动所有 enabled MCP Servers
    await Promise.allSettled(
      enabledServers.map((srv) => this.connectServer(srv)),
    );

    this.logger.log(`MCPClientManager initialized. Connected: [${Array.from(this.clients.keys()).join(', ')}]`);
  }

  // ──────────────────────────────────────────────
  // 生命周期：关闭
  // ──────────────────────────────────────────────
  async onModuleDestroy() {
    this.logger.log('Shutting down all MCP client connections...');
    for (const [id, managed] of this.clients.entries()) {
      try {
        await managed.client.close();
        this.logger.log(`[${id}] Disconnected`);
      } catch (err) {
        this.logger.warn(`[${id}] Error during disconnect: ${(err as Error).message}`);
      }
    }
    this.clients.clear();
  }

  // ──────────────────────────────────────────────
  // 公共 API：获取聚合的 AI SDK 工具集
  // ──────────────────────────────────────────────
  async getAITools(): Promise<Record<string, any>> {
    if (this.cachedAITools) {
      return this.cachedAITools;
    }

    const aggregated: Record<string, any> = {};

    for (const [serverId, managed] of this.clients.entries()) {
      try {
        const { tools } = await managed.client.listTools();

        for (const toolDef of tools) {
          const namespacedName = `${serverId}__${toolDef.name}`;
          aggregated[namespacedName] = tool({
            description: `[${serverId}] ${toolDef.description || toolDef.name}`,
            inputSchema: jsonSchema(
              (toolDef.inputSchema ?? { type: 'object', properties: {} }) as any,
            ),
            execute: async (params: any) => {
              this.logger.debug(`[MCP:${serverId}] Calling tool: ${toolDef.name}`);
              try {
                const result = await managed.client.callTool({
                  name: toolDef.name,
                  arguments: params,
                });
                
                const content = result.content as Array<{ type: string; text?: string }>;
                const textContent = content.find((c) => c.type === 'text');
                const rawText = textContent?.text ?? JSON.stringify(content);

                // ── UI Protocol 解析 ──
                const uiMatch = rawText.match(/__UI__:([\s\S]*?)$/);
                if (uiMatch) {
                  try {
                    const uiData = JSON.parse(uiMatch[1]);
                    
                    if (uiData.uiType === 'elicitation' || uiData.uiType === 'approval_card') {
                      const requestId = uiData.props?.id || `req_${Math.random().toString(36).substring(7)}`;
                      const toolName = uiData.props?.toolName || toolDef.name;
                      
                      this.logger.log(`[MCP:${serverId}] Registering approval callback for ${requestId}`);
                      this.registerElicitationResponseCallback(requestId, (res) => {
                        this.logger.log(`[MCP:${serverId}] Received user response for ${requestId}: ${res.action}`);
                      });
                      
                      if (params.userId || params.sessionId) {
                        this.rpcGateway.server.emit('mcp_approval', {
                          serverId,
                          requestId,
                          toolName,
                          message: uiData.props?.message || uiData.props?.description || `AI 请求执行工具: ${toolName}`,
                          args: uiData.props?.args || params,
                          userId: params.userId,
                          sessionId: params.sessionId,
                        });
                      }

                      // 强制转换为前端支持的 uiType
                      uiData.uiType = 'approval_card';
                      if (!uiData.props) uiData.props = {};
                      uiData.props.requestId = requestId;
                      uiData.props.toolName = toolName;
                      uiData.props.status = 'pending';
                    }

                    const cleanText = rawText.replace(/__UI__:.*$/, '').trim();
                    return { content: cleanText, ui: uiData };
                  } catch (parseErr) {
                    this.logger.warn(`[MCP:${serverId}] Failed to parse __UI__ marker: ${(parseErr as Error).message}`);
                  }
                }

                return { content: rawText, ui: undefined };
              } catch (err) {
                this.logger.error(`[MCP:${serverId}] Tool call failed: ${(err as Error).message}`);
                throw err;
              }
            },
          });
        }
      } catch (err) {
        this.logger.warn(`[${serverId}] Failed to list tools: ${(err as Error).message}`);
      }
    }

    this.cachedAITools = aggregated;
    this.logger.log(`Tool registry built: [${Object.keys(aggregated).join(', ')}]`);
    return aggregated;
  }

  // ──────────────────────────────────────────────
  // 公共 API：获取已连接的 MCP Server 状态
  // ──────────────────────────────────────────────
  getServerStatus(): Array<{ id: string; name: string; connected: boolean }> {
    const allConfigs: MCPServerConfig[] = [];
    const configPath = path.join(process.cwd(), 'mcp.config.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as MCPServerFileConfig;
        allConfigs.push(...raw.mcpServers);
      } catch { /* ignore */ }
    }

    return allConfigs.map((cfg) => ({
      id: cfg.id,
      name: cfg.name,
      connected: this.clients.has(cfg.id),
    }));
  }

  getConnectedServerIds(): string[] {
    return Array.from(this.clients.keys());
  }

  // ──────────────────────────────────────────────
  // MCP Resources 能力
  // ──────────────────────────────────────────────

  async listResources(): Promise<MCPResource[]> {
    const allResources: MCPResource[] = [];
    for (const [serverId, managed] of this.clients.entries()) {
      try {
        const { resources } = await managed.client.listResources();
        allResources.push(...(resources || []).map((r: any) => ({ ...r, serverId })));
      } catch (err) {
        this.logger.warn(`[${serverId}] Failed to list resources: ${(err as Error).message}`);
      }
    }
    return allResources;
  }

  async listResourceTemplates(): Promise<MCPResourceTemplate[]> {
    const allTemplates: MCPResourceTemplate[] = [];
    for (const [serverId, managed] of this.clients.entries()) {
      try {
        const { resourceTemplates } = await managed.client.listResourceTemplates();
        allTemplates.push(...(resourceTemplates || []).map((t: any) => ({ ...t, serverId })));
      } catch (err) {
        this.logger.warn(`[${serverId}] Failed to list resource templates: ${(err as Error).message}`);
      }
    }
    return allTemplates;
  }

  async readResource(uri: string, serverId?: string): Promise<MCPResourceContents | null> {
    const targetClients = serverId
      ? [[serverId, this.clients.get(serverId)].filter(Boolean) as [string, ManagedMCPClient]]
      : Array.from(this.clients.entries());

    for (const [sid, managed] of targetClients) {
      try {
        const result = await managed.client.readResource({ uri });
        const contents = result.contents?.[0];
        if (contents) return contents as MCPResourceContents;
      } catch (err) {
        this.logger.warn(`[Resource:${sid}] Failed to read resource ${uri}: ${(err as Error).message}`);
      }
    }
    return null;
  }

  // ──────────────────────────────────────────────
  // MCP Prompts 能力
  // ──────────────────────────────────────────────

  async listPrompts(): Promise<MCPPrompt[]> {
    const allPrompts: MCPPrompt[] = [];
    for (const [serverId, managed] of this.clients.entries()) {
      try {
        const { prompts } = await managed.client.listPrompts();
        allPrompts.push(...(prompts || []).map((p: any) => ({ ...p, serverId })));
      } catch (err) {
        this.logger.warn(`[${serverId}] Failed to list prompts: ${(err as Error).message}`);
      }
    }
    return allPrompts;
  }

  async getPrompt(name: string, args?: Record<string, string>, serverId?: string): Promise<GetPromptResult | null> {
    const targetClients = serverId
      ? [[serverId, this.clients.get(serverId)].filter(Boolean) as [string, ManagedMCPClient]]
      : Array.from(this.clients.entries());

    for (const [sid, managed] of targetClients) {
      try {
        const result = await managed.client.getPrompt({ name, arguments: args || {} });
        return result;
      } catch (err) {
        this.logger.debug(`[Prompt:${sid}] Prompt ${name} not found: ${(err as Error).message}`);
      }
    }
    return null;
  }

  // ──────────────────────────────────────────────
  // MCP Elicitation 能力
  // ──────────────────────────────────────────────

  registerElicitationResponseCallback(id: string, callback: (response: MCPElicitationResponse) => void): void {
    for (const managed of this.clients.values()) {
      const callbacks = managed.elicitationCallbacks || new Map();
      callbacks.set(id, callback);
      managed.elicitationCallbacks = callbacks;
    }
  }

  async submitElicitationResponse(response: MCPElicitationResponse): Promise<void> {
    for (const managed of this.clients.values()) {
      const callbacks = managed.elicitationCallbacks;
      if (callbacks?.has(response.id)) {
        const callback = callbacks.get(response.id)!;
        callbacks.delete(response.id);
        callback(response);
        return;
      }
    }
  }

  getPendingElicitations(): MCPElicitationRequest[] {
    return [];
  }

  // ──────────────────────────────────────────────
  // 动态连接管理
  // ──────────────────────────────────────────────

  async connectServer(config: MCPServerConfig): Promise<void> {
    const resolvedConfig = this.resolveServerConfig(config);
    const transportType = resolvedConfig.transport || 'stdio';

    try {
      const transport = await createTransport(resolvedConfig);

      const client = new Client(
        { name: 'uclaw-gateway', version: '1.0.0' },
        { capabilities: { sampling: {} } },
      );

      const { CreateMessageRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      // Sampling 处理
      client.setRequestHandler(
        CreateMessageRequestSchema,
        async (request) => {
          this.logger.log(`[Sampling:${resolvedConfig.id}] Received sampling request`);
          
          const { SkillOrchestrator } = await import('../skill/skill.orchestrator.js');
          const orchestrator = this.moduleRef.get(SkillOrchestrator, { strict: false });

          if (!orchestrator) throw new Error('SkillOrchestrator not available');

          const prompt = request.params.messages.map((m: any) => m.content.type === 'text' ? m.content.text : '').join('\n');
          const responseText = await orchestrator.textResponse('system-sampling', prompt, 'cli');

          return {
            role: 'assistant',
            content: { type: 'text', text: responseText },
            model: 'uclaw-gateway-integrated-model',
            stopReason: 'endTurn',
          };
        },
      );

      await client.connect(transport);
      this.clients.set(resolvedConfig.id, {
        client,
        transport,
        config: resolvedConfig,
        transportType,
        resourceCache: new Map(),
        elicitationCallbacks: new Map(),
      });

      this.cachedAITools = null;
      const { tools } = await client.listTools();
      this.logger.log(`[${resolvedConfig.id}] Connected via ${transportType}. Tools: [${tools.map((t) => t.name).join(', ')}]`);
    } catch (err) {
      this.logger.error(`[${resolvedConfig.id}] Failed to connect via ${transportType}: ${(err as Error).message}`);
      throw err;
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const managed = this.clients.get(serverId);
    if (!managed) return;

    try {
      await managed.client.close();
      this.clients.delete(serverId);
      this.cachedAITools = null;
    } catch (err) {
      this.logger.warn(`[${serverId}] Error during disconnect: ${(err as Error).message}`);
    }
  }

  async reconnectServer(serverId: string): Promise<void> {
    const managed = this.clients.get(serverId);
    if (!managed) throw new Error(`Server ${serverId} not found`);

    const config = managed.config;
    await this.disconnectServer(serverId);
    await this.connectServer(config);
  }
}
