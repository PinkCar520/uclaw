import React from 'react';
import { Cpu, Database, BadgeCheck, GitBranch, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { cn } from '../../lib/utils';

const ICON_MAP = {
  git: GitBranch,
  cpu: Cpu,
  database: Database,
};

export function IntegrationsPanel({
  t,
  activeDisplayName,
  totalUsage
}: {
  t: any;
  activeDisplayName: string;
  totalUsage: any;
}) {
  const { mcpMetrics, refresh, isLoading } = useWorkspace();

  return (
    <div className="p-6 flex flex-col gap-8 overflow-y-auto flex-1">
      {/* ── Layer 3: Capabilities (Active MCPs) ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-sm text-[#1C1B1B]">{t('chat.integrations.active_title')}</h4>
          <button 
            onClick={() => refresh()}
            disabled={isLoading}
            className="p-1.5 hover:bg-[#F6F3F2] rounded-lg transition-colors text-[#EC5B14]"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </button>
        </div>
        
        <div className="space-y-3">
          {mcpMetrics.length > 0 ? (
            mcpMetrics.map((mcp) => {
              const Icon = ICON_MAP[mcp.iconType] || Database;
              return (
                <div key={mcp.id} className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-[8px] flex items-center justify-center text-white",
                      mcp.id === 'gitlab' ? 'bg-[#1C1B1B]' : mcp.id === 'jenkins' ? 'bg-[#0E1529]' : 'bg-[#EC5B14]'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1C1B1B]">{mcp.name}</p>
                      <p className="text-[11px] text-[#716B67]">{mcp.count} {mcp.label}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    mcp.status === 'online' ? "bg-emerald-500" : "bg-red-500"
                  )}></div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center border border-dashed border-[#E8E4E2] rounded-xl">
              <p className="text-xs text-[#716B67] font-medium">无活跃集成</p>
            </div>
          )}
        </div>
      </div>

      {/* Meta Stats Section */}
      <div>
        <h4 className="text-[10px] font-extrabold text-[#716B67] uppercase tracking-widest mb-4">{t('chat.meta.title')}</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#716B67]">{t('chat.meta.model')}</span>
            <span className="text-xs font-bold text-[#1C1B1B] flex items-center gap-1">
              {activeDisplayName} <BadgeCheck className="w-3 h-3 text-[#EC5B14]" />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#716B67]">{t('chat.meta.tokens')}</span>
            <span className="text-xs font-mono font-bold text-[#1C1B1B]">
              {totalUsage.totalTokens > 0 ? totalUsage.totalTokens.toLocaleString() : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#716B67]">{t('chat.meta.review_mode')}</span>
            <span className="bg-[#EC5B14]/10 text-[#EC5B14] px-2 py-0.5 rounded-full text-[10px] font-bold">
              {t('chat.meta.strict')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
