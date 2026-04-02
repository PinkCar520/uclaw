import React, { useState } from 'react';
import { 
  BarChart3, Users, CheckCircle2, AlertCircle, 
  GitBranch, Terminal, Activity, Zap,
  Briefcase, Target, ShieldCheck, Code2,
  TrendingUp, Clock, FileText, Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

type Persona = 'manager' | 'product' | 'developer' | 'qa';

export function Dashboard() {
  const { t } = useTranslation();
  const [activePersona, setActivePersona] = useState<Persona>('developer');
  
  // 1. 定义不同职位的核心统计数据
  const personaStats = {
    manager: [
      { label: 'Project Progress', value: '76%', change: '+2.4%', icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50' },
      { label: 'Resource Load', value: '82%', change: 'Stable', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
      { label: 'Budget Usage', value: '¥1.2M', change: '-5%', icon: Briefcase, color: 'text-emerald-500', bg: 'bg-emerald-50' },
      { label: 'Risk Alerts', value: '2', change: 'Urgent', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50' },
    ],
    product: [
      { label: 'Feature Completion', value: '14/20', change: '+2', icon: Target, color: 'text-orange-500', bg: 'bg-orange-50' },
      { label: 'Backlog Depth', value: '45', change: '+5', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
      { label: 'User Satisfaction', value: '4.8', change: 'Stable', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
      { label: 'Release Readiness', value: '92%', change: 'High', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    ],
    developer: [
      { label: t('dashboard.stats.total_bugs'), value: '12', change: '-2', icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
      { label: t('dashboard.stats.active_prs'), value: '5', change: '+1', icon: GitBranch, color: 'text-blue-500', bg: 'bg-blue-50' },
      { label: t('dashboard.stats.sys_health'), value: '98%', change: 'Stable', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-50' },
      { label: t('dashboard.stats.team_velocity'), value: '42', change: '+12%', icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    ],
    qa: [
      { label: 'Test Coverage', value: '88.5%', change: '+1.2%', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
      { label: 'Active Defects', value: '24', change: '-4', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50' },
      { label: 'Automation Rate', value: '65%', change: 'Stable', icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-50' },
      { label: 'Build Success', value: '94%', change: '+3%', icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50' },
    ]
  };

  const currentStats = personaStats[activePersona];

  return (
    <div className="p-8 space-y-10 overflow-y-auto h-full bg-[#F9FAFB]/50">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('nav.dashboard')}</h2>
          <p className="text-sm text-slate-500">{t('dashboard.desc')}</p>
        </div>

        {/* 2. 职位切换器 (Persona Switcher) */}
        <div className="flex p-1 bg-slate-200/50 rounded-2xl border border-slate-200 w-fit">
          {[
            { id: 'manager', label: 'Manager', icon: Briefcase },
            { id: 'product', label: 'Product', icon: Target },
            { id: 'developer', label: 'Developer', icon: Code2 },
            { id: 'qa', label: 'QA', icon: ShieldCheck },
          ].map((persona) => (
            <button
              key={persona.id}
              onClick={() => setActivePersona(persona.id as Persona)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                activePersona === persona.id 
                  ? "bg-white text-blue-600 border border-slate-200 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <persona.icon className="w-3.5 h-3.5" />
              {persona.label}
            </button>
          ))}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatePresence mode="wait">
          {currentStats.map((stat, i) => (
            <motion.div
              key={`${activePersona}-${stat.label}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-6 rounded-3xl border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2.5 rounded-2xl", stat.bg)}>
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  stat.change.startsWith('+') ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                  stat.change.startsWith('-') ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-500 border-slate-200"
                )}>
                  {stat.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* 动态内容区 (根据职位展示不同的大卡片) */}
        <div className="xl:col-span-2 bg-white rounded-[32px] border border-slate-200 p-8 min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
               <BarChart3 className="w-4 h-4 text-blue-500" />
               {activePersona === 'manager' ? 'Delivery Timeline' : 
                activePersona === 'product' ? 'Requirement Heatmap' : 
                activePersona === 'qa' ? 'Defect Convergence' : t('dashboard.throughput')}
            </h3>
          </div>
          
          <div className="flex flex-col items-center justify-center h-64 text-center">
             {/* 占位图表 */}
             <div className="w-full h-full flex items-end justify-around gap-4 px-4">
                {[45, 60, 40, 80, 55, 90, 70, 85, 50, 65, 75, 95].map((h, i) => (
                  <motion.div 
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 1 }}
                    className="w-full max-w-[20px] bg-blue-100 rounded-t-lg relative group"
                  >
                    <div className="absolute inset-0 bg-blue-500 rounded-t-lg scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom duration-300 opacity-20" />
                  </motion.div>
                ))}
             </div>
             <p className="text-xs text-slate-400 mt-6 font-medium">
               {activePersona === 'manager' ? 'Cumulative project deliverables over time' : 
                activePersona === 'product' ? 'Feature priority and stakeholder interest' : 
                activePersona === 'qa' ? 'Stability trend across active builds' : t('dashboard.chart_desc')}
             </p>
          </div>
        </div>

        {/* 右侧小面板 */}
        <div className="bg-white rounded-[32px] border border-slate-200 p-8">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
             {activePersona === 'manager' ? <Users className="w-4 h-4 text-indigo-500" /> : <Terminal className="w-4 h-4 text-emerald-500" />}
             {activePersona === 'manager' ? 'Team Distribution' : t('dashboard.nodes')}
          </h3>
          <div className="space-y-6">
            {activePersona === 'manager' ? (
              ['Frontend Team', 'Backend Team', 'Cloud Infra'].map(team => (
                <div key={team} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-700">{team}</span>
                    <span className="text-[10px] font-mono text-blue-600">85% Utilization</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[85%]" />
                  </div>
                </div>
              ))
            ) : (
              [
                { name: 'PinkCar', status: 'Online', load: '12%', color: 'bg-emerald-500' },
                { name: 'BlueDragon', status: 'Standby', load: '2%', color: 'bg-blue-400' },
                { name: 'RedHawk', status: 'Offline', load: '0%', color: 'bg-slate-300' }
              ].map(node => (
                <div key={node.name} className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", node.color)} />
                      <span className="text-sm font-bold text-slate-700">{node.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{node.status}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className={cn("h-full", node.color)} style={{ width: node.load }} />
                  </div>
                </div>
              ))
            )}
          </div>
          <button className="w-full mt-8 py-3 rounded-xl border border-slate-200 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">
            {activePersona === 'manager' ? 'Export Report' : t('dashboard.manage_nodes')}
          </button>
        </div>
      </div>
    </div>
  );
}
