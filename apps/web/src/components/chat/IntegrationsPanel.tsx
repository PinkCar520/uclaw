import React from 'react';
import { Cpu, Database, BadgeCheck } from 'lucide-react';

interface IntegrationsPanelProps {
  t: any;
  activeDisplayName: string;
  totalUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export function IntegrationsPanel({
  t,
  activeDisplayName,
  totalUsage
}: IntegrationsPanelProps) {
  return (
    <div className="p-6 flex flex-col gap-8 overflow-y-auto flex-1">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-sm text-[#1C1B1B]">{t('chat.integrations.active_title')}</h4>
          <button className="text-[11px] font-bold text-[#EC5B14] hover:underline">{t('chat.integrations.manage')}</button>
        </div>
        <div className="space-y-3">
          <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-[#1C1B1B] flex items-center justify-center text-white font-bold text-xs">GL</div>
              <div>
                <p className="text-sm font-bold text-[#1C1B1B]">GitLab</p>
                <p className="text-[11px] text-[#716B67]">2 {t('chat.integrations.pending_mrs')}</p>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
          <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-[#0E1529] flex items-center justify-center text-red-500 font-bold text-xs"><Cpu className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-bold text-[#1C1B1B]">Jenkins</p>
                <p className="text-[11px] text-[#716B67]">1 {t('chat.integrations.pipeline_running')}</p>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#EC5B14]"></div>
          </div>
          <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group flex-col items-start gap-2">
            <div className="w-full flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-blue-100 flex items-center justify-center text-blue-600"><Database className="w-4 h-4" /></div>
                <div>
                  <p className="text-sm font-bold text-[#1C1B1B]">ZenTao</p>
                  <p className="text-[11px] text-[#716B67]">4 {t('chat.integrations.active_tasks')}</p>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-[10px] font-extrabold text-[#716B67] uppercase tracking-widest mb-4">{t('chat.meta.title')}</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#716B67]">{t('chat.meta.model')}</span>
            <span className="text-xs font-bold text-[#1C1B1B] flex items-center gap-1">{activeDisplayName} <BadgeCheck className="w-3 h-3 text-[#EC5B14]" /></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#716B67]">{t('chat.meta.tokens')}</span>
            <span className="text-xs font-mono font-bold text-[#1C1B1B]">{totalUsage.totalTokens > 0 ? totalUsage.totalTokens.toLocaleString() : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#716B67]">{t('chat.meta.review_mode')}</span>
            <span className="bg-[#EC5B14]/10 text-[#EC5B14] px-2 py-0.5 rounded-full text-[10px] font-bold">{t('chat.meta.strict')}</span>
          </div>
        </div>
      </div>
      <div className="mt-auto pointer-events-none opacity-40 grayscale">
        <div className="relative rounded-[16px] overflow-hidden aspect-square border border-[#E8E4E2]/50">
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAr81NID_90Yy5CvYiCWyQuR_y9N_VafML_ttYyYtfSjf9jKr6XGdQbphqaCw1RNRV7cXKmhd7mCGXKD7zFngPrXo_X9rsn5SOJ_Zm33YJYNwgHgqAMynf0rzM6r8fHecJFgX3JfJUo09Gcb_tYo4uzHiM9j8dPiCGm-gia9TTdnFa3LGPxoKpBvdM0OACh_MqUpC0qNufnob3xIDqaVuMh5orjOJfsmCRQRTUQlwwnBkvCyMbhVztwLZqJMRJuxsJODFHj3ECVE40" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F6F3F2] to-transparent"></div>
          <div className="relative h-full p-5 flex flex-col justify-end">
            <p className="text-[10px] font-bold text-[#716B67] uppercase tracking-widest mb-1.5">{t('chat.weekly_insight.title')}</p>
            <p className="text-sm font-bold text-[#1C1B1B] leading-snug">{t('chat.weekly_insight.content')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
