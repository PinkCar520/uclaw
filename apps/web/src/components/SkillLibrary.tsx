import React, { useState } from 'react';
import { 
  Cpu, GitPullRequest, Workflow, HardDrive, 
  Search, Sliders, ToggleLeft, ToggleRight,
  ShieldCheck, AlertCircle, Settings2, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

type Skill = {
  id: string;
  name: string;
  category: 'devops' | 'code' | 'productivity' | 'system';
  icon: any;
  isEnabled: boolean;
  isConfigured: boolean;
  version: string;
};

export function SkillLibrary() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [skills, setSkills] = useState<Skill[]>([
    { id: 'zentao', name: 'ZenTao Connector', category: 'productivity', icon: AlertCircle, isEnabled: true, isConfigured: true, version: '1.2.0' },
    { id: 'gitlab', name: 'GitLab Integrator', category: 'code', icon: GitPullRequest, isEnabled: true, isConfigured: true, version: '2.4.5' },
    { id: 'jenkins', name: 'Jenkins Master', category: 'devops', icon: Workflow, isEnabled: false, isConfigured: true, version: '0.9.1' },
    { id: 'local_fs', name: 'File System SDK', category: 'system', icon: HardDrive, isEnabled: true, isConfigured: false, version: '3.0.0' },
  ]);

  const categories = ['all', 'devops', 'code', 'productivity', 'system'];

  const filteredSkills = skills.filter(skill => {
    const matchesCategory = activeCategory === 'all' || skill.category === activeCategory;
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleSkill = (id: string) => {
    setSkills(skills.map(s => s.id === id ? { ...s, isEnabled: !s.isEnabled } : s));
  };

  return (
    <div className="p-10 space-y-8 overflow-y-auto h-full bg-[#F9FAFB]/50">
      <header className="flex flex-col gap-1 max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('skills.title')}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{t('skills.desc')}</p>
      </header>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-6 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all",
                activeCategory === cat 
                  ? "bg-blue-600 text-white" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              {t(`skills.categories.${cat}`)}
            </button>
          ))}
        </div>

        <div className="relative group flex-1 max-w-xs">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..." 
            className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 ring-blue-500/5 focus:border-blue-500/50 transition-all"
          />
        </div>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredSkills.map((skill, i) => (
            <motion.div
              layout
              key={skill.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              className={cn(
                "group bg-white border border-slate-200 rounded-[32px] p-8 flex flex-col transition-all hover:border-blue-300 relative",
                !skill.isEnabled && "opacity-75 grayscale-[0.5]"
              )}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-8">
                <div className={cn(
                  "p-4 rounded-[24px] border border-slate-100",
                  skill.isEnabled ? "bg-blue-50/50" : "bg-slate-50"
                )}>
                  <skill.icon className={cn("w-6 h-6", skill.isEnabled ? "text-blue-600" : "text-slate-400")} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button 
                    onClick={() => toggleSkill(skill.id)}
                    className="p-1"
                  >
                    {skill.isEnabled ? (
                      <ToggleRight className="w-8 h-8 text-blue-600 fill-blue-50" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-200" />
                    )}
                  </button>
                  <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">v{skill.version}</span>
                </div>
              </div>

              {/* Card Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{skill.name}</h3>
                  {skill.isConfigured && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  {t(`skills.tools.${skill.id}.desc`)}
                </p>
              </div>

              {/* Card Footer */}
              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t(`skills.categories.${skill.category}`)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest">
                    <Settings2 className="w-3.5 h-3.5" />
                    {t('skills.status.configure')}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
