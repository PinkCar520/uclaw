import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * AgentSkills-compatible Skill entry
 * https://agentskills.io/specification
 */
export interface SkillEntry {
  /** Skill name (from frontmatter) */
  name: string;
  /** Skill description — used by LLM for discovery */
  description: string;
  /** Absolute path to the SKILL.md file */
  skillMdPath: string;
  /** Skill directory (parent of SKILL.md) */
  skillDir: string;
  /** Space-delimited list of pre-approved tools (experimental) */
  allowedTools?: string[];
  /** List of tools that require user approval before execution */
  requiresApproval?: string[];
  metadata?: Record<string, string>;
  compatibility?: string;
  /** Localized mapping overrides for the frontend UI (e.g. { zh: { displayName: "..." } }) */
  locales?: Record<string, { displayName?: string; description?: string }>;
}

/**
 * SkillLoader
 *
 * Implements the AgentSkills client-side 5-step protocol:
 *   1. Discovery  — scan filesystem for SKILL.md directories
 *   2. Parse      — extract frontmatter (name + description)
 *   3. Disclose   — build <available_skills> XML catalog (Tier 1, ~100 tokens)
 *   4. Activate   — return full SKILL.md body wrapped in <skill_content> (Tier 2)
 *   5. Manage     — dedup, protect from context compaction (caller responsibility)
 *
 * Also loads .AIGUIDE.md (team conventions, always-on global guide).
 *
 * Spec: https://agentskills.io/client-implementation/adding-skills-support
 */
@Injectable()
export class SkillLoader {
  private readonly logger = new Logger(SkillLoader.name);

  /** Cache: skillName → SkillEntry */
  private catalog = new Map<string, SkillEntry>();

  /** Cache: dir → .AIGUIDE.md content */
  private readonly aiguideCache = new Map<string, { content: string; loadedAt: number }>();
  private readonly AIGUIDE_CACHE_TTL_MS = 60_000;

  /** Whether discovery has been run */
  private discovered = false;

  // ──────────────────────────────────────────────
  // Step 1 + 2: Discovery & Parse
  // ──────────────────────────────────────────────

