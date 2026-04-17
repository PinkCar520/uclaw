import React from 'react';
import { 
  Terminal,
  Zap, 
  Cpu, 
  ShieldCheck,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ActiveContextProps {
  context?: {
    workspace?: {
      name: string;
      branch: string;
      isClean: boolean;
      path?: string;
    };
    modelInfo?: {
      name: string;
      latency: string;
    };
    usage?: {
      totalTokens: number;
    };
    complianceMode?: string;
    suggestions?: string[];
  };
  onAction?: (action: string) => void;
}

export function ActiveContextPanel({ context, onAction }: ActiveContextProps) {
  const data = context || {};
  const workspace = data.workspace || {
    name: 'uClaw',
    branch: 'main',
    isClean: true
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-[#716B67] mb-2">
        <Terminal className="w-4 h-4" />
        <h2 className="text-xs font-bold tracking-widest uppercase">Workspace Context</h2>
      </div>

      {/* Workspace Card */}
      <div className="bg-[#FDFCFB] rounded-[24px] p-6 border border-[#F1EEEB] space-y-2 group hover:border-[#EC5B14]/30 transition-all duration-300">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[18px] font-bold truncate text-[#1C1B1B]">
              {workspace.name} 
              <span className="text-[#716B67] font-normal ml-1.5 text-[13px]">({workspace.path?.split('/').pop() || 'root'})</span>
            </h3>
            <span className="text-[10px] text-[#716B67] font-bold px-2 py-0.5 rounded-md bg-[#F6F3F2] border border-[#E8E4E2] tracking-tight">
              {workspace.branch}
            </span>
            {!workspace.isClean && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] text-orange-600 font-bold uppercase tracking-tighter">Modified</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#EC5B14] truncate mt-1.5 font-mono font-bold">{workspace.path || '~/workspace/uwork/uclaw'}</p>
        </div>
      </div>

      {/* Suggested Actions */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-[#716B67] uppercase tracking-widest">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            {data.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onAction?.(suggestion)}
                className="px-4 py-2 rounded-full bg-white border border-[#E8E4E2] text-[12px] font-bold text-[#1C1B1B] hover:border-[#EC5B14] hover:text-[#EC5B14] transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
