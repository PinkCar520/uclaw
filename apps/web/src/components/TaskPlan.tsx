import { ClipboardList, Info, Check, X, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import type { UITaskPlanProps, UITaskStep } from '../types/ui-protocol';

export type { UITaskPlanProps };

export interface TaskPlanProps {
  title: UITaskPlanProps['title'];
  steps: UITaskPlanProps['steps'];
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function TaskPlan({ title, steps, onConfirm, onCancel }: TaskPlanProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-[#E8E4E2] rounded-[20px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] mt-4 max-w-[520px]">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-[#E8E4E2]/60">
        <div className="flex items-center gap-3">
          <div className="bg-[#EC5B14]/5 p-2 rounded-xl">
            <ClipboardList className="w-5 h-5 text-[#EC5B14]" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-[#EC5B14] uppercase tracking-[0.2em]">
              {t('task_plan.proposed_strategy', 'Proposed Strategy')}
            </h4>
            <h3 className="text-[15px] font-bold text-[#1C1B1B] mt-0.5">{title}</h3>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="px-6 py-5 space-y-3">
        {steps.map((step: UITaskStep, i: number) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-[14px] bg-[#F6F3F2] border border-[#E8E4E2]/60 hover:border-[#EC5B14]/30 transition-all">
            <div className="w-7 h-7 rounded-lg bg-white border border-[#E8E4E2] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-[#EC5B14]">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono text-[#716B67] bg-white px-2 py-0.5 rounded border border-[#E8E4E2]">
                {step.tool}
              </span>
              <p className="text-[13px] font-bold text-[#1C1B1B] mt-1.5">{step.label}</p>
              <p className="text-[11px] text-[#716B67] mt-0.5 leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-4 border-t border-[#E8E4E2]/60 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#716B67] uppercase tracking-wider">
          <Info className="w-3.5 h-3.5" />
          {t('task_plan.awaiting_authorization', 'Awaiting Authorization')}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-[10px] bg-[#F6F3F2] hover:bg-[#E8E4E2] text-[#716B67] text-[12px] font-bold transition-all border border-[#E8E4E2] flex items-center gap-2"
          >
            <X className="w-3.5 h-3.5" />
            {t('task_plan.reject', 'Reject')}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-[10px] bg-gradient-to-br from-[#a33800] to-[#cc4900] hover:from-[#c24200] hover:to-[#e65200] text-white text-[12px] font-bold transition-all border border-transparent flex items-center gap-2 shadow-[0_4px_14px_rgba(204,73,0,0.3)]"
          >
            <Check className="w-3.5 h-3.5" />
            {t('task_plan.confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
