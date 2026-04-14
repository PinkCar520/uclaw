import { SecurityAuditResult } from '../utils/security.js';

/**
 * Standard interface for all local tools.
 */
export interface LocalToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  uiHint?: 'text' | 'code' | 'diff' | 'tree' | 'git';
  audit?: SecurityAuditResult;
}

export abstract class LocalTool<P = any, R = any> {
  abstract readonly name: string;
  abstract readonly description: string;

  /**
   * Executes the tool logic.
   */
  abstract execute(params: P): Promise<LocalToolResponse<R>>;
}
