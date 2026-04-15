import React from 'react';
import { Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getFriendlyToolName } from '../../lib/chat-utils';
import { BugCard } from '../BugCard';
import { PipelineCard } from '../PipelineCard';
import { TaskPlan } from '../TaskPlan';
import { DiffViewer } from '../DiffViewer';

interface ToolInvocationRendererProps {
  part: any;
  t: any;
  getLocalizedName: any;
  sendMessage: (msg: any) => Promise<void>;
  setPreviewAttachment: (attachment: any) => void;
}

export function ToolInvocationRenderer({
  part,
  t,
  getLocalizedName,
  sendMessage,
  setPreviewAttachment
}: ToolInvocationRendererProps) {
  const result = part.output || part.result;
  const toolName = part.toolName || part.type?.replace('tool-', '') || '';

  // ── Gen 2: UI Protocol (ui 字段) → CapsuleAnchor handles this inline
  if (result?.ui) {
    return null; 
  }

  // ── Gen 1: Backwards Compatibility ──

  // Stitch BugCard
  if (toolName === 'getBugInfo' || toolName === 'tool-getBugInfo') {
    if (result) {
      return (
        <BugCard
          key={part.toolCallId}
          id={result.id || ''}
          title={result.title || ''}
          status={result.status || 'active'}
          assignee={result.assignee || ''}
          severity={result.severity || 'medium'}
          description={result.description || ''}
          createdAt={result.createdAt || ''}
          attachments={result.attachments}
          onAction={(action, data) => {
            if (action === 'create_zentao_task') {
              sendMessage({ content: `Create ZenTao task for ${data.bugId}: priority=${data.priority}, assignee=${data.assignee}`, role: 'user' });
            }
          }}
        />
      );
    }
  }

  // Stitch Diff Viewer
  if (toolName === 'runLocalCommand' || toolName === 'tool-runLocalCommand') {
    if (result?.status === 'Success' && result.command === 'git_diff') {
      return (
        <DiffViewer
          key={part.toolCallId}
          fileName="gitlab-api-v4.ts"
          draft
          diff={[
            { lineNumber: 24, type: 'context', content: "const authHeader = `Bearer ${token}`;" },
            { lineNumber: 25, type: 'deletion', content: "console.log(`Request sent with ${authHeader}`);" },
            { lineNumber: 25, type: 'addition', content: "logger.debug('Request sent', { correlationId }); // Redact tokens" },
            { lineNumber: 26, type: 'context', content: "return await fetch(url, { headers: { authHeader } });" },
          ]}
          onApply={() => sendMessage({ content: 'Apply fix to GitLab', role: 'user' })}
        />
      );
    }
  }

  if (toolName === 'searchBugs' || toolName === 'tool-searchBugs') {
    const bugs = Array.isArray(result) ? result : [];
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mt-2" key={part.toolCallId}>
        {bugs.map((b: any) => <BugCard key={b.id} {...b} />)}
      </div>
    );
  }

  if (toolName === 'getPipelineStatus' || toolName === 'tool-getPipelineStatus') {
    if (result) return <PipelineCard key={part.toolCallId} {...result} />;
  }

  if (toolName === 'proposePlan' || toolName === 'tool-proposePlan') {
    if (result) return (
      <TaskPlan
        key={part.toolCallId}
        {...result}
        onConfirm={() => sendMessage({ content: 'Y', role: 'user' })}
        onCancel={() => sendMessage({ content: 'N', role: 'user' })}
      />
    );
  }

  if (toolName === 'runLocalCommand' || toolName === 'tool-runLocalCommand') {
    if (result?.status === 'Success') {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs mt-2 overflow-hidden" key={part.toolCallId}>
          <div className="flex items-center gap-2 mb-2 text-blue-600 font-semibold">
            <Terminal className="w-3 h-3 text-blue-600" />
            <span>{t('tools.runLocalCommand', 'Local Command')}: {result.command}</span>
          </div>
          <pre className="text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {JSON.stringify(result.result, null, 2)}
          </pre>
        </div>
      );
    }
  }

  return null;
}

interface ToolInvocationBadgeProps {
  part: any;
  t: any;
  getLocalizedName: any;
  setPreviewAttachment: (attachment: any) => void;
}

export function ToolInvocationBadge({
  part,
  t,
  getLocalizedName,
  setPreviewAttachment
}: ToolInvocationBadgeProps) {
  const inner = part.toolInvocation || part.invocation || part;
  const rawToolName = inner.toolName || part.toolName || part.type?.replace('tool-', '') || 'unknown';
  const args = inner.args || part.args;
  
  const toolDisplayName = getFriendlyToolName(part, t, getLocalizedName);
  const isCompleted = !!(part.output || part.result);
  const isSkillActivation = rawToolName === 'activate_skill';
  const result = part.result || part.output;

  const handleToolClick = () => {
    if (isSkillActivation && isCompleted && result?.skill_content) {
      try {
        const content = result.skill_content;
        const fileName = `${args?.skill_name || 'Skill'}.md`;
        const b64 = btoa(unescape(encodeURIComponent(content)));
        setPreviewAttachment({
          name: fileName,
          contentType: 'text/markdown',
          url: `data:text/markdown;base64,${b64}`
        });
      } catch (err) {
        console.error('Failed to preview skill:', err);
      }
    }
  };

  return (
    <div key={part.toolCallId} className="flex flex-col gap-2 my-2">
      <div
        onClick={handleToolClick}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all w-fit group/invocation",
          isCompleted
            ? "bg-[#F6F3F2]/40 border-[#E8E4E2]/40 text-[#716B67] opacity-80"
            : "bg-[#EC5B14]/5 border-[#EC5B14]/15 text-[#EC5B14] shadow-sm shadow-[#EC5B14]/5",
          isSkillActivation && isCompleted && "cursor-pointer hover:bg-[#F6F3F2]/60 hover:border-[#EC5B14]/30 hover:opacity-100"
        )}
      >
        <div className={cn(
          "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
          isCompleted ? "bg-[#716B67]/10" : "bg-[#EC5B14]/10 animate-pulse"
        )}>
          {isCompleted ? (
            <div className="w-1.5 h-1.5 rounded-full bg-[#716B67]" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-[#EC5B14]" />
          )}
        </div>
        <span className="text-[11px] font-bold tracking-tight">{toolDisplayName}</span>
        {isSkillActivation && isCompleted && result?.skill_content && (
          <Terminal className="w-3 h-3 ml-1 opacity-0 group-hover/invocation:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}
