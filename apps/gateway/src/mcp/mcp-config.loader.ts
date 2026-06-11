import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * MCP Server configuration entry
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  description?: string;
  transport?: 'stdio' | 'http' | 'sse';
}

/**
 * MCP Config file structure
 */
export interface MCPConfigFile {
  mcpServers: MCPServerConfig[];
}

/**
 * Multi-layer MCP Configuration Loader
 *
 * Supports 3 configuration layers (Claude Code compatible):
 *   1. Local (cwd/.mcp.json or cwd/.claude/mcp.json) - highest priority
 *   2. Project (.mcp.json in workspace root, git-tracked) - medium priority
 *   3. User (~/.ocean/mcp.json) - lowest priority
 *
 * Layers are merged with later overriding earlier.
 * Environment variables in args/env are expanded.
 */
@Injectable()
export class MCPConfigLoader {
  private readonly logger = new Logger(MCPConfigLoader.name);

  /**
   * Load and merge MCP configs from all layers.
   * Returns merged config with higher priority layers overriding lower ones.
   */
  loadConfig(workspacePath?: string): MCPConfigFile {
    const layers: MCPConfigFile[] = [];

    // Layer 1: User-level (~/.ocean/mcp.json) - lowest priority
    const userHome = process.env.HOME || process.env.USERPROFILE || '';
    if (userHome) {
      const userConfig = this.tryLoadJson(path.join(userHome, '.ocean', 'mcp.json'));
      if (userConfig) {
        this.logger.debug(`Loaded user MCP config from: ~/.ocean/mcp.json`);
        layers.unshift(userConfig);
      }
    }

    // Layer 2: Project-level (.mcp.json or .claude/mcp.json in workspace)
    if (workspacePath) {
      const projectConfig = this.tryLoadJson(path.join(workspacePath, '.mcp.json'))
        || this.tryLoadJson(path.join(workspacePath, '.claude', 'mcp.json'));
      if (projectConfig) {
        this.logger.debug(`Loaded project MCP config from workspace`);
        layers.unshift(projectConfig);
      }
    }

    // Layer 3: Local-level (cwd/.mcp.json or cwd/.claude/mcp.json) - highest priority
    const localConfig = this.tryLoadJson(path.join(process.cwd(), '.mcp.json'))
      || this.tryLoadJson(path.join(process.cwd(), '.claude', 'mcp.json'));
    if (localConfig) {
      this.logger.debug(`Loaded local MCP config from cwd`);
      layers.unshift(localConfig);
    }

    // Layer 4: Built-in config (mcp.config.json in gateway) - fallback
    const gatewayRoot = process.env.GATEWAY_ROOT || process.cwd();
    const builtinConfig = this.tryLoadJson(path.join(gatewayRoot, 'mcp.config.json'));
    if (builtinConfig) {
      this.logger.debug(`Loaded built-in MCP config from gateway`);
      layers.unshift(builtinConfig);
    }

    // Merge layers (later overrides earlier)
    let merged: MCPConfigFile = { mcpServers: [] };
    const serverMap = new Map<string, MCPServerConfig>();

    for (const layer of layers) {
      for (const server of layer.mcpServers || []) {
        serverMap.set(server.id, server);
      }
    }

    merged.mcpServers = [...serverMap.values()];

    // Expand environment variables
    merged.mcpServers = merged.mcpServers.map((srv) => this.expandEnvVars(srv));

    this.logger.log(
      `MCP config loaded. Servers: ${merged.mcpServers.length}, Enabled: ${merged.mcpServers.filter((s) => s.enabled).length}`,
    );
    return merged;
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private tryLoadJson(filePath: string): MCPConfigFile | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as MCPConfigFile;
    } catch {
      return null;
    }
  }

  /**
   * Expand environment variables in args and env.
   * Supports ${VAR} and ${VAR:-default} syntax.
   */
  private expandEnvVars(config: MCPServerConfig): MCPServerConfig {
    const expand = (value: string): string => {
      return value.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
        const [varName, defaultValue] = expr.split(':-');
        return process.env[varName] || defaultValue || '';
      });
    };

    return {
      ...config,
      args: (config.args || []).map(expand),
      env: config.env
        ? Object.fromEntries(Object.entries(config.env).map(([k, v]) => [k, expand(v)]))
        : {},
    };
  }
}
