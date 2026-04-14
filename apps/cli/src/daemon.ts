import { io } from 'socket.io-client';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import inquirer from 'inquirer';
import chalk from 'chalk';
import type { RPCMessage, RPCResponse } from '@uclaw/core';

const execAsync = promisify(exec);

interface DaemonOptions {
  userId: string;
}

/**
 * Resolve API Key from:
 * 1. UCLAW_API_KEY environment variable
 * 2. ~/.uclaw/credentials.json
 */
async function resolveApiKey(): Promise<string | null> {
  // Priority 1: Environment variable
  if (process.env.UCLAW_API_KEY) {
    return process.env.UCLAW_API_KEY;
  }

  // Priority 2: Credentials file
  const credPath = path.join(os.homedir(), '.uclaw', 'credentials.json');
  try {
    const raw = fsSync.readFileSync(credPath, 'utf-8');
    const creds = JSON.parse(raw);
    return creds.apiKey || null;
  } catch {
    return null;
  }
}

/**
 * Run the daemon mode - connects to Gateway and awaits RPC requests
 */
export async function runDaemon(options: DaemonOptions) {
  // Resolve actual userId: env override > API Key > git config
  const effectiveUserId = process.env.UCLAW_WORK_ID || process.env.UCLAW_USER_ID || options.userId;
  const apiKey = await resolveApiKey();

  console.log(chalk.green('[UClaw Daemon]') + ` Identity: ${chalk.bold(effectiveUserId)}`);
  console.log(chalk.green('[UClaw Daemon]') + ' Connecting to Gateway (http://localhost:3000)...');

  if (apiKey) {
    console.log(chalk.green('[UClaw Daemon]') + ' Auth: Using API Key');
  } else {
    console.log(chalk.yellow('[UClaw Daemon]') + ' Auth: No API Key found. Set UCLAW_API_KEY or run `uclaw login`');
  }

  const socket = io('http://localhost:3000', {
    query: { userId: effectiveUserId },
    auth: {
      token: apiKey || undefined,
    },
    extraHeaders: apiKey ? {
      'x-api-key': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    } : {},
  });

  socket.on('connect', () => {
    console.log(chalk.green('✓ [SUCCESS]') + ` Connected as node: ${effectiveUserId}`);
  });

  socket.on('rpc_request', async (data: RPCMessage) => {
    console.log(chalk.cyan('[RPC Request]') + ` ID: ${data.id}, Method: ${data.method}`);

    let result: any = null;
    let error: string | null = null;

    try {
      // Security gate: sensitive operations require Y/N confirmation
      const sensitiveMethods = ['git_commit', 'npm_build', 'git_add'];
      if (sensitiveMethods.includes(data.method)) {
        console.log(chalk.yellow('[SECURITY ALERT]') + ` Incoming sensitive command: ${chalk.bold(data.method)}`);

        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: `[UClaw Security] Allow execution of "${data.method}"?`,
          default: false,
        }]);

        if (!confirmed) {
          throw new Error('User manually denied command execution.');
        }
        console.log(chalk.green('[Security]') + ' User approved. Executing...');
      }

      // Get git root for git operations
      const getGitRoot = async () => {
        const { stdout } = await execAsync('git rev-parse --show-toplevel');
        return stdout.trim();
      };

      switch (data.method) {
        case 'ls':
          result = await fs.readdir(process.cwd());
          break;
        case 'git_status':
          const { stdout: status } = await execAsync('git status');
          result = status;
          break;
        case 'git_add':
          const rootForAdd = await getGitRoot();
          const files = data.params?.files || '.';
          const { stdout: addOut } = await execAsync(`git add ${files}`, { cwd: rootForAdd });
          result = addOut || `Successfully staged: ${files}`;
          break;
        case 'git_commit':
          const rootForCommit = await getGitRoot();
          const msg = (data.params?.message || 'UClaw auto-commit').replace(/"/g, '\\"');
          const { stdout: commitOut } = await execAsync(`git commit -m "${msg}"`, { cwd: rootForCommit });
          result = commitOut;
          break;
        case 'npm_build':
          console.log(chalk.yellow('[Build]') + ' Running build process...');
          const { stdout: buildOut } = await execAsync('npm run build');
          result = buildOut;
          break;
        case 'read_file':
          const filePath = data.params?.path;
          if (!filePath) throw new Error('File path is required');
          result = await fs.readFile(filePath, 'utf-8');
          break;
        default:
          result = `Unknown method: ${data.method}`;
      }
    } catch (err: any) {
      console.error(chalk.red('[RPC Error]'), err.message);
      error = err.message;
    }

    socket.emit('rpc_response', {
      id: data.id,
      result,
      error,
    });
    console.log(chalk.green('[RPC Response]') + ` Sent result for ${data.id}`);
  });

  socket.on('disconnect', () => {
    console.log(chalk.red('✗ Disconnected from Gateway.'));
  });

  socket.on('connect_error', (err) => {
    console.error(chalk.red('✗ Connection Error:'), err.message);
  });

  // Keep process alive
  await new Promise(() => {});
}
