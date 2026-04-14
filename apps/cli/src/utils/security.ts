import * as path from 'node:path';
import { CONFIG } from './config.js';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'DANGEROUS';

export interface SecurityAuditResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  reason?: string;
  suggestion?: string;
}

/**
 * Mature Security Engine - Inspired by Claude Code
 * Responsible for path validation and command auditing.
 */
export class SecurityEngine {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  /**
   * Validates if a path is within the workspace boundary.
   * Prevents path traversal attacks.
   */
  public validatePath(targetPath: string): { isValid: boolean; resolvedPath: string } {
    const absolutePath = path.resolve(this.workspaceRoot, targetPath);
    const isValid = absolutePath.startsWith(this.workspaceRoot);
    return {
      isValid,
      resolvedPath: absolutePath
    };
  }

  /**
   * Audits a shell command for dangerous patterns.
   */
  public auditCommand(command: string): SecurityAuditResult {
    const cmd = command.trim().toLowerCase();

    // 1. Dangerous Commands (Strict Block)
    const dangerousPatterns = [
      /rm\s+-[rf].*\//,           // rm -rf /
      />\s*\/dev\/sd/,            // Overwriting disk devices
      /mkfs/,                     // Formatting
      /dd\s+if=/,                 // Low-level disk ops
      /chmod\s+777/,              // Insecure permissions
      /chown/,                    // Ownership change
      /visudo/,                   // Sudoers edit
      /passwd/,                   // Password change
      /\.ssh\//,                  // Accessing SSH keys
      /\.env/                     // Accessing secrets
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(cmd)) {
        return {
          allowed: false,
          riskLevel: 'DANGEROUS',
          reason: 'Command contains dangerous patterns targeting system files or disk devices.',
          suggestion: 'Refactor the command to only target project-specific files.'
        };
      }
    }

    // 2. High Risk (Requires explicit confirmation)
    const highRiskPatterns = [
      /^rm\s+/,                   // Any deletion
      /^git\s+push/,              // Pushing code
      /^npm\s+publish/,           // Publishing
      /^curl\s+.*\|\s*bash/,      // Piping web scripts to bash
      /set\s+.*=/,                // Setting env vars
    ];

    for (const pattern of highRiskPatterns) {
      if (pattern.test(cmd)) {
        return {
          allowed: true, // Still allowed but high risk
          riskLevel: 'HIGH',
          reason: 'This command can modify or delete critical resources.'
        };
      }
    }

    // 3. Medium Risk (Structural changes)
    if (cmd.startsWith('git ') || cmd.startsWith('npm ') || cmd.startsWith('pnpm ')) {
      return { allowed: true, riskLevel: 'MEDIUM' };
    }

    // 4. Low Risk (Read-only)
    return { allowed: true, riskLevel: 'LOW' };
  }
}

export const security = new SecurityEngine();
