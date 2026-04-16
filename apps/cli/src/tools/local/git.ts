import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { LocalTool, LocalToolResponse } from '../base.js';
import { getGitStateFs } from '../../utils/git-fs.js';

const execAsync = promisify(exec);

interface GitParams {
  action: 'status' | 'log' | 'diff' | 'branch' | 'add' | 'commit' | 'push';
  args?: string;
}

/**
 * GitTool - Provides structured Git information for Web UI rendering.
 */
export class GitTool extends LocalTool<GitParams, any> {
  readonly name = 'local_git';
  readonly description = 'Interact with local Git repository and return structured data.';

  async execute(params: GitParams): Promise<LocalToolResponse<any>> {
    let { action, args } = params;
    const cwd = process.cwd();

    // If args is an object (common when proxied), try to stringify or extract a sensible value
    let argsString = '';
    if (typeof args === 'object' && args !== null) {
      // Common patterns: { path: '.' }, { message: '...' }
      argsString = Object.values(args).join(' ');
    } else if (typeof args === 'string') {
      argsString = args;
    }

    try {
      // For status, we combine FS reading with the porcelain output
      if (action === 'status') {
        const [state, { stdout: rawStatus }] = await Promise.all([
          getGitStateFs(cwd),
          execAsync(`git status --porcelain ${argsString}`)
        ]);

        if (!state) {
          return { success: false, error: 'Not a git repository' };
        }

        return {
          success: true,
          data: {
            isClean: rawStatus.trim() === '',
            branch: state.branch,
            sha: state.sha,
            gitDir: state.gitDir,
            isShallow: state.isShallow,
            raw: rawStatus
          },
          uiHint: 'git'
        };
      }

      // Default to exec for complex commands
      let command = `git ${action} ${argsString}`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stdout) {
        return { success: false, error: stderr };
      }

      return {
        success: true,
        data: {
          raw: stdout,
          command: command
        },
        uiHint: 'git'
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
