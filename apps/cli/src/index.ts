#!/usr/bin/env node

/**
 * UClaw CLI - Entry Point
 * 
 * Dual mode:
 * - `uclaw <command>` - Single command execution
 * - `uclaw` (no args) - Interactive REPL mode
 */

import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

// ESM __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
// dist/index.js is at apps/cli/dist, .env is at project root
// Need to go up 3 levels: dist -> cli -> apps -> project-root
const envRoot = path.resolve(__dirname, '../../..');
const envResult1 = dotenv.config({ path: path.join(envRoot, '.env'), override: true });
const envResult2 = dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

// Sanity check - always print, not just when DEBUG
console.log(`[dotenv debug] __dirname=${__dirname}`);
console.log(`[dotenv debug] envRoot=${envRoot}`);
console.log(`[dotenv debug] envResult1 parsed keys=${Object.keys(envResult1.parsed || {}).length}`);
console.log(`[dotenv debug] VLLM_API_BASE=${process.env.VLLM_API_BASE || '(undefined)'}`);
console.log(`[dotenv debug] DASHSCOPE_API_BASE=${process.env.DASHSCOPE_API_BASE || '(undefined)'}`);

const execAsync = promisify(exec);

// Import submodules (will be created)
import { runRepl } from './repl.js';
import { runDaemon } from './daemon.js';

const program = new Command();

program
  .name('uclaw')
  .description('UClaw AI Workstream Terminal Node')
  .version('1.0.0');

// ─── Default: REPL Mode ──────────────────────────────────────
program
  .argument('[query]', 'Direct query (exits after answering)')
  .option('-m, --model <model>', 'Model to use')
  .option('-w, --workspace <path>', 'Workspace directory', process.cwd())
  .option('-u, --user <userId>', 'User ID')
  .action(async (query, options) => {
    const userId = options.user || await getAutoUserId();
    const workspace = path.resolve(options.workspace);

    if (query) {
      // Single query mode - non-interactive
      console.log(chalk.cyan(`[UClaw] Query: ${query}`));
      console.log(chalk.cyan(`[UClaw] User: ${userId}`));
      console.log(chalk.cyan(`[UClaw] Workspace: ${workspace}\n`));
      await runRepl({ userId, workspace, singleQuery: query });
    } else {
      // Interactive REPL
      console.log(chalk.bold('\nUClaw Terminal AI'));
      console.log(chalk.gray(`User: ${userId} | Workspace: ${workspace}`));
      console.log(chalk.gray('Type your question or use /help for commands\n'));
      await runRepl({ userId, workspace });
    }
  });

// ─── Daemon Mode ─────────────────────────────────────────────
program
  .command('daemon')
  .description('Start persistent UClaw node daemon to await commands from Gateway')
  .option('-u, --user <userId>', 'User ID for identity binding (default: auto-detected)')
  .action(async (options) => {
    const userId = options.user || await getAutoUserId();
    await runDaemon({ userId });
  });

