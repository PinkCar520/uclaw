#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { io } from 'socket.io-client';
import { ZentaoTool } from '@uclaw/tools-zentao';
import { RPCMessage } from '@uclaw/types';

const execAsync = promisify(exec);
const program = new Command();
const zentao = new ZentaoTool();

/**
 * 自动探测本地身份：Git 用户名 > 系统用户名
 */
async function getAutoUserId(): Promise<string> {
  try {
    const { stdout } = await execAsync('git config user.name');
    return stdout.trim() || process.env.USER || 'unknown_dev';
  } catch {
    return process.env.USER || 'unknown_dev';
  }
}

program
  .name('uclaw')
  .description('UClaw AI Workstream Terminal Node')
  .version('1.0.0');

// --- 命令 A: 交互式启动 ---
program
  .command('start')
  .description('Start UClaw interaction pointing to a task/bug')
  .argument('[task_id]', 'ID of the ZenTao or GitLab task')
  .action(async (taskId) => {
    if (taskId) {
      console.log(`\x1b[36m[UClaw]\x1b[0m Fetching ZenTao context for: ${taskId}...`);
      const bug = await zentao.getBugInfo(taskId);
      
      if (bug) {
        console.log(`\x1b[32m[Context Found]\x1b[0m`);
        console.log(` > Title: ${bug.title}`);
        console.log(` > Assignee: ${bug.assignee}`);
        console.log(` > Severity: ${bug.severity}`);
      } else {
        console.log(`\x1b[33m[UClaw WARN]\x1b[0m No bug found with ID: ${taskId}. Proceeding with general context.`);
      }
    } else {
      console.log(`\x1b[36m[UClaw]\x1b[0m Initializing general analysis...`);
    }
    
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmPlan',
        message: 'Plan generated based on .AIGUIDE.md. Do you approve this AST refactor plan?',
        default: true
      }
    ]);
    
    if (answers.confirmPlan) {
      console.log('✅ AST Refactoring started...');
    } else {
      console.log('❌ Refactoring cancelled.');
    }
  });

// --- 命令 B: 后台 Daemon 模式 (RPC 监听) ---
program
  .command('daemon')
  .description('Start persistent UClaw node daemon to await commands from Gateway')
  .option('-u, --user <userId>', 'User ID for identity binding (default: auto-detected)')
  .action(async (options) => {
    const userId = options.user || await getAutoUserId();
    console.log(`\x1b[32m[UClaw Daemon]\x1b[0m Identity: \x1b[1m${userId}\x1b[0m`);
    console.log(`\x1b[32m[UClaw Daemon]\x1b[0m Connecting to Gateway (http://localhost:3000)...`);

    const socket = io('http://localhost:3000', {
      query: { userId }
    });

    socket.on('connect', () => {
      console.log(`✅ [\x1b[32mSUCCESS\x1b[0m] Connected as node: ${userId}`);
    });

    socket.on('rpc_request', async (data: RPCMessage) => {
      console.log(`\x1b[36m[RPC Request]\x1b[0m ID: ${data.id}, Method: ${data.method}`);

      let result: any = null;
      let error: string | null = null;

      try {
        // 安全闸门：敏感操作需要人工 Y/N 确认
        const sensitiveMethods = ['git_commit', 'npm_build', 'git_add'];
        if (sensitiveMethods.includes(data.method)) {
          console.log(`\x1b[33m[SECURITY ALERT]\x1b[0m Incoming sensitive command: \x1b[1m${data.method}\x1b[0m`);

          const { confirmed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirmed',
            message: `[UClaw Security] Allow execution of "${data.method}"?`,
            default: false
          }]);

          if (!confirmed) {
            throw new Error('User manually denied command execution.');
          }
          console.log(`\x1b[32m[Security]\x1b[0m User approved. Executing...`);
        }

        // 获取 Git 根目录，确保指令全局有效
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
            // 注意：专业化处理，不再在 commit 里强行 add .，交给用户或 AI 先调用 git_add
            const { stdout: commitOut } = await execAsync(`git commit -m "${msg}"`, { cwd: rootForCommit });
            result = commitOut;
            break;
          case 'npm_build':
            console.log('\x1b[33m[Build]\x1b[0m Running build process...');
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

        console.error(`\x1b[31m[RPC Error]\x1b[0m`, err.message);
        error = err.message;
      }

      socket.emit('rpc_response', {
        id: data.id,
        result: result,
        error: error
      });
      console.log(`\x1b[32m[RPC Response]\x1b[0m Sent result for ${data.id}`);
    });

    socket.on('disconnect', () => {
      console.log('\x1b[31m❌ Disconnected from Gateway.\x1b[0m');
    });

    socket.on('connect_error', (err) => {
      console.error('\x1b[31m❌ Connection Error:\x1b[0m', err.message);
    });
  });

program.parse(process.argv);
