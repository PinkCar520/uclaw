import { Play, CheckCircle2, CircleDot, XCircle, Clock, ExternalLink, Terminal, GitBranch } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import type { UIPipelineCardProps, UIStep } from '../types/ui-protocol';

export type { UIPipelineCardProps };

export interface PipelineCardProps extends UIPipelineCardProps {
  onViewLogs?: (pipelineId: string) => void;
  onRetry?: (pipelineId: string) => void;
}

interface StatusStyle {
  text: string;
  bg: string;
  border: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function PipelineCard({
  id,
  name,
  branch,
  status,
  steps,
  startTime,
  onViewLogs,
  onRetry,
}: PipelineCardProps) {
  const { t } = useTranslation();

  const statusStyles: Record<string, StatusStyle> = {
    success: { text: 'text-[#10B981]', bg: 'bg-[#10B981]/5', border: 'border-[#10B981]/20', icon: CheckCircle2 },
    running: { text: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/5', border: 'border-[#3B82F6]/20', icon: CircleDot },
    failed: { text: 'text-[#F43F5E]', bg: 'bg-[#F43F5E]/5', border: 'border-[#F43F5E]/20', icon: XCircle },
    paused: { text: 'text-[#716B67]', bg: 'bg-[#716B67]/5', border: 'border-[#716B67]/20', icon: Clock },
  };

  const currentStatus = statusStyles[status];

  return (
    <div className="bg-white border border-[#E8E4E2] rounded-[20px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] mt-4 max-w-[520px]">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-[#E8E4E2]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl", currentStatus.bg, currentStatus.border, "border")}>
              <currentStatus.icon className={cn("w-4 h-4", currentStatus.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-[15px] font-bold text-[#1C1B1B]">{name}</h4>
                <span className="text-[10px] font-mono bg-[#F6F3F2] px-2 py-0.5 rounded-md text-[#716B67]">#{id}</span>
              </div>
              <p className="text-[11px] text-[#716B67] mt-0.5 flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                {branch} • {startTime}
              </p>
            </div>
          </div>
          {onViewLogs && (
            <button
              onClick={() => onViewLogs(id)}
              className="p-2 hover:bg-[#F6F3F2] rounded-xl transition-colors text-[#716B67] hover:text-[#EC5B14]"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-6 py-5 space-y-4 relative">
        {steps.map((step: UIStep, i: number) => (
          <div key={i} className="flex items-center gap-4">
            {/* Step indicator */}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2",
              step.status === 'success' && "border-[#10B981] bg-[#10B981]/5",
              step.status === 'running' && "border-[#3B82F6] bg-[#3B82F6]/5 animate-pulse",
              step.status === 'failed' && "border-[#F43F5E] bg-[#F43F5E]/5",
              step.status === 'waiting' && "border-[#E8E4E2] bg-white"
            )}>
              {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
              {step.status === 'running' && <CircleDot className="w-4 h-4 text-[#3B82F6]" />}
              {step.status === 'failed' && <XCircle className="w-4 h-4 text-[#F43F5E]" />}
              {step.status === 'waiting' && <div className="w-2 h-2 rounded-full bg-[#E8E4E2]" />}
            </div>
            {/* Step name */}
            <span className={cn(
              "flex-1 text-[13px] font-semibold",
              step.status === 'running' ? "text-[#3B82F6]" : "text-[#1C1B1B]"
            )}>
              {step.name}
            </span>
            {/* Duration */}
            {step.duration && (
              <span className="text-[11px] font-mono text-[#716B67] bg-[#F6F3F2] px-2.5 py-1 rounded-lg">
                {step.duration}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      {(onViewLogs || status === 'failed') && (
        <div className="px-6 pb-6 pt-4 border-t border-[#E8E4E2]/60 flex gap-3">
          <button
            onClick={() => onViewLogs?.(id)}
            disabled={!onViewLogs}
            className={cn(
              "flex-1 py-3 rounded-[12px] border text-[12px] font-bold transition-all uppercase tracking-wider",
              onViewLogs
                ? "bg-[#F6F3F2] border-[#E8E4E2] text-[#716B67] hover:bg-[#F6F3F2]/80"
                : "bg-[#F6F3F2] border-[#E8E4E2] text-[#716B67]/40 cursor-not-allowed"
            )}
          >
            {t('pipeline.view_logs', 'View Logs')}
          </button>
          {status === 'failed' && (
            <button
              onClick={() => onRetry?.(id)}
              disabled={!onRetry}
              className={cn(
                "flex-1 py-3 rounded-[12px] text-[12px] font-bold transition-all uppercase tracking-wider text-white",
                onRetry ? "bg-gradient-to-br from-[#a33800] to-[#cc4900] hover:from-[#c24200] hover:to-[#e65200]" : "bg-slate-300 cursor-not-allowed"
              )}
            >
              {t('pipeline.retry_build', 'Retry Build')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
