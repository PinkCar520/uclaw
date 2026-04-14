// Core tool implementations

import { z } from 'zod';
import type { ToolContext, ToolResult } from '../types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { glob as globFn } from 'glob';
import { readFileSync } from 'node:fs';

const execAsync = promisify(exec);

// ─── Bash Tool ────────────────────────────────────────────────

const DANGEROUS_COMMANDS = [
  /^rm\s+(-rf?|--force)\s/i,
  /^sudo\s/i,
  /^\>\s*\/etc/,
  /mkfs/,
  /dd\s+if=.*of=/,
];

export function createBashTool() {
  return {
    name: 'bash',
    description: 'Execute shell commands in a sandboxed environment. Supports git, npm, pnpm, node, and standard Unix utilities.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute'),
      cwd: z.string().optional().describe('Working directory (defaults to context cwd)'),
    }),
    async execute(input: { command: string; cwd?: string }, ctx: ToolContext): Promise<ToolResult> {
      const workDir = input.cwd || ctx.cwd;
      
      // Security check
      for (const pattern of DANGEROUS_COMMANDS) {
        if (pattern.test(input.command)) {
          return {
            data: null,
            error: `Command blocked: "${input.command}" matches dangerous pattern`,
            ui: {
              uiType: 'code_block',
              props: {
                command: input.command,
                output: '⚠ Command blocked by security filter',
                status: 'error' as const,
                language: 'bash',
              },
            },
          };
        }
      }

      try {
        const { stdout, stderr } = await execAsync(input.command, {
          cwd: workDir,
          timeout: 120000, // 2 min timeout
          maxBuffer: 1024 * 1024 * 5, // 5MB
        });
        
        const output = stderr ? `${stdout}\n[stderr]\n${stderr}` : stdout;
        
        return {
          data: { stdout, stderr },
          ui: {
            uiType: 'code_block',
            props: {
              command: input.command,
              output: output.trim(),
              status: stderr ? 'warning' as const : 'success' as const,
              language: 'bash',
            },
          },
        };
      } catch (err: any) {
        return {
          data: null,
          error: err.message,
          ui: {
            uiType: 'code_block',
            props: {
              command: input.command,
              output: err.message,
              status: 'error' as const,
              language: 'bash',
            },
          },
        };
      }
    },
  };
}

// ─── File Read Tool ───────────────────────────────────────────

export function createFileReadTool() {
  return {
    name: 'file_read',
    description: 'Read the contents of a file. Supports text and binary files. Can read specific line ranges.',
    inputSchema: z.object({
      path: z.string().describe('Absolute or relative path to the file'),
      offset: z.number().optional().describe('Starting line number (0-based, for text files)'),
      limit: z.number().optional().describe('Maximum number of lines to read'),
    }),
    async execute(input: { path: string; offset?: number; limit?: number }, ctx: ToolContext): Promise<ToolResult> {
      const filePath = path.isAbsolute(input.path) 
        ? input.path 
        : path.join(ctx.cwd, input.path);

      try {
        let content: string;
        
        if (input.offset !== undefined || input.limit !== undefined) {
          const allLines = readFileSync(filePath, 'utf-8').split('\n');
          const start = input.offset ?? 0;
          const end = input.limit ? start + input.limit : allLines.length;
          content = allLines.slice(start, end).join('\n');
        } else {
          content = await fs.readFile(filePath, 'utf-8');
        }

        return {
          data: { content, path: filePath },
          ui: {
            uiType: 'file_preview',
            props: {
              path: filePath,
              content,
              status: 'success' as const,
            },
          },
        };
      } catch (err: any) {
        return {
          data: null,
          error: err.message,
          ui: {
            uiType: 'file_preview',
            props: {
              path: filePath,
              content: '',
              status: 'error' as const,
              error: err.message,
            },
          },
        };
      }
    },
  };
}

// ─── File Write Tool ──────────────────────────────────────────

export function createFileWriteTool() {
  return {
    name: 'file_write',
    description: 'Create a new file or overwrite an existing file. Use with caution as this will overwrite without warning.',
    inputSchema: z.object({
      path: z.string().describe('Absolute or relative path to the file'),
      content: z.string().describe('Content to write'),
    }),
    async execute(input: { path: string; content: string }, ctx: ToolContext): Promise<ToolResult> {
      const filePath = path.isAbsolute(input.path)
        ? input.path
        : path.join(ctx.cwd, input.path);

      try {
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        await fs.writeFile(filePath, input.content, 'utf-8');
        
        return {
          data: { path: filePath, bytesWritten: input.content.length },
          ui: {
            uiType: 'file_preview',
            props: {
              path: filePath,
              content: input.content,
              status: 'success' as const,
              action: 'created' as const,
            },
          },
        };
      } catch (err: any) {
        return {
          data: null,
          error: err.message,
          ui: {
            uiType: 'file_preview',
            props: {
              path: filePath,
              content: '',
              status: 'error' as const,
              error: err.message,
            },
          },
        };
      }
    },
  };
}

// ─── File Edit Tool ───────────────────────────────────────────

