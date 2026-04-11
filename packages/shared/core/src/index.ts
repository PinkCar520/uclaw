export interface UClawBaseEvent {
  eventId: string;
  source: 'web' | 'cli' | 'im';
  timestamp: number;
}

export interface BugDetail {
  id: string;
  title: string;
  status: 'active' | 'resolved' | 'closed';
  assignee: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
  description: string;
  attachments?: Array<{ url: string; name?: string; contentType?: string }>;
}

export interface UClawLocalActionRequest {
  toolName: string;
  args: Record<string, any>;
}

export interface RPCMessage {
  id: string;
  method: string;
  params: any;
}

export interface RPCResponse {
  id: string;
  result?: any;
  error?: any;
}

// ──────────────────────────────────────────────
// Skill System Types
// ──────────────────────────────────────────────

/** Skill 单个执行步骤定义 */
export interface SkillStep {
  /** 步骤唯一 ID */
  id: string;
  /** 调用的 MCP 工具名 */
  tool: string;
  /** 用户可读的步骤描述 */
  description: string;
  /** 依赖的前置步骤 ID 列表（DAG） */
  dependsOn?: string[];
  /** 是否需要人工确认（Y/N）才能执行 */
  requireConfirm?: boolean;
  /** 该步骤的静态参数（可被前序步骤输出覆盖） */
  staticParams?: Record<string, any>;
}

/** Skill 定义 */
export interface Skill {
  /** 技能唯一名称，如 'fix-bug', 'deploy' */
  name: string;
  /** 展示描述 */
  description: string;
  /** 触发关键词列表（用于意图识别） */
  triggers: string[];
  /** 步骤列表 */
  steps: SkillStep[];
  /** 是否自动注入 .AIGUIDE.md 团队规范 */
  aiguideEnabled?: boolean;
}

/** Skill 执行上下文 */
export interface SkillContext {
  /** 当前用户工号 */
  userId: string;
  /** 来源渠道 */
  source: 'web' | 'cli' | 'im';
  /** 用户所在工作区路径（用于加载 .AIGUIDE.md） */
  workspacePath?: string;
  /** 请求原始消息 */
  userMessage: string;
  /** 解析出的技能输入参数 */
  extractedParams?: Record<string, any>;
}

/** Skill 执行步骤结果 */
export interface SkillStepResult {
  stepId: string;
  tool: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

/** Skill 完整执行报告 */
export interface SkillExecutionReport {
  skillName: string;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: SkillStepResult[];
  startedAt: number;
  completedAt?: number;
}

// ──────────────────────────────────────────────
// Generative UI Protocol v1
// ──────────────────────────────────────────────
export type {
  UIComponentType,
  UIBase,
  UIBugCardProps,
  UIBugCard,
  UIBugListProps,
  UIBugList,
  UIStep,
  UIPipelineCardProps,
  UIPipelineCard,
  UITaskStep,
  UITaskPlanProps,
  UITaskPlan,
  UIApprovalCardProps,
  UIApprovalCard,
  UICodeBlockProps,
  UICodeBlock,
  UIStatsMetric,
  UIStatsCardProps,
  UIStatsCard,
  UITextProps,
  UIText,
  UIKit,
  ToolResult,
} from './ui-protocol';