// ─── Login Command ──────────────────────────────────────────────────
program
  .command('login')
  .description('Authenticate with Gateway via browser OAuth (like Claude Code / Codex CLI)')
  .option('--api-key <key>', 'Directly set API Key (headless mode)')
  .option('--force', 'Force re-login even if already authenticated')
  .action(async (options) => {
    const gatewayUrl = process.env.UCLAW_GATEWAY_URL || 'http://localhost:3000';

    if (options.apiKey) {
      await saveCredentials({ apiKey: options.apiKey });
      console.log(chalk.green('✓ API Key saved.'));

      // After login, automatically enter CLI session
      const userId = process.env.UCLAW_WORK_ID || process.env.UCLAW_USER_ID || (await getAutoUserId());
      console.log(chalk.bold('\nUClaw Terminal AI'));
      console.log(chalk.gray(`User: ${userId} | Workspace: ${process.cwd()}\n`));
      await runRepl({ userId, workspace: process.cwd() });
      return;
    }

    // ── Browser OAuth flow (same as Claude Code / Codex / Gemini CLI) ──
    const { createServer } = await import('node:http');
    const { randomBytes } = await import('node:crypto');

    // Find available port
    const findPort = (): Promise<number> => {
      return new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, '127.0.0.1', () => {
          const port = (server.address() as any).port;
          server.close(() => resolve(port));
        });
        server.on('error', reject);
      });
    };

    const port = await findPort();
    const state = randomBytes(16).toString('hex');
    const callbackPath = '/callback';
    const redirectUri = `http://127.0.0.1:${port}${callbackPath}`;

    console.log(chalk.cyan('[UClaw]') + ' Starting browser OAuth login...');
    console.log(chalk.gray(`         Gateway: ${gatewayUrl}`));
    console.log(chalk.gray(`         Callback: ${redirectUri}`));

    // Open browser
    const authUrl = `${gatewayUrl}/api/auth/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&port=${port}`;
    console.log(chalk.yellow(`\n→ Opening browser for authorization...`));

    try {
      // Try to open browser
      const open = await import('open');
      await open.default(authUrl);
    } catch {
      console.log(chalk.gray('\nCould not open browser automatically.'));
      console.log(chalk.yellow(`Please visit:\n  ${authUrl}\n`));
    }

    // Start local callback server
    const codePromise = new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url!, `http://127.0.0.1:${port}`);

        if (url.pathname === callbackPath) {
          const code = url.searchParams.get('code');
          const retState = url.searchParams.get('state');

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <!DOCTYPE html>
              <html><head><title>UClaw Auth Complete</title>
              <style>
                body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f6f3f2;margin:0}
                .card{background:#fff;padding:40px;border-radius:16px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
                h1{color:#1c1b1b;font-size:20px;margin:0 0 8px}
                p{color:#716b67;font-size:14px;margin:0}
              </style>
              </head><body><div class="card"><h1>✓ Authorization Successful</h1>
              <p>You can close this window and return to the terminal.</p></div></body></html>
            `);
            resolve(code);
          } else {
            res.writeHead(400);
            res.end('Missing code parameter');
            reject(new Error('Authorization failed: missing code'));
          }

          // Shutdown server after short delay
          setTimeout(() => { server.close(); }, 1000);
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      server.listen(port, '127.0.0.1');
      server.on('error', reject);

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Login timed out (5 minutes). Please try again.'));
      }, 5 * 60 * 1000);
    });

    try {
      const code = await codePromise;
      console.log(chalk.cyan('[UClaw]') + ' Authorization code received. Exchanging for API Key...');

      // Exchange code for API Key
      const res = await fetch(`${gatewayUrl}/api/auth/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'CLI Login' }),
      });
      const data = await res.json();

      if (!data.key) {
        console.error(chalk.red(`✗ Failed to obtain API Key: ${data.message || 'Unknown error'}`));
        process.exit(1);
      }

      await saveCredentials({ apiKey: data.key, userId: data.workId });
      console.log(chalk.green(`Logged in as ${data.workId}`));

      // After login, automatically enter CLI session
      console.log(chalk.bold('\nUClaw Terminal AI'));
      console.log(chalk.gray(`User: ${data.workId} | Workspace: ${process.cwd()}\n`));
      await runRepl({ userId: data.workId, workspace: process.cwd() });
    } catch (err: any) {
      console.error(chalk.red(`✗ Login failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Legacy: Start Command ───────────────────────────────────
program
  .command('start')
  .description('Start UClaw interaction pointing to a task/bug')
  .argument('[task_id]', 'ID of the ZenTao or GitLab task')
  .action(async (taskId) => {
    const userId = await getAutoUserId();
    const workspace = process.cwd();

    if (taskId) {
      console.log(chalk.cyan(`[UClaw] Fetching ZenTao context for: ${taskId}...`));
      console.log(chalk.cyan(`[UClaw] User: ${userId}\n`));
      await runRepl({
        userId,
        workspace,
        singleQuery: `帮我查看禅道缺陷 ${taskId} 的详情并分析如何修复`
      });
    } else {
      console.log(chalk.cyan('[UClaw] Initializing general analysis...\n'));
      await runRepl({ userId, workspace });
    }
  });

// ─── Helpers ─────────────────────────────────────────────────
async function getAutoUserId(): Promise<string> {
  // Priority: UCLAW_USER_ID env > JWT user info > git config
  if (process.env.UCLAW_USER_ID) return process.env.UCLAW_USER_ID;
  if (process.env.UCLAW_WORK_ID) return process.env.UCLAW_WORK_ID;
  try {
    const { stdout } = await execAsync('git config user.name');
    return stdout.trim() || process.env.USER || 'unknown_dev';
  } catch {
    return process.env.USER || 'unknown_dev';
  }
}

async function saveCredentials(creds: { apiKey: string; userId?: string }): Promise<void> {
  const credDir = path.join(os.homedir(), '.uclaw');
  const credPath = path.join(credDir, 'credentials.json');

  // Ensure directory exists
  await fs.mkdir(credDir, { recursive: true });

  // Read existing or create new
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(credPath, 'utf-8'));
  } catch { /* ignore */ }

  const updated = { ...existing, ...creds, updatedAt: new Date().toISOString() };
  await fs.writeFile(credPath, JSON.stringify(updated, null, 2), 'utf-8');

  // Set restrictive permissions (owner read/write only)
  await fs.chmod(credPath, 0o600);
}

program.parse(process.argv);
