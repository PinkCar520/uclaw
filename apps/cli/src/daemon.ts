import { io } from 'socket.io-client';
import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import inquirer from 'inquirer';
import chalk from 'chalk';
import type { RPCMessage } from '@uclaw/core';
import { resolveApiKey, getAutoUserId } from './utils/auth.js';
import { CONFIG, LOG } from './utils/config.js';
import { security } from './utils/security.js';

// Import new atomic tools
import { FileEditTool } from './tools/local/file-edit.js';
import { GitTool } from './tools/local/git.js';

const execAsync = promisify(exec);

// Initialize tool instances
const tools = {
  fileEdit: new FileEditTool(),
  git: new GitTool(),
};

interface DaemonOptions {
  userId: string;
}

export async function runDaemon(options: DaemonOptions) {
  const effectiveUserId = process.env.UCLAW_WORK_ID || process.env.UCLAW_USER_ID || options.userId;
  const apiKey = await resolveApiKey();

  console.log(chalk.green(LOG.DAEMON) + ` Identity: ${chalk.bold(effectiveUserId)}`);
  console.log(chalk.green(LOG.DAEMON) + ` Connecting to Gateway (${CONFIG.GATEWAY_URL})...`);

  const socket = io(CONFIG.GATEWAY_URL, {
    query: { userId: effectiveUserId },
    auth: { token: apiKey || undefined },
    extraHeaders: apiKey ? {
      'x-api-key': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    } : {},
  });

  socket.on('connect', () => {
    console.log(chalk.green('✓ [SUCCESS]') + ` Connected as node: ${effectiveUserId}`);
  });

  socket.on('rpc_request', async (data: RPCMessage) => {
    console.log(chalk.cyan(LOG.RPC) + ` ID: ${data.id}, Method: ${data.method}`);

    let result: any = null;
    let error: string | null = null;
    let uiHint: string = 'text';

    try {
      // 1. Path Security Check
      const targetPath = data.params?.path || data.params?.dir;
      if (targetPath) {
        const { isValid } = security.validatePath(targetPath);
        if (!isValid) throw new Error(`Security Violation: Path "${targetPath}" is outside workspace.`);
      }

      // 2. Dispatch to New Atomic Tools or Legacy Switch
      switch (data.method) {
        case 'local_file_edit':
          const editRes = await tools.fileEdit.execute(data.params);
          if (!editRes.success) throw new Error(editRes.error);
          result = editRes.data;
          uiHint = editRes.uiHint || 'diff';
          break;

        case 'local_git':
          const gitRes = await tools.git.execute(data.params);
          if (!gitRes.success) throw new Error(gitRes.error);
          result = gitRes.data;
          uiHint = gitRes.uiHint || 'git';
          break;

        // Legacy / Standard methods
        case 'ls':
          result = await fs.readdir(process.cwd());
          uiHint = 'tree';
          break;
        case 'read_file':
          if (!data.params?.path) throw new Error('Path required');
          result = await fs.readFile(data.params.path, 'utf-8');
          uiHint = 'code';
          break;
        case 'bash':
          if (!data.params?.command) throw new Error('Command required');
          // Audit Bash
          const audit = security.auditCommand(data.params.command);
          if (!audit.allowed) throw new Error(`Command Denied: ${audit.reason}`);
          if (audit.riskLevel === 'HIGH') {
            const { confirmed } = await inquirer.prompt([{
              type: 'confirm',
              name: 'confirmed',
              message: `[Security] Authorize "${data.params.command}"?`,
              default: false,
            }]);
            if (!confirmed) throw new Error('Denied.');
          }
          const { stdout, stderr } = await execAsync(data.params.command);
          result = stdout || stderr;
          break;

        default:
          result = `Method ${data.method} not implemented.`;
      }
    } catch (err: any) {
      console.error(chalk.red('[RPC Error]'), err.message);
      error = err.message;
    }

    socket.emit('rpc_response', {
      id: data.id,
      result,
      error,
      metadata: { uiHint }
    });
  });

  socket.on('disconnect', () => console.log(chalk.red('✗ Disconnected.')));
  socket.on('connect_error', (err) => console.error(chalk.red('✗ Connection Error:'), err.message));

  await new Promise(() => {});
}
