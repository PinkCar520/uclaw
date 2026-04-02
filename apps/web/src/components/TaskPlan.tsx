import React from 'react';
import { ClipboardList, ChevronRight, Play, Info, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

type TaskStep = {
  label: string;
  tool: string;
  description: string;
};

type TaskPlanProps = {
  title: string;
  steps: TaskStep[];
  onConfirm?: () => void;
  onCancel?: () => void;
};

export function TaskPlan({ title, steps, onConfirm, onCancel }: TaskPlanProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mt-4 max-w-2xl text-slate-300 overflow-hidden relative group">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[64px] rounded-full -mr-16 -mt-16 pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 relative">
        <div className="p-2.5 rounded-2xl bg-blue-500/20 border border-blue-500/30">
          <ClipboardList className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-0.5">Proposed Strategy</h4>
          <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-4 mb-8 relative">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:border-blue-500/30 transition-all hover:bg-white/[0.05]">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
               <span className="text-[10px] font-bold text-white">{i + 1}</span>
            </div>
            <div className="space-y-1.5 flex-1">
               <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    {step.tool}
                  </span>
               </div>
               <p className="text-xs font-bold text-slate-100">{step.label}</p>
               <p className="text-[11px] text-slate-500 leading-relaxed italic">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Footer */}
      <div className="flex items-center justify-between pt-6 border-t border-white/[0.05] relative">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
           <Info className="w-3.5 h-3.5" />
           Awaiting Authorization
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onCancel}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-2"
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </button>
          <button 
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-all border border-blue-500 flex items-center gap-2"
          >
            <Check className="w-3.5 h-3.5" />
            Confirm (Y)
          </button>
        </div>
      </div>
    </div>
  );
}
