import { api } from '../lib/api-client';
import React, { useState, useEffect } from 'react';
import { Monitor, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface NodeStatusIndicatorProps {
  token: string | null;
  isCollapsed?: boolean;
}

export function NodeStatusIndicator({ token, isCollapsed }: NodeStatusIndicatorProps) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;

    const checkStatus = async () => {
      try {
        const data = await api.get<any>('/api/user/node-status');
        setIsOnline(data.isOnline);
      } catch (err) {
        console.error('[NodeStatus] Failed to fetch status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [token]);

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#f6f3f2] flex items-center justify-center">
              <div className={cn(
                "w-full h-full rounded-full",
                isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-slate-300"
              )} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-xs font-bold">
              {isOnline ? 'CLI Node: Online' : 'CLI Node: Offline'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider transition-all",
            isOnline 
              ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
              : "bg-slate-50 border-slate-100 text-slate-400"
          )}>
            <Monitor className="w-2.5 h-2.5" />
            <span>{isOnline ? 'Node On' : 'Node Off'}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs font-medium">
            {isOnline 
              ? 'Local CLI node is connected and ready.' 
              : 'Start your local node with "uclaw daemon" to enable local execution.'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
