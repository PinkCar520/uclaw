import type { UIKit, UIComponentType, UITaskPlanProps } from '../types/ui-protocol';
import { BugCard } from '../components/BugCard';
import { PipelineCard } from '../components/PipelineCard';
import { TaskPlan } from '../components/TaskPlan';
import { ApprovalCard } from '../components/ApprovalCard';
import { StatsCard } from '../components/StatsCard';
import { CodeBlock } from '../components/CodeBlock';
import { ZenTaoTaskCard } from '../components/ZenTaoTaskCard';
import { LeaveRequestForm } from '../components/LeaveRequestForm';
import { DiffViewer } from '../components/DiffViewer';
import { PrintConsole } from '../components/PrintConsole';
import { registerUIRenderer, renderUIKit as renderFromRegistry } from '../lib/uiRegistry';

// ──────────────────────────────────────────────
// 各类型的具体渲染器
// ──────────────────────────────────────────────

function BugCardRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'bug_card' }; onAction?: (actionId: string, payload: unknown) => void }) {
  return (
    <BugCard
      {...uiKit.props}
      onClick={(id) => onAction?.('open_bug_detail', { id })}
    />
  );
}

function BugListRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'bug_list' }; onAction?: (actionId: string, payload: unknown) => void }) {
  const { items, title } = uiKit.props;
  return (
    <div className="my-3">
      {title && <h4 className="text-sm font-bold text-slate-700 mb-3">{title}</h4>}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {items.map((bug: { id: string; title: string; status: 'active' | 'resolved' | 'closed'; assignee: string; severity: 'low' | 'medium' | 'high'; description?: string; createdAt?: string }, i: number) => (
          <BugCard
            key={bug.id ?? i}
            {...bug}
            onClick={(id) => onAction?.('open_bug_detail', { id })}
          />
        ))}
      </div>
    </div>
  );
}

function PipelineCardRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'pipeline_card' }; onAction?: (actionId: string, payload: unknown) => void }) {
  return (
    <PipelineCard
      {...uiKit.props}
      onViewLogs={(id) => onAction?.('view_logs', { pipelineId: id })}
      onRetry={(id) => onAction?.('retry_pipeline', { pipelineId: id })}
    />
  );
}

function TaskPlanRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'task_plan' }; onAction?: (actionId: string, payload: unknown) => void }) {
  return (
    <TaskPlan
      {...uiKit.props}
      onConfirm={() => onAction?.(uiKit.props.actionId, { confirmed: true })}
      onCancel={() => onAction?.(uiKit.props.actionId, { confirmed: false })}
    />
  );
}

function ApprovalCardRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'approval_card' }; onAction?: (actionId: string, payload: unknown) => void }) {
  return (
    <ApprovalCard
      {...uiKit.props}
      onApprove={() => onAction?.('approve_request', { requestId: uiKit.props.requestId })}
      onReject={() => onAction?.('reject_request', { requestId: uiKit.props.requestId })}
    />
  );
}

function StatsCardRenderer({ uiKit }: { uiKit: UIKit & { uiType: 'stats_card' } }) {
  return <StatsCard {...uiKit.props} />;
}

function CodeBlockRenderer({ uiKit }: { uiKit: UIKit & { uiType: 'code_block' } }) {
  return <CodeBlock {...uiKit.props} />;
}

// ── Stitch Components ──

function ZenTaoTaskCardRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'zentao_task_card' }; onAction?: (actionId: string, payload: unknown) => void }) {
  return (
    <ZenTaoTaskCard
      {...uiKit.props}
      onCreateTask={(data) => onAction?.('create_zentao_task', data)}
    />
  );
}

function LeaveRequestFormRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'leave_request_form' }; onAction?: (actionId: string, payload: unknown) => void }) {
  return (
    <LeaveRequestForm
      {...uiKit.props}
      onSubmit={(data) => onAction?.('submit_leave_request', data)}
      onQuickAction={(action) => onAction?.('leave_quick_action', { action })}
    />
  );
}

function DiffViewerRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'diff_viewer' }; onAction?: (actionId: string, payload: unknown) => void }) {
  return (
    <DiffViewer
      {...uiKit.props}
      onApply={() => onAction?.('apply_diff', { fileName: uiKit.props.fileName })}
    />
  );
}

function PrintConsoleRenderer({ uiKit, onAction }: { uiKit: UIKit & { uiType: 'print_console' }; onAction?: (actionId: string, payload: unknown) => void }) {
  return (
    <PrintConsole
      {...uiKit.props}
      onConfirmPrint={() => onAction?.('confirm_print', {})}
      onQuickAction={(action) => onAction?.('print_quick_action', { action })}
    />
  );
}

// ──────────────────────────────────────────────
// UIRenderer 主组件
// ──────────────────────────────────────────────

interface UIRendererProps {
  uiKit: UIKit;
  onAction?: (actionId: string, payload: unknown) => void;
}

export function UIRenderer({ uiKit, onAction }: UIRendererProps) {
  return renderFromRegistry(uiKit, onAction);
}

// ──────────────────────────────────────────────
// 自动注册所有渲染器（模块加载时执行一次）
// ──────────────────────────────────────────────

const REGISTRATION_KEY = '__uclaw_ui_renderers_registered__';
if (!(globalThis as Record<string, unknown>)[REGISTRATION_KEY]) {
  (globalThis as Record<string, unknown>)[REGISTRATION_KEY] = true;

  const renderers: Record<UIComponentType, React.ComponentType<any>> = {
    bug_card: BugCardRenderer,
    bug_list: BugListRenderer,
    pipeline_card: PipelineCardRenderer,
    task_plan: TaskPlanRenderer,
    approval_card: ApprovalCardRenderer,
    code_block: CodeBlockRenderer,
    stats_card: StatsCardRenderer,
    text: () => null,
    zentao_task_card: ZenTaoTaskCardRenderer,
    leave_request_form: LeaveRequestFormRenderer,
    diff_viewer: DiffViewerRenderer,
    print_console: PrintConsoleRenderer,
  };

  (Object.entries(renderers) as [UIComponentType, React.ComponentType<any>][]).forEach(([type, component]) => {
    registerUIRenderer(type, component);
  });
}
