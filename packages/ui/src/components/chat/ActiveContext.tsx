import React from 'react';
import { 
  Terminal,
  Zap, 
  Cpu, 
  ShieldCheck,
  Activity,
  GitBranch,
  FolderOpen,
  Wallet,
  Scale,
  Users,
  Briefcase,
  Plus
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useWorkspace, type ProjectCategory } from '../../contexts/WorkspaceContext';

const DOMAIN_CONFIG: Record<ProjectCategory, { label: string; icon: any; color: string; bgColor: string; pathLabel: string; branchLabel: string }> = {
  Engineering: { label: '当前工作区', icon: GitBranch, color: 'text-blue-600', bgColor: 'bg-blue-50', pathLabel: '工作区目录', branchLabel: '当前版本/分支' },
  Finance: { label: '当前工作区', icon: Wallet, color: 'text-emerald-600', bgColor: 'bg-emerald-50', pathLabel: '本地资料库', branchLabel: '当前账期' },
  Legal: { label: '当前工作区', icon: Scale, color: 'text-purple-600', bgColor: 'bg-purple-50', pathLabel: '本地卷宗库', branchLabel: '合规版本' },
  HR: { label: '当前工作区', icon: Users, color: 'text-orange-600', bgColor: 'bg-orange-50', pathLabel: '本地资源库', branchLabel: '招聘批次' },
  Operations: { label: '当前工作区', icon: Briefcase, color: 'text-sky-600', bgColor: 'bg-sky-50', pathLabel: '运营数据归档', branchLabel: '业务周期' },
  Default: { label: '当前工作区', icon: Terminal, color: 'text-slate-600', bgColor: 'bg-slate-50', pathLabel: '本地工作区', branchLabel: '当前状态' },
};

export function ActiveContextPanel({ onAction }: { onAction?: (action: string) => void }) {
  const { activeProject, node, suggestedActions } = useWorkspace();
  
  const domain = DOMAIN_CONFIG[activeProject?.category || 'Default'];
  const Icon = domain.icon;

  const handleSwitchProject = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  const projectPathMatch = activeProject?.description?.match(/\(path:(.*?)\)/);
  const displayPath = projectPathMatch ? projectPathMatch[1] : (node.currentPath !== '—' ? node.currentPath : '未绑定本地目录');

  return (
    <div className="flex flex-col h-full p-6 space-y-8">
      {/* ── Layer 1: Identity (Who & Why) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#716B67]">
            <Icon className={cn("w-4 h-4", domain.color)} />
            <h2 className="text-xs font-bold tracking-widest uppercase">{domain.label}</h2>
          </div>
          {activeProject && (
            <button 
              onClick={handleSwitchProject}
              className="text-[10px] font-bold text-[#EC5B14] hover:underline uppercase tracking-tighter"
            >
              切换项目
            </button>
          )}
        </div>

        <div className={cn(
          "bg-[#FDFCFB] rounded-[24px] p-6 border border-[#F1EEEB] space-y-4 group transition-all duration-300 relative overflow-hidden",
          !activeProject ? "border-dashed border-[#E8E4E2] bg-white flex flex-col items-center justify-center py-10" : "hover:border-[#EC5B14]/30"
        )}>
          {/* Privacy Shield Background Watermark */}
          {activeProject && (
            <ShieldCheck className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500/5 rotate-12" />
          )}

          {!activeProject ? (
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F6F3F2] flex items-center justify-center mb-4 text-[#A8A4A1]">
                <FolderOpen className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[#1C1B1B] mb-1">未激活工作空间</p>
              <p className="text-[11px] text-[#716B67] mb-6 px-4">请选择一个项目以同步业务领域与执行规范</p>
              <button 
                onClick={handleSwitchProject}
                className="bg-[#1C1B1B] text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-[#1C1B1B]/80 transition-all flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                选择项目
              </button>
            </div>
          ) : (
            <>
              <div className="min-w-0 relative z-10">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-[18px] font-bold truncate text-[#1C1B1B]">
                    {activeProject?.name} 
                  </h3>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-tight", domain.bgColor, domain.color, "border-current/10")}>
                    {activeProject.category}
                  </span>
                </div>
                <p className="text-[12px] text-[#716B67] leading-relaxed line-clamp-2">
                  {activeProject?.description?.split('(path:')[0] || '正在为您提供专属的业务编排与智能协作支持。'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#F1EEEB] relative z-10">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">本地隐私保护模式</span>
                </div>
                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100">已开启</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Layer 2: Environment (Where & How) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#716B67]">
            <Activity className="w-4 h-4" />
            <h2 className="text-xs font-bold tracking-widest uppercase">环境状态</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", node.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-tighter">
              {node.isOnline ? '助手已连接' : '等待启动'}
            </span>
          </div>
        </div>

        <div className="bg-[#FDFCFB] rounded-[24px] p-5 space-y-4 relative overflow-hidden group border border-[#F1EEEB]">
          <div className="space-y-3 relative z-10">
            <div className="flex items-start gap-3">
              <FolderOpen className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#A8A4A1] uppercase tracking-widest mb-0.5">{domain.pathLabel}</p>
                <p className="text-[12px] font-medium truncate text-[#1C1B1B]">{displayPath}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#A8A4A1] uppercase tracking-widest mb-0.5">{domain.branchLabel}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold text-[#1C1B1B] truncate">{node.currentBranch || '默认'}</p>
                  {!node.isClean && (
                    <span className="text-[10px] text-orange-600 font-bold uppercase tracking-tighter bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">有待处理变更</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {node.isOnline && (
            <div className="pt-4 border-t border-[#F1EEEB] relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-[#A8A4A1] uppercase tracking-widest">系统工作负载</span>
                <span className="text-[10px] font-bold text-emerald-600 tracking-tighter flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5" />
                  稳定运行中
                </span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-[#A8A4A1] uppercase tracking-tighter">
                    <span>处理性能</span>
                    <span>{node.cpuUsage}%</span>
                  </div>
                  <div className="h-1 bg-[#E8E4E2] rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${node.cpuUsage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggested Actions (Domain Driven) */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-[#716B67] uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3 h-3 text-[#EC5B14]" />
          智能辅助指令
        </h4>
        <div className="flex flex-wrap gap-2">
          {suggestedActions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => onAction?.(suggestion)}
              className="px-4 py-1.5 rounded-full bg-white border border-[#E8E4E2] text-[11px] font-bold text-[#1C1B1B] hover:border-[#EC5B14] hover:text-[#EC5B14] hover:shadow-sm transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
