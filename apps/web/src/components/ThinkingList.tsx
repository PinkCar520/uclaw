import { Check, Loader2, Brain } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ThinkingStep {
  label: string;
  status: 'done' | 'active' | 'pending';
}

export interface ThinkingListProps {
  steps: ThinkingStep[];
}

export function ThinkingList({ steps }: ThinkingListProps) {
  const activeSteps = steps.filter(s => s.status !== 'pending');

  if (activeSteps.length === 0) return null;

  return (
    <div className="mb-6 p-5 bg-white rounded-[20px] border border-[#E8E4E2]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-[#EC5B14]" />
        <span className="text-[11px] font-bold text-[#EC5B14] uppercase tracking-[0.15em]">
          Thinking Process
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {activeSteps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              {step.status === 'done' && (
                <Check className="w-4 h-4 text-[#EC5B14]" />
              )}
              {step.status === 'active' && (
                <Loader2 className="w-4 h-4 text-[#EC5B14] animate-spin" />
              )}
            </div>
            {/* Label */}
            <span className={cn(
              "text-[13px]",
              step.status === 'done' ? "text-[#716B67]" : "text-[#A33800] font-medium"
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
