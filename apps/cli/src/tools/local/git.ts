import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { LocalTool, LocalToolResponse } from '../base.js';

const execAsync = promisify(exec);

interface GitParams {
  action: 'status' | 'log' | 'diff' | 'branch';
  args?: string;
}

/**
 * GitTool - Provides structured Git information for Web UI rendering.
 */
export class GitTool extends LocalTool<GitParams, any> {
  readonly name = 'local_git';
  readonly description = 'Interact with local Git repository and return structured data.';

  async execute(params: GitParams): Promise<LocalToolResponse<any>> {
    const { action, args = '' } = params;

    try {
      let command = `git ${action} ${args}`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stdout) {
        return { success: false, error: stderr };
      }

      // Metadata for special rendering in Web UI
      let uiHint: any = 'git';
      let data: any = stdout;

      // Basic parsing logic to structure the data
      if (action === 'status') {
        data = {
          raw: stdout,
          isClean: stdout.includes('nothing to commit, working tree clean'),
          branch: (await execAsync('git rev-parse --abforce-ref HEAD')).stdout.trim()
        };
      }

      return {
        success: true,
        data,
        uiHint
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
