import React, { useState, useEffect } from 'react';
import { 
  Activity, Cpu, HardDrive, Database, 
  Terminal as TerminalIcon, Search, Maximize2, 
  Play, StopCircle, RefreshCw, ChevronRight, Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

export function NodeMonitor() {
  const { t } = useTranslation();
  const [terminalLines, setTerminalLines] = useState<string[]>([
    'Initializing UClaw CLI Node...',
    'Connection established with PinkCar (192.168.1.105)',
    'Ready for commands.'
  ]);

  const metrics = [
    { label: t('node.metrics.cpu'), value: '12%', icon: Cpu, color: 'text-blue-500' },
    { label: t('node.metrics.ram'), value: '4.2GB / 16GB', icon: Database, color: 'text-emerald-500' },
    { label: t('node.metrics.disk'), value: '128GB / 512GB', icon: HardDrive, color: 'text-amber-500' },
    { label: t('node.metrics.uptime'), value: '12d 4h 32m', icon: Clock, color: 'text-indigo-500' },
  ];

  const processes = [
    { pid: 1204, name: 'node uclaw-daemon.js', cpu: '1.2%', mem: '142MB' },
    { pid: 842, name: 'git status', cpu: '0.1%', mem: '12MB' },
    { pid: 2105, name: 'npm run watch', cpu: '4.5%', mem: '320MB' },
  ];

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full bg-[#F9FAFB]/50">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('node.title')}</h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">Online</span>
          </div>
          <p className="text-sm text-slate-500">PinkCar • Darwin ARM64 • Node.js v20.11.0</p>
        </div>
        <div className="flex gap-3">
          <button className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[11px] font-bold uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2">
            <StopCircle className="w-4 h-4" />
            Terminate Node
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
          <motion.div 
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <m.icon className={cn("w-4 h-4", m.color)} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</span>
            </div>
            <div className="text-xl font-bold text-slate-900">{m.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Terminal Area */}
        <div className="xl:col-span-2 flex flex-col h-[500px]">
          <div className="bg-slate-900 rounded-t-[32px] border-x border-t border-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 ml-2">
              <TerminalIcon className="w-4 h-4 text-blue-400" />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t('node.terminal')}</span>
            </div>
            <div className="flex gap-1.5 mr-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            </div>
          </div>
          <div className="flex-1 bg-slate-950 border-x border-slate-800 p-6 font-mono text-[13px] leading-relaxed overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            {terminalLines.map((line, i) => (
              <div key={i} className="flex gap-3 text-slate-300">
                <span className="text-slate-600 select-none">$</span>
                <span>{line}</span>
              </div>
            ))}
            <div className="flex gap-3 items-center text-blue-400 mt-2">
              <span className="text-slate-600 select-none">$</span>
              <motion.div 
                animate={{ opacity: [1, 0] }} 
                transition={{ duration: 0.8, repeat: Infinity }} 
                className="w-2 h-5 bg-blue-500 rounded-sm"
              />
              <span className="text-slate-700 italic text-xs">{t('node.terminal_placeholder')}</span>
            </div>
          </div>
          <div className="bg-slate-900 rounded-b-[32px] border-x border-b border-slate-800 p-3 flex items-center gap-4">
             <div className="flex-1 bg-white/5 rounded-xl border border-white/10 px-4 py-1.5 flex items-center gap-3 group focus-within:border-blue-500/50 transition-all">
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                <input 
                  placeholder="Type a command..." 
                  className="bg-transparent border-none text-[13px] text-slate-200 w-full focus:outline-none focus:ring-0 placeholder:text-slate-600"
                />
             </div>
             <button className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all">
                <Play className="w-4 h-4 fill-current" />
             </button>
          </div>
        </div>

        {/* Process List */}
        <div className="bg-white rounded-[32px] border border-slate-200 p-8 flex flex-col h-[500px]">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
             <Activity className="w-4 h-4 text-blue-500" />
             {t('node.processes')}
          </h3>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            {processes.map(proc => (
              <div key={proc.pid} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-blue-200 hover:bg-white transition-all cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{proc.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">PID {proc.pid}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    CPU {proc.cpu}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    MEM {proc.mem}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-3 rounded-xl border border-slate-200 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">
            {t('node.logs')}
          </button>
        </div>
      </div>
    </div>
  );
}
