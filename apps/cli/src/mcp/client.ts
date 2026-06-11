import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CliConfig } from '../types.js';

interface McpServerEntry {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

interface McpConfigFile {
  mcpServers: McpServerEntry[];
}

/**
 * MCP Client Manager for CLI
 * Discovers and connects to MCP servers, exposes tools to AI
 */
export class McpClientManager {
  private clients = new Map<string, Client>();
  private config: McpConfigFile | null = null;

  constructor(private cliConfig: CliConfig) {}

  /**
   * Load MCP config from config file
   */
  async loadConfig(configPath?: string) {
    const oceanRoot = findUclawRoot(process.cwd());
    const pathsToTry = [
      configPath,
      path.join(process.cwd(), '.mcp.json'),
      path.join(process.cwd(), '.claude', 'mcp.json'),
      path.join(process.cwd(), '.ocean', 'mcp.json'),
      oceanRoot ? path.join(oceanRoot, '.ocean', 'mcp.json') : null,
      // Fallback to gateway mcp.config.json
      path.resolve(process.cwd(), 'apps/gateway/mcp.config.json'),
    ].filter(Boolean) as string[];

    for (const p of pathsToTry) {
      if (fs.existsSync(p!)) {
        const raw = fs.readFileSync(p!, 'utf-8');
        this.config = JSON.parse(raw);
        // Resolve ${OCEAN_ROOT} in paths
        if (oceanRoot && this.config) {
          this.config.mcpServers = this.config.mcpServers.map((s: McpServerEntry) => ({
            ...s,
            args: s.args.map(a => a.replace(/\$\{OCEAN_ROOT\}/g, oceanRoot)),
          }));
        }
        console.log(`[MCP] Loaded config from: ${p}`);
        return;
      }
    }

    console.log('[MCP] No config file found, using defaults');
    this.config = { mcpServers: [] };
  }

  /**
   * Connect to all enabled MCP servers
   */
  async connectAll() {
    if (!this.config) {
      await this.loadConfig();
    }

    const servers = this.config!.mcpServers.filter(s => s.enabled !== false);
    
    for (const server of servers) {
      try {
        await this.connectServer(server);
      } catch (err: any) {
        console.warn(`[MCP] Failed to connect to ${server.name}: ${err.message}`);
      }
    }
  }

  /**
   * Connect to a single MCP server
   */
  private async connectServer(server: McpServerEntry) {
    const resolvedArgs = server.args.map(arg => 
      replaceEnvVars(arg, process.env)
    );

    const resolvedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(server.env || {})) {
      resolvedEnv[key] = replaceEnvVars(value, process.env);
    }

    const transport = new StdioClientTransport({
      command: replaceEnvVars(server.command, process.env),
      args: resolvedArgs,
      env: resolvedEnv,
    });

    const client = new Client(
      { name: `ocean-cli-mcp-${server.id}`, version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(server.id, client);
    
    const tools = await client.listTools();
    console.log(`[MCP] Connected to ${server.name}: ${tools.tools.length} tools`);
  }

  /**
   * Get all tools from all connected MCP servers
   */
  async getAllTools() {
    const tools: Array<{ name: string; description: string; server: string }> = [];
    
    for (const [serverId, client] of this.clients) {
      try {
        const result = await client.listTools();
        for (const tool of result.tools) {
          const toolName = tool.name;
          if (!toolName) continue;
          tools.push({
            name: `mcp__${serverId}__${toolName}`,
            description: tool.description || '',
            server: serverId,
          });
        }
      } catch {
        // ignore
      }
    }

    return tools;
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(toolName: string, args: Record<string, any>) {
    // Parse tool name: mcp__serverId__toolName
    const parts = toolName.split('__');
    if (parts.length !== 3 || parts[0] !== 'mcp') {
      throw new Error(`Invalid MCP tool name: ${toolName}. Expected format: mcp__serverId__toolName`);
    }

    const [, serverId, tool] = parts;
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server not connected: ${serverId}`);
    }

    const result = await client.callTool({
      name: tool,
      arguments: args,
    });

    return result;
  }

  /**
   * Disconnect all MCP servers
   */
  async disconnectAll() {
    const serverIds = Array.from(this.clients.keys());

    for (const [serverId, client] of this.clients) {
      try {
        await client.close();
      } catch (err: any) {
        // ignore
      }
    }
    this.clients.clear();

    // Force unref any lingering ChildProcess handles from the MCP SDK.
    // The SDK's close() doesn't always properly unref the underlying process,
    // causing Node.js to keep the event loop alive.
    setImmediate(() => {
      const handles = (process as any)._getActiveHandles?.() || [];
      for (const h of handles) {
        if (h && typeof h.unref === 'function' && h.spawnfile) {
          // This is a dead or lingering ChildProcess — unref it
          h.unref();
        }
      }
    });
  }
}

function replaceEnvVars(str: string, env: NodeJS.ProcessEnv): string {
  return str.replace(/\$\{(\w+)\}/g, (_, key) => env[key] || '');
}

/**
 * Find the Ocean project root by walking up the directory tree
 */
function findUclawRoot(startDir: string): string | null {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml')) && fs.existsSync(path.join(current, 'agent'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
