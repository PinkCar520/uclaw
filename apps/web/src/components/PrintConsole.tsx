import { Printer, FileText, ShieldCheck, Droplets, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export interface PrintConsoleProps {
  printerName?: string;
  location?: string;
  status?: 'online' | 'offline' | 'busy';
  paperPercent?: number;
  paperTray?: string;
  inkLevels?: { c: number; m: number; y: number; k: number };
  documentName?: string;
  documentPages?: number;
  documentSize?: string;
  documentGenerated?: string;
  securityPass?: boolean;
  securityMessage?: string;
  onConfirmPrint?: () => void;
  onQuickAction?: (action: string) => void;
  quickActions?: string[];
}

export function PrintConsole({
  printerName = 'OfficeJet X-900',
  location = 'Floor 03',
  status = 'online',
  paperPercent = 92,
  paperTray = 'Tray 1: Loaded',
  inkLevels = { c: 85, m: 70, y: 90, k: 60 },
  documentName = 'Q4_Financial_Summary.pdf',
  documentPages = 12,
  documentSize = '4.2 MB',
  documentGenerated = '2h ago',
  securityPass = true,
  securityMessage = 'This document contains sensitive financial data. Printing is restricted to authorized 3rd floor personnel only.',
  onConfirmPrint,
  onQuickAction,
  quickActions = ['Adjust margins', 'Print double-sided', 'Change destination'],
}: PrintConsoleProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const statusColors: Record<string, string> = {
    online: 'text-emerald-500',
    offline: 'text-rose-500',
    busy: 'text-amber-500',
  };

  const inkColors: Record<string, string> = {
    c: 'bg-cyan-400',
    m: 'bg-pink-400',
    y: 'bg-yellow-400',
    k: 'bg-slate-800',
  };

  const handlePrint = () => {
    setIsPrinting(true);
    onConfirmPrint?.();
  };

  return (
    <div className="space-y-4 max-w-[520px]">
      {/* Main Card */}
      <div className="bg-white rounded-[20px] border border-[#E8E4E2] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-[#E8E4E2]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#F6F3F2] p-2 rounded-xl">
                <Printer className="w-5 h-5 text-[#1C1B1B]" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[#1C1B1B]">Print Console</h3>
                <p className="text-[12px] text-[#716B67] mt-0.5">
                  Destination: <span className="text-[#EC5B14] font-semibold">{location} • {printerName}</span>
                </p>
              </div>
            </div>
            {/* Status */}
            <span className={cn(
              "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full",
              status === 'online' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", statusColors[status])} />
              {status}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Ink Levels */}
            <div className="bg-[#F6F3F2] rounded-[14px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="w-3.5 h-3.5 text-[#716B67]" />
                <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em]">
                  Ink Levels
                </span>
              </div>
              <div className="flex justify-between mt-3">
                {(['c', 'm', 'y', 'k'] as const).map(color => (
                  <div key={color} className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-12 bg-white rounded-lg border border-[#E8E4E2] overflow-hidden relative">
                      <div
                        className={cn("absolute bottom-0 w-full rounded-b-lg transition-all", inkColors[color])}
                        style={{ height: `${inkLevels[color]}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[#716B67] uppercase">{color.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Paper Status */}
            <div className="bg-[#F6F3F2] rounded-[14px] p-4 flex flex-col items-center justify-center text-center">
              <FileText className="w-6 h-6 text-[#716B67]/50 mb-2" />
              <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em]">
                Paper Status
              </span>
              <span className="text-[24px] font-bold text-[#1C1B1B] mt-1">{paperPercent}%</span>
              <span className="text-[11px] text-emerald-600 font-medium">{paperTray}</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="px-6 pb-6">
          <button
            onClick={handlePrint}
            disabled={isPrinting || status !== 'online'}
            className={cn("btn-cta", isPrinting && "opacity-60")}
          >
            <Printer className="w-4 h-4" />
            {isPrinting ? 'Printing...' : 'Confirm Print'}
          </button>
        </div>
      </div>

      {/* Document Preview Card */}
      <div className="bg-white rounded-[20px] border border-[#E8E4E2] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em] block mb-3">
          Document Preview
        </span>
        {/* Placeholder image area */}
        <div className="aspect-video bg-gradient-to-br from-[#1C1B1B]/80 to-[#1C1B1B] rounded-[12px] mb-4 flex items-center justify-center overflow-hidden">
          <FileText className="w-12 h-12 text-white/20" />
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-[13px] font-bold text-[#1C1B1B]">{documentName}</h4>
            <p className="text-[11px] text-[#716B67] mt-1">
              {documentPages} Pages • {documentSize} • Generated {documentGenerated}
            </p>
          </div>
        </div>

        {/* Security Pass */}
        {securityPass && (
          <div className="mt-4 bg-[#F6F3F2] rounded-[12px] p-4 flex gap-3">
            <div className="shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-[#EC5B14]" />
            </div>
            <div>
              <span className="text-[12px] font-bold text-[#1C1B1B]">Security Pass</span>
              <p className="text-[11px] text-[#716B67] mt-1 leading-relaxed">{securityMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => onQuickAction?.(action)}
            className="btn-quick-action"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
