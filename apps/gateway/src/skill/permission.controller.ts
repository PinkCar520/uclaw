import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionSettings, PermissionAction } from './permission.types';

@Controller('api/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  /**
   * GET /api/permissions/settings
   * Get current loaded permission settings.
   */
  @Get('settings')
  getSettings(@Query('workspacePath') workspacePath?: string) {
    const settings = this.permissionService.loadSettings(workspacePath);
    const rules = this.permissionService.getRules(workspacePath);

    return {
      mode: settings.mode,
      maxMcpOutputTokens: settings.maxMcpOutputTokens,
      rules: rules.map((r) => ({
        action: r.action,
        pattern: r.pattern,
        skill: r.skill,
        comment: r.comment,
      })),
    };
  }

  /**
   * GET /api/permissions/evaluate
   * Evaluate a specific tool against current rules.
   * Query params: toolName (required), workspacePath (optional)
   */
  @Get('evaluate')
  evaluateTool(@Query('toolName') toolName: string, @Query('workspacePath') workspacePath?: string) {
    if (!toolName) {
      return { error: 'toolName query parameter is required' };
    }

    const action = this.permissionService.evaluateTool(toolName, workspacePath, null);
    return {
      toolName,
      action,
      isAllowed: action === 'allow',
      isDenied: action === 'deny',
      requiresApproval: action === 'ask',
    };
  }

  /**
   * POST /api/permissions/settings
   * Save settings.json to the workspace .ocean directory.
   */
  @Post('settings')
  saveSettings(
    @Body() settings: PermissionSettings,
    @Query('workspacePath') workspacePath?: string,
  ) {
    const fs = require('fs');
    const path = require('path');

    const targetDir = workspacePath
      ? path.join(workspacePath, '.ocean')
      : path.join(process.cwd(), '.ocean');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, 'settings.json');
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');

    return { success: true, path: filePath };
  }

  /**
   * GET /api/permissions/mode
   * Get current permission mode.
   */
  @Get('mode')
  getMode(@Query('workspacePath') workspacePath?: string) {
    return { mode: this.permissionService.getMode(workspacePath) };
  }
}
