import React from 'react';
import { Sparkles, Search, Wrench, ClipboardList, Rocket } from 'lucide-react';

interface EmptyStateProps {
  t: any;
  setLocalInput: (val: string) => void;
  onFormSubmit: () => void;
}

export function EmptyState({
  t,
  setLocalInput,
  onFormSubmit
}: EmptyStateProps) {
  const suggestions = [
    { icon: Search, label: t('chat.suggestions.bug_query', '查询缺陷详情'), prompt: '帮我查询缺陷 BUG-1 的详细信息' },
    { icon: Wrench, label: t('chat.suggestions.fix_suggestion', '修复代码问题'), prompt: '分析一下当前项目的代码质量问题并给出修复建议' },
    { icon: ClipboardList, label: t('chat.suggestions.create_task', '创建任务计划'), prompt: '帮我制定一个项目任务计划' },
    { icon: Rocket, label: t('chat.suggestions.pipeline_check', '检查流水线状态'), prompt: '查看当前流水线的构建状态' },
  ];

  return (
    <div className="flex flex-col w-full min-w-0 pb-4">
      {/* Center Logo & Title */}
      <div className="flex flex-col items-center justify-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-28 h-28 mb-4 flex items-center justify-center relative group transition-all duration-500 hover:-translate-y-1">
          <img src="/logo.svg" alt="北冥 Ocean Logo" className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-500" />
        </div>
        <h1 className="text-4xl font-display font-black text-[#1C1B1B] tracking-tight mb-2">北冥 Ocean</h1>
        <p className="text-[#716B67] font-medium text-lg">What can I help you with today?</p>
      </div>

      {/* Suggested Prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => {
              setLocalInput(s.prompt);
              setTimeout(() => onFormSubmit(), 0);
            }}
            className="flex items-center gap-3 p-4 rounded-[16px] bg-white border border-[#E8E4E2]/60 hover:border-[#EC5B14]/30 hover:shadow-[0_4px_16px_rgba(236,91,20,0.08)] transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#EC5B14]/5 flex items-center justify-center shrink-0 group-hover:bg-[#EC5B14]/10 transition-colors">
              <s.icon className="w-4 h-4 text-[#EC5B14]" />
            </div>
            <span className="text-sm font-medium text-[#1C1B1B] group-hover:text-[#EC5B14] transition-colors">
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
