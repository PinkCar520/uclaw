import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface ImportSkillDto {
  source: 'openclaw-hub' | 'claude-code' | 'git' | 'local';
  skillId?: string;      // For openclaw-hub
  url?: string;          // For git
  skillPath?: string;    // For claude-code or local
  fileContent?: string;  // For local upload
  version?: string;      // Optional: specific version for openclaw-hub (defaults to "latest")
}

interface ParsedSkill {
  name: string;
  description: string;
  allowedTools?: string[];
  requiresApproval?: string[];
  compatibility?: string;
  icon?: string;
  tags?: string[];
  category?: string;
  source: string;
  content: string;
}

/**
 * SkillImportService
 * 
 * Handles importing skills from various external sources:
 * - OpenClaw Hub (registry)
 * - Claude Code (local skill directories)
 * - Git repositories
 * - Local file uploads
 */
@Injectable()
export class SkillImportService {
  private readonly logger = new Logger(SkillImportService.name);

  constructor(@Inject('PRISMA_CLIENT') private prisma: PrismaClient) { }

  /**
   * Main import dispatcher
   */
  async importSkill(dto: ImportSkillDto): Promise<any> {
    switch (dto.source) {
      case 'openclaw-hub':
        return this.importFromOpenClawHub(dto);
      case 'claude-code':
        return this.importFromClaudeCode(dto);
      case 'git':
        return this.importFromGit(dto);
      case 'local':
        return this.importFromLocal(dto);
      default:
        throw new Error(`Unknown import source: ${dto.source}`);
    }
  }

