import { Shield, Check, X, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import type { UIApprovalCardProps } from '../types/ui-protocol';

export type { UIApprovalCardProps };

export interface ApprovalCardProps {
  requestId: UIApprovalCardProps['requestId'];
  toolName: UIApprovalCardProps['toolName'];
  description: UIApprovalCardProps['description'];
  args?: UIApprovalCardProps['args'];
  status: UIApprovalCardProps['status'];
  onApprove?: () => void;
  onReject?: () => void;
}

export function ApprovalCard({
  requestId,
  toolName,
  description,
  args,
  status,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const { t } = useTranslation();

  const statusConfig: Record<string, {
    icon: ReactElement;
    label: string;
    bg: string;
    border: string;
    text: string;
    iconBg: string;
  }> = {
    pending: {
      icon: <Clock className="w-4 h-4 text-[#F59E0B]" />,
      label: t('approval.status.pending', 'Pending'),
      bg: 'bg-[#F59E0B]/5',
      border: 'border-[#F59E0B]/20',
      text: 'text-[#D97706]',
      iconBg: 'bg-[#F59E0B]/10',
    },
    approved: {
      icon: <Check className="w-4 h-4 text-[#10B981]" />,
      label: t('approval.status.approved', 'Approved'),
      bg: 'bg-[#10B981]/5',
      border: 'border-[#10B981]/20',
      text: 'text-[#059669]',
      iconBg: 'bg-[#10B981]/10',
    },
    rejected: {
      icon: <X className="w-4 h-4 text-[#F43F5E]" />,
      label: t('approval.status.rejected', 'Rejected'),
      bg: 'bg-[#F43F5E]/5',
      border: 'border-[#F43F5E]/20',
      text: 'text-[#DC2626]',
      iconBg: 'bg-[#F43F5E]/10',
    },
  };

  const config = statusConfig[status];
  const isPending = status === 'pending';

  return (
    <div className={cn(
      "bg-white border rounded-[20px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] mt-4 max-w-[520px] transition-all",
      config.border,
      isPending && "shadow-[0_8px_30px_rgba(245,158,11,0.08)]"
    )}>
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-[#E8E4E2]/60">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl border", config.bg, config.iconBg, config.border)}>
            <Shield className={cn("w-5 h-5", config.text)} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[15px] font-bold text-[#1C1B1B] truncate">{toolName}</h4>
            <p className="text-[10px] text-[#716B67] font-mono mt-0.5">ID: {requestId}</p>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border uppercase",
            config.bg, config.border, config.text
          )}>
            {config.icon}
            {config.label}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-6 py-5">
        <p className="text-[13px] text-[#716B67] leading-relaxed font-medium">{description}</p>

        {/* Args */}
        {args && Object.keys(args).length > 0 && (
          <details className="mt-4 group/details">
            <summary className="text-[10px] font-bold text-[#716B67] uppercase tracking-wider cursor-pointer hover:text-[#1C1B1B] transition-colors">
              {t('approval.view_args', 'View Parameters')}
            </summary>
            <pre className="mt-2 p-3 bg-[#F6F3F2] rounded-[12px] border border-[#E8E4E2]/60 text-[11px] font-mono text-[#716B67] overflow-auto max-h-32">
              {JSON.stringify(args, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="px-6 pb-6 pt-4 border-t border-[#E8E4E2]/60">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
            <span className="text-[12px] text-[#716B67] font-medium flex-1">
              {t('approval.confirm_message', 'Confirm this action?')}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onReject}
              className="flex-1 py-3 rounded-[12px] bg-[#F6F3F2] hover:bg-[#E8E4E2] text-[#716B67] text-[12px] font-bold transition-all border border-[#E8E4E2] flex items-center justify-center gap-2"
            >
              <X className="w-3.5 h-3.5" />
              {t('approval.reject', 'Reject')}
            </button>
            <button
              onClick={onApprove}
              className="flex-1 py-3 rounded-[12px] bg-gradient-to-br from-[#a33800] to-[#cc4900] hover:from-[#c24200] hover:to-[#e65200] text-white text-[12px] font-bold transition-all border border-transparent flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(204,73,0,0.3)]"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('approval.approve', 'Approve')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