export function createFileEditTool() {
  return {
    name: 'file_edit',
    description: 'Edit an existing file by replacing specific text. Requires exact match of the old_string.',
    inputSchema: z.object({
      path: z.string().describe('Absolute or relative path to the file'),
      old_string: z.string().describe('Exact text to find and replace (must match exactly)'),
      new_string: z.string().describe('New text to replace with'),
      replace_all: z.boolean().optional().describe('Replace all occurrences (default: false)'),
    }),
    async execute(input: { path: string; old_string: string; new_string: string; replace_all?: boolean }, ctx: ToolContext): Promise<ToolResult> {
      const filePath = path.isAbsolute(input.path)
        ? input.path
        : path.join(ctx.cwd, input.path);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (!content.includes(input.old_string)) {
          return {
            data: null,
            error: `String not found in ${filePath}`,
            ui: {
              uiType: 'file_preview',
              props: {
                path: filePath,
                content: '',
                status: 'error' as const,
                error: `The exact string to replace was not found in the file.`,
              },
            },
          };
        }

        const newContent = input.replace_all
          ? content.split(input.old_string).join(input.new_string)
          : content.replace(input.old_string, input.new_string);

        await fs.writeFile(filePath, newContent, 'utf-8');

        return {
          data: { path: filePath, replaced: true },
          ui: {
            uiType: 'file_preview',
            props: {
              path: filePath,
              content: newContent,
              status: 'success' as const,
              action: 'edited' as const,
            },
          },
        };
      } catch (err: any) {
        return {
          data: null,
          error: err.message,
          ui: {
            uiType: 'file_preview',
            props: {
              path: filePath,
              content: '',
              status: 'error' as const,
              error: err.message,
            },
          },
        };
      }
    },
  };
}

// ─── Grep Tool ────────────────────────────────────────────────

export function createGrepTool() {
  return {
    name: 'grep',
    description: 'Search file contents using regex patterns. Similar to grep -r.',
    inputSchema: z.object({
      pattern: z.string().describe('Regex pattern to search for'),
      path: z.string().optional().describe('Directory or file to search in (defaults to cwd)'),
      glob: z.string().optional().describe('File glob pattern to filter (e.g. "*.ts")'),
      limit: z.number().optional().describe('Limit number of results'),
    }),
    async execute(input: { pattern: string; path?: string; glob?: string; limit?: number }, ctx: ToolContext): Promise<ToolResult> {
      const searchPath = input.path || ctx.cwd;
      
      try {
        // Use ripgrep if available, fallback to native grep
        const cmd = input.glob
          ? `grep -rn '${input.pattern.replace(/'/g, "'\\''")}' --include='${input.glob}' '${searchPath}'`
          : `grep -rn '${input.pattern.replace(/'/g, "'\\''")}' '${searchPath}'`;

        const { stdout } = await execAsync(cmd, {
          maxBuffer: 1024 * 1024 * 5,
        });

        const lines = stdout.trim().split('\n').filter(Boolean);
        const limited = input.limit ? lines.slice(0, input.limit) : lines;

        return {
          data: { matches: limited, count: limited.length },
          ui: {
            uiType: 'code_block',
            props: {
              command: `grep -rn "${input.pattern}" ${input.glob || ''} ${searchPath}`,
              output: limited.join('\n') || 'No matches found',
              status: limited.length > 0 ? 'success' as const : 'warning' as const,
              language: 'text',
            },
          },
        };
      } catch (err: any) {
        // grep returns exit code 1 when no matches - not an error
        if (err.message?.includes('exit code 1')) {
          return {
            data: { matches: [], count: 0 },
            ui: {
              uiType: 'code_block',
              props: {
                command: `grep "${input.pattern}"`,
                output: 'No matches found',
                status: 'warning' as const,
                language: 'text',
              },
            },
          };
        }
        return {
          data: null,
          error: err.message,
          ui: {
            uiType: 'code_block',
            props: {
              command: `grep "${input.pattern}"`,
              output: err.message,
              status: 'error' as const,
              language: 'text',
            },
          },
        };
      }
    },
  };
}

// ─── Glob Tool ────────────────────────────────────────────────

export function createGlobTool() {
  return {
    name: 'glob',
    description: 'Fast file pattern matching. Similar to glob "*.ts" or "**/*.tsx".',
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern (e.g. "**/*.ts")'),
      path: z.string().optional().describe('Directory to search in (defaults to cwd)'),
    }),
    async execute(input: { pattern: string; path?: string }, ctx: ToolContext): Promise<ToolResult> {
      const searchPath = input.path || ctx.cwd;

      try {
        const matches = await globFn(input.pattern, {
          cwd: searchPath,
          nodir: true,
        });

        return {
          data: { files: matches, count: matches.length },
          ui: {
            uiType: 'code_block',
            props: {
              command: `glob "${input.pattern}"`,
              output: matches.length > 0 
                ? matches.map(f => `- ${f}`).join('\n')
                : 'No files matched the pattern',
              status: matches.length > 0 ? 'success' as const : 'warning' as const,
              language: 'text',
            },
          },
        };
      } catch (err: any) {
        return {
          data: null,
          error: err.message,
          ui: {
            uiType: 'code_block',
            props: {
              command: `glob "${input.pattern}"`,
              output: err.message,
              status: 'error' as const,
              language: 'text',
            },
          },
        };
      }
    },
  };
}