  /**
   * Import from OpenClaw Hub (ClawHub)
   * Uses the official ClawHub API: GET /api/v1/skills/{slug}/file?path=SKILL.md
   * Falls back to local agents/skills directory if network fails.
   */
  private async importFromOpenClawHub(dto: ImportSkillDto) {
    const skillId = dto.skillId;
    if (!skillId) {
      throw new Error('skillId is required for OpenClaw Hub import');
    }

    const version = dto.version || 'latest';
    const clawhubUrl = `https://clawhub.ai/api/v1/skills/${skillId}/file?path=SKILL.md&version=${version}`;

    let content: string;

    // Step 1: Try to fetch from ClawHub API
    try {
      this.logger.log(`Fetching skill "${skillId}" from ClawHub: ${clawhubUrl}`);
      const response = await fetch(clawhubUrl);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Skill "${skillId}" not found on ClawHub`);
        }
        throw new Error(`ClawHub API error: ${response.status} ${response.statusText}`);
      }

      content = await response.text();
      this.logger.log(`Successfully fetched "${skillId}" from ClawHub (${content.length} bytes)`);
    } catch (err: any) {
      // Step 2: Fallback to local agents/skills directory
      this.logger.warn(`ClawHub fetch failed: ${err.message}. Trying local fallback...`);

      const localPath = path.join(process.cwd(), `agents/skills/${skillId}/SKILL.md`);
      if (!fs.existsSync(localPath)) {
        throw new Error(`Skill "${skillId}" not found on ClawHub or in local registry`);
      }

      content = fs.readFileSync(localPath, 'utf-8');
      this.logger.log(`Loaded "${skillId}" from local fallback`);
    }

    const parsed = this.parseSkillMd(content, 'openclaw-hub');
    return this.saveSkill(parsed);
  }

  /**
   * Import from Claude Code skill directory
   * Expects a local path containing SKILL.md
   */
  private async importFromClaudeCode(dto: ImportSkillDto) {
    if (!dto.skillPath) {
      throw new Error('skillPath is required for Claude Code import');
    }

    const skillMdPath = dto.skillPath.endsWith('/SKILL.md')
      ? dto.skillPath
      : path.join(dto.skillPath, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`SKILL.md not found at ${skillMdPath}`);
    }

    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const parsed = this.parseSkillMd(content, 'claude-code');

    return this.saveSkill(parsed);
  }

  /**
   * Import from Git repository
   * Clones the repo, extracts SKILL.md, then cleans up
   */
  private async importFromGit(dto: ImportSkillDto) {
    if (!dto.url) {
      throw new Error('url is required for Git import');
    }

    const tempDir = path.join(process.cwd(), `.tmp/skill-import-${Date.now()}`);

    try {
      // Clone repository
      this.logger.log(`Cloning ${dto.url} to ${tempDir}`);
      execSync(`git clone --depth 1 ${dto.url} ${tempDir}`, { stdio: 'pipe' });

      // Find SKILL.md in the cloned repo
      const skillMdPath = this.findSkillMd(tempDir);
      if (!skillMdPath) {
        throw new Error('No SKILL.md found in repository');
      }

      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const parsed = this.parseSkillMd(content, 'git');
      parsed.tags = parsed.tags || [];
      parsed.tags.push('git-import');

      return this.saveSkill(parsed);
    } finally {
      // Cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  /**
   * Import from local file content (direct upload)
   */
  private async importFromLocal(dto: ImportSkillDto) {
    if (!dto.fileContent) {
      throw new Error('fileContent is required for local import');
    }

    const parsed = this.parseSkillMd(dto.fileContent, 'local');
    return this.saveSkill(parsed);
  }

  /**
   * Parse SKILL.md content (YAML frontmatter + body)
   */
  private parseSkillMd(content: string, source: string): ParsedSkill {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('Invalid SKILL.md: missing YAML frontmatter');
    }

    const yaml = require('js-yaml');
    const fm = yaml.load(frontmatterMatch[1]) as Record<string, any>;
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

    if (!fm.name || !fm.description) {
      throw new Error('Invalid SKILL.md: missing name or description in frontmatter');
    }

    return {
      name: String(fm.name),
      description: String(fm.description),
      allowedTools: fm['allowed-tools']
        ? String(fm['allowed-tools']).split(' ').filter(Boolean)
        : undefined,
      requiresApproval: fm['requires-approval']
        ? String(fm['requires-approval']).split(' ').filter(Boolean)
        : undefined,
      compatibility: fm.compatibility ? String(fm.compatibility) : undefined,
      icon: this.inferIcon(fm.name),
      tags: this.inferTags(fm),
      category: this.inferCategory(fm) || undefined,
      source,
      content: body,
    };
  }

  /**
   * Save parsed skill to database
   */
  private async saveSkill(parsed: ParsedSkill) {
    // Check for duplicate by slug
    const slug = this.toSlug(parsed.name);
    const existing = await this.prisma.skill.findUnique({ where: { slug } });

    const manifestData = {
      allowedTools: parsed.allowedTools,
      requiresApproval: parsed.requiresApproval,
      compatibility: parsed.compatibility,
    };

    if (existing) {
      // Update existing
      return this.prisma.skill.update({
        where: { id: existing.id },
        data: {
          description: parsed.description,
          content: parsed.content,
          manifest: manifestData,
          compatibility: parsed.compatibility,
          icon: parsed.icon,
          tags: parsed.tags,
          category: parsed.category,
          source: parsed.source,
          updatedAt: new Date(),
        },
      });
    }

    // Create new
    return this.prisma.skill.create({
      data: {
        slug,
        name: parsed.name,
        description: parsed.description,
        content: parsed.content,
        manifest: manifestData,
        source: parsed.source,
        icon: parsed.icon,
        tags: parsed.tags || [],
        category: parsed.category,
        isPublic: true,
        isFeatured: false,
      },
    });
  }

  /**
   * Find SKILL.md recursively in a directory
   */
  private findSkillMd(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === 'SKILL.md') {
        return fullPath;
      }
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const found = this.findSkillMd(fullPath);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Utility: Convert name to slug
   */
  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  /**
   * Utility: Infer icon from name
   */
  private inferIcon(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('bug') || lower.includes('fix')) return 'CheckCircle2';
    if (lower.includes('jenkins') || lower.includes('build')) return 'Rocket';
    if (lower.includes('git') || lower.includes('pr')) return 'GitPullRequest';
    if (lower.includes('chat') || lower.includes('message')) return 'MessageSquare';
    if (lower.includes('docker')) return 'Box';
    if (lower.includes('mail') || lower.includes('email')) return 'Mail';
    return 'Star';
  }

  /**
   * Utility: Infer tags from frontmatter
   */
  private inferTags(fm: Record<string, any>): string[] {
    const tags: string[] = [];
    if (fm.compatibility) {
      const comps = String(fm.compatibility).toLowerCase();
      if (comps.includes('zentao')) tags.push('zentao');
      if (comps.includes('gitlab')) tags.push('gitlab');
      if (comps.includes('jenkins')) tags.push('jenkins');
      if (comps.includes('docker')) tags.push('docker');
    }
    return [...new Set(tags)];
  }

  /**
   * Utility: Infer category from frontmatter
   */
  private inferCategory(fm: Record<string, any>): string | null {
    const name = (fm.name || '').toLowerCase();
    const comp = (fm.compatibility || '').toLowerCase();
    const target = (fm.metadata?.target_system || '').toLowerCase();

    const combined = `${name} ${comp} ${target}`;

    if (combined.includes('zentao') || combined.includes('bug') || combined.includes('prd')) {
      return 'pm';
    }
    if (combined.includes('jenkins') || combined.includes('ci') || combined.includes('docker')) {
      return 'cicd';
    }
    if (combined.includes('git') || combined.includes('merge') || combined.includes('pr')) {
      return 'vc';
    }
    if (combined.includes('slack') || combined.includes('mail') || combined.includes('chat')) {
      return 'communication';
    }

    return null;
  }
}
