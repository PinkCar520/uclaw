import * as fs from 'node:fs/promises';
import { LocalTool, LocalToolResponse } from '../base.js';
import { security } from '../../utils/security.js';

interface FileEditParams {
  path: string;
  oldString: string;
  newString: string;
}

/**
 * FileEditTool - Inspired by Claude Code's precision editing.
 * Performs a surgical find-and-replace on a local file.
 */
export class FileEditTool extends LocalTool<FileEditParams, string> {
  readonly name = 'local_file_edit';
  readonly description = 'Surgically replace a block of code in a local file.';

  async execute(params: FileEditParams): Promise<LocalToolResponse<string>> {
    const { path: filePath, oldString, newString } = params;

    // 1. Security Check
    const { isValid, resolvedPath } = security.validatePath(filePath);
    if (!isValid) {
      return { success: false, error: `Access denied: Path ${filePath} is outside workspace.` };
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      
      // 2. Precision Match
      if (!content.includes(oldString)) {
        return { 
          success: false, 
          error: `Could not find the exact code block to replace in ${filePath}. Please ensure the oldString matches exactly including whitespace.` 
        };
      }

      // Count occurrences to prevent ambiguous edits
      const occurrences = content.split(oldString).length - 1;
      if (occurrences > 1) {
        return { 
          success: false, 
          error: `Multiple occurrences of the code block found in ${filePath}. Please provide more context in oldString to make it unique.` 
        };
      }

      // 3. Apply Edit
      const newContent = content.replace(oldString, newString);
      await fs.writeFile(resolvedPath, newContent, 'utf-8');

      return {
        success: true,
        data: `Successfully updated ${filePath}.`,
        uiHint: 'diff'
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