  /**
   * Scan one or more directories for AgentSkills-compliant skill directories.
   * Each valid skill directory contains a SKILL.md with frontmatter name + description.
   *
   * Scan order (last wins on name collision):
   *   1. Built-in skills (bundled with gateway)
   *   2. User-installed skills (~/.ocean/skills) — reserved for OceanHub
   */
  async discover(dirs?: string[]): Promise<SkillEntry[]> {
    const scanDirs = dirs ?? this.getDefaultScanDirs();
    this.catalog.clear();

    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) {
        this.logger.debug(`Skills directory not found, skipping: ${dir}`);
        continue;
      }
      await this.scanDir(dir);
    }

    this.discovered = true;
    this.logger.log(`Skills discovery complete. Found: [${[...this.catalog.keys()].join(', ')}]`);
    return [...this.catalog.values()];
  }

  /** Retrieve all skills from memory cache. Discovers if not yet initialized. */
  async getAllSkills(): Promise<SkillEntry[]> {
    if (!this.discovered) {
      await this.discover();
    }
    return [...this.catalog.values()];
  }

  /** Get a single skill by name from cache. Returns null if not found. */
  getSkill(name: string): SkillEntry | null {
    return this.catalog.get(name) ?? null;
  }

  private getDefaultScanDirs(): string[] {
    const dirs: string[] = [];

    // 1. Built-in skills from the @ocean/skills package
    // We try to resolve the package directory. If it fails, we fall back to a relative path
    // that is standard for our new monorepo layout.
    try {
      // Use require.resolve to find the package entry, then get the directory
      const skillsPkgPath = require.resolve('@ocean/skills/package.json');
      const skillsDir = path.dirname(skillsPkgPath);
      dirs.push(skillsDir);
      this.logger.log(`Scanning built-in skills from package: ${skillsDir}`);
    } catch (e) {
      // Monorepo specific: search upwards from process.cwd() for agent/skills
      let current = process.cwd();
      for (let i = 0; i < 4; i++) { // Max 4 levels up
        const potential = path.resolve(current, 'agent/skills');
        if (fs.existsSync(potential)) {
          dirs.push(potential);
          this.logger.debug(`Found built-in skills in monorepo layout: ${potential}`);
          break;
        }
        current = path.dirname(current);
      }
    }

    // 2. Enterprise-level skill injection via Environment Variable
    const envSkillsPath = process.env.AGP_SKILLS_PATH;
    if (envSkillsPath) {
      const paths = envSkillsPath.split(path.delimiter).filter(Boolean);
      dirs.push(...paths);
      this.logger.log(`Scanning external skills from AGP_SKILLS_PATH: ${paths.join(', ')}`);
    }

    // 3. User-installed via OceanHub (~/.ocean/skills)
    const userHome = process.env.HOME || process.env.USERPROFILE || '';
    if (userHome) {
      const userSkillsDir = path.join(userHome, '.ocean', 'skills');
      dirs.push(userSkillsDir);
    }

    return [...new Set(dirs)]; // Dedup
  }

  private async scanDir(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Skip common non-skill dirs
      if (['.git', 'node_modules', '.cache'].includes(entry.name)) continue;

      const skillDir = path.join(dir, entry.name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      if (!fs.existsSync(skillMdPath)) continue;

      const parsed = this.parseSkillMd(skillMdPath);
      if (!parsed) continue;

      // Lenient validation per spec: warn on name mismatch but load anyway
      if (parsed.name !== entry.name) {
        this.logger.warn(
          `Skill name mismatch: directory "${entry.name}" vs frontmatter name "${parsed.name}". Loading anyway.`,
        );
      }

      this.catalog.set(parsed.name, { ...parsed, skillDir, skillMdPath });
    }
  }

  private parseSkillMd(skillMdPath: string): Omit<SkillEntry, 'skillDir' | 'skillMdPath'> | null {
    let raw: string;
    try {
      raw = fs.readFileSync(skillMdPath, 'utf-8');
    } catch {
      this.logger.error(`Failed to read ${skillMdPath}`);
      return null;
    }

    // Extract YAML frontmatter between opening and closing ---
    const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) {
      this.logger.warn(`No frontmatter found in ${skillMdPath}, skipping.`);
      return null;
    }

    let fm: Record<string, any>;
    try {
      fm = (yaml.load(frontmatterMatch[1]) as Record<string, any>) || {};
    } catch (e: any) {
      this.logger.error(`Failed to parse YAML frontmatter in ${skillMdPath}: ${e.message}`);
      return null;
    }

    const name = fm['name'];
    const description = fm['description'];

    // Per spec: skip if description is missing
    if (!name || !description) {
      this.logger.error(`Missing required frontmatter fields (name/description) in ${skillMdPath}`);
      return null;
    }

    return {
      name: String(name),
      description: String(description),
      allowedTools: fm['allowed-tools']
        ? String(fm['allowed-tools'])
            .split(' ')
            .filter(Boolean)
        : undefined,
      requiresApproval: fm['requires-approval']
        ? String(fm['requires-approval'])
            .split(' ')
            .filter(Boolean)
        : undefined,
      compatibility: fm['compatibility'] ? String(fm['compatibility']) : undefined,
      metadata: fm['metadata'] ? (fm['metadata'] as Record<string, string>) : undefined,
      locales: fm['locales'] ? (fm['locales'] as Record<string, { displayName?: string; description?: string }>) : undefined,
    };
  }

  // ──────────────────────────────────────────────
  // Step 3: Disclose — Tier 1 catalog XML
  // ──────────────────────────────────────────────

  /**
   * Build the <available_skills> XML catalog to inject into System Prompt (Tier 1).
   * Includes name, description, allowed tools count, and trigger keywords.
   * ~100-200 tokens total for 10 skills.
   *
   * Per spec behavioral instruction prepended so LLM knows how to activate:
   * "When a task matches a skill's description, call the activate_skill tool."
   */
  async buildCatalogXml(): Promise<string> {
    if (!this.discovered) {
      await this.discover();
    }

    if (this.catalog.size === 0) {
      return '<available_skills/>';
    }

    const items = [...this.catalog.values()]
      .map((s) => {
        const allowedToolsCount = s.allowedTools?.length || 0;
        const requiresApprovalCount = s.requiresApproval?.length || 0;
        const compatibility = s.compatibility ? `\\n    <compatibility>${escapeXml(s.compatibility)}</compatibility>` : '';
        const localesXml = s.locales
          ? `\\n    <locales>${Object.entries(s.locales)
              .map(([lang, loc]) => `<locale lang="${lang}"><displayName>${escapeXml(loc.displayName || '')}</displayName><description>${escapeXml(loc.description || '')}</description></locale>`)
              .join('\\n      ')}</locales>`
          : '';

        return `  <skill>
    <name>${s.name}</name>
    <description>${escapeXml(s.description)}</description>
    <allowed_tools_count>${allowedToolsCount}</allowed_tools_count>
    <requires_approval_count>${requiresApprovalCount}</requires_approval_count>${compatibility}${localesXml}
  </skill>`;
      })
      .join('\n');

    return `<available_skills>\n${items}\n</available_skills>`;
  }

  // ──────────────────────────────────────────────
  // Step 4: Activate — Tier 2 full SKILL.md body
  // ──────────────────────────────────────────────

  /**
   * Load and return the full SKILL.md body wrapped in <skill_content> XML.
   * Called when the LLM decides to activate a skill (via activate_skill tool).
   *
   * Returns null if skill not found.
   */
  async activate(skillName: string): Promise<string | null> {
    if (!this.discovered) {
      await this.discover();
    }

    const entry = this.catalog.get(skillName);
    if (!entry) {
      this.logger.warn(`activate_skill called for unknown skill: "${skillName}"`);
      return null;
    }

    let raw: string;
    try {
      raw = fs.readFileSync(entry.skillMdPath, 'utf-8');
    } catch {
      this.logger.error(`Failed to read skill file: ${entry.skillMdPath}`);
      return null;
    }

    // Strip frontmatter, keep body content only
    const body = raw.replace(/^---[\s\S]*?---\r?\n/, '').trim();

    // List bundled resource files (references/, scripts/, assets/)
    const resources = this.listResources(entry.skillDir);
    const resourcesXml =
      resources.length > 0
        ? `\n<skill_resources>\n${resources.map((f) => `  <file>${f}</file>`).join('\n')}\n</skill_resources>`
        : '';

    this.logger.log(`Skill activated: "${skillName}" (${body.length} chars)`);

    return (
      `<skill_content name="${skillName}">\n` +
      `${body}\n\n` +
      `Skill directory: ${entry.skillDir}\n` +
      `Relative paths in this skill are relative to the skill directory.` +
      `${resourcesXml}\n` +
      `</skill_content>`
    );
  }

  /** Get allowed tools for a skill (for Gateway-level permission enforcement) */
  getAllowedTools(skillName: string): string[] {
    return this.catalog.get(skillName)?.allowedTools ?? [];
  }

  /** Get tools requiring approval for a skill */
  getRequiresApproval(skillName: string): string[] {
    return this.catalog.get(skillName)?.requiresApproval ?? [];
  }

  private listResources(skillDir: string): string[] {
    const resourceDirs = ['references', 'scripts', 'assets'];
    const found: string[] = [];

    for (const subDir of resourceDirs) {
      const full = path.join(skillDir, subDir);
      if (!fs.existsSync(full)) continue;
      try {
        const files = fs.readdirSync(full).filter((f) => !f.startsWith('.'));
        found.push(...files.map((f) => `${subDir}/${f}`));
      } catch {
        // ignore
      }
    }

    return found;
  }

  // ──────────────────────────────────────────────
  // .AIGUIDE.md — team conventions (always-on)
  // ──────────────────────────────────────────────

  /**
   * Load .AIGUIDE.md from workspace root.
   * This is a Ocean-specific team convention file, always injected (not skill-specific).
   *
   * Search order:
   *   1. workspacePath (from request context)
   *   2. process.cwd()
   *   3. monorepo root (2 levels up from __dirname)
   */
  async loadAiguide(workspacePath?: string): Promise<string | null> {
    const searchPaths = [
      workspacePath,
      process.cwd(),
      path.resolve(__dirname, '../../../../'),
    ].filter(Boolean) as string[];

    for (const dir of searchPaths) {
      const result = this.tryLoadAiguide(dir);
      if (result) return result;
    }

    this.logger.debug('.AIGUIDE.md not found in any search path');
    return null;
  }

  private tryLoadAiguide(dir: string): string | null {
    const filePath = path.join(dir, '.AIGUIDE.md');

    const cached = this.aiguideCache.get(filePath);
    if (cached && Date.now() - cached.loadedAt < this.AIGUIDE_CACHE_TTL_MS) {
      return cached.content;
    }

    try {
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      this.aiguideCache.set(filePath, { content, loadedAt: Date.now() });
      this.logger.log(`.AIGUIDE.md loaded from: ${filePath} (${content.length} chars)`);
      return content;
    } catch {
      return null;
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
