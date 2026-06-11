import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  PermissionSettings,
  PermissionAction,
  PermissionMode,
  NormalizedRule,
  normalizeRules,
  evaluateTool,
} from './permission.types';

/**
 * Default settings when no settings.json is found.
 * Matches Claude Code's 'default' mode behavior.
 */
const DEFAULT_SETTINGS: PermissionSettings = {
  mode: 'default',
  maxMcpOutputTokens: 25_000,
};

/**
 * PermissionService
 *
 * Loads and evaluates permission rules from settings.json files.
 * Supports 3-layer configuration (Claude Code compatible):
 *   1. Local (workspace/.claude/settings.json) - highest priority
 *   2. Project (.claude/settings.json in git) - medium priority
 *   3. User (~/.ocean/settings.json) - lowest priority
 *
 * Rules are evaluated top-down, first match wins.
 * Supports wildcard patterns: `mcp__zentao:*`, `Bash(git:*)`, `Edit(src/**)`
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  /** Cached merged settings */
  private cachedSettings: PermissionSettings | null = null;
  private cachedRules: NormalizedRule[] | null = null;
  private lastLoadTime = 0;
  private readonly CACHE_TTL_MS = 5_000; // 5 second cache

  /**
   * Load and merge settings from all layers.
   * Returns merged settings with higher priority layers overriding lower ones.
   */
  loadSettings(workspacePath?: string): PermissionSettings {
    const now = Date.now();
    if (this.cachedSettings && now - this.lastLoadTime < this.CACHE_TTL_MS) {
      return this.cachedSettings;
    }

    const layers: PermissionSettings[] = [];

    // Layer 1: User-level (~/.ocean/settings.json) - lowest priority
    const userHome = process.env.HOME || process.env.USERPROFILE || '';
    if (userHome) {
      const userSettings = this.tryLoadJson(path.join(userHome, '.ocean', 'settings.json'));
      if (userSettings) {
        this.logger.debug(`Loaded user settings from: ~/.ocean/settings.json`);
        layers.unshift(userSettings);
      }
    }

    // Layer 2: Project-level (.claude/settings.json or .ocean/settings.json in workspace)
    if (workspacePath) {
      const projectSettings = this.tryLoadJson(path.join(workspacePath, '.claude', 'settings.json'))
        || this.tryLoadJson(path.join(workspacePath, '.ocean', 'settings.json'));
      if (projectSettings) {
        this.logger.debug(`Loaded project settings from workspace`);
        layers.unshift(projectSettings);
      }
    }

    // Layer 3: Local-level (cwd/.claude/settings.json) - highest priority
    const localSettings = this.tryLoadJson(path.join(process.cwd(), '.claude', 'settings.json'))
      || this.tryLoadJson(path.join(process.cwd(), '.ocean', 'settings.json'));
    if (localSettings) {
      this.logger.debug(`Loaded local settings from cwd`);
      layers.unshift(localSettings);
    }

    // Merge layers (later overrides earlier)
    let merged: PermissionSettings = { ...DEFAULT_SETTINGS };
    for (const layer of layers) {
      merged = this.mergeSettings(merged, layer);
    }

    // Normalize rules for efficient evaluation
    this.cachedRules = normalizeRules(merged);
    this.cachedSettings = merged;
    this.lastLoadTime = now;

    this.logger.log(
      `Permission settings loaded. Mode: ${merged.mode}, Rules: ${this.cachedRules.length}`,
    );
    return merged;
  }

  /**
   * Evaluate a tool against loaded rules.
   * Returns the permission action for the tool.
   */
  evaluateTool(
    toolName: string,
    workspacePath?: string,
    args?: any,
  ): PermissionAction {
    if (!this.cachedRules) {
      this.loadSettings(workspacePath);
    }
    return evaluateTool(toolName, this.cachedRules!, args);
  }

  /**
   * Check if a tool should be auto-allowed (no approval needed).
   */
  isAutoAllowed(toolName: string, workspacePath?: string, args?: any): boolean {
    const action = this.evaluateTool(toolName, workspacePath, args);
    return action === 'allow' || this.getMode() === 'bypassPermissions';
  }

  /**
   * Check if a tool is explicitly denied.
   */
  isDenied(toolName: string, workspacePath?: string, args?: any): boolean {
    const action = this.evaluateTool(toolName, workspacePath, args);
    return action === 'deny';
  }

  /**
   * Check if a tool requires user approval.
   */
  requiresApproval(toolName: string, workspacePath?: string, args?: any): boolean {
    const action = this.evaluateTool(toolName, workspacePath, args);
    return action === 'ask';
  }

  /**
   * Get current permission mode.
   */
  getMode(workspacePath?: string): PermissionMode {
    if (!this.cachedSettings) {
      this.loadSettings(workspacePath);
    }
    return this.cachedSettings?.mode ?? 'default';
  }

  /**
   * Get max MCP output tokens setting.
   */
  getMaxMcpOutputTokens(workspacePath?: string): number {
    if (!this.cachedSettings) {
      this.loadSettings(workspacePath);
    }
    return this.cachedSettings?.maxMcpOutputTokens ?? 25_000;
  }

  /**
   * Get the raw rules for inspection/debugging.
   */
  getRules(workspacePath?: string): NormalizedRule[] {
    if (!this.cachedRules) {
      this.loadSettings(workspacePath);
    }
    return this.cachedRules || [];
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private tryLoadJson(filePath: string): PermissionSettings | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as PermissionSettings;
    } catch {
      return null;
    }
  }

  /**
   * Merge two settings objects. Source overrides target.
   */
  private mergeSettings(
    target: PermissionSettings,
    source: PermissionSettings,
  ): PermissionSettings {
    return {
      ...target,
      ...source,
      // Merge rule arrays (source rules come after target for precedence)
      rules: [...(target.rules || []), ...(source.rules || [])],
      allow: [...(target.allow || []), ...(source.allow || [])],
      deny: [...(target.deny || []), ...(source.deny || [])],
      ask: [...(target.ask || []), ...(source.ask || [])],
      // Deep merge MCP server settings
      mcp: {
        servers: {
          ...(target.mcp?.servers || {}),
          ...(source.mcp?.servers || {}),
        },
      },
    };
  }
}
