import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2, Rocket, GitPullRequest, MessageSquare,
  Star, Box, Mail, Loader2, Sparkles, LayoutGrid, Server
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
import { MCPServerManager } from './MCPServerManager';

type Category = 'all' | 'pm' | 'cicd' | 'vc' | 'communication' | 'data_science';
type SubTab = 'marketplace' | 'mcp';

interface SkillCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  source: string;
  version: string | null;
  author: string | null;
  license: string | null;
  isFeatured: boolean;
  isPublic: boolean;
  icon: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  CheckCircle2: <CheckCircle2 className="w-6 h-6" />,
  Rocket: <Rocket className="w-6 h-6" />,
  GitPullRequest: <GitPullRequest className="w-6 h-6" />,
  MessageSquare: <MessageSquare className="w-6 h-6" />,
  Box: <Box className="w-6 h-6" />,
  Mail: <Mail className="w-6 h-6" />,
};

const ICON_STYLE_MAP: Record<string, { bg: string; color: string }> = {
  CheckCircle2: { bg: 'bg-orange-50', color: 'text-[#EC5B14]' },
  Rocket: { bg: 'bg-blue-50', color: 'text-blue-600' },
  GitPullRequest: { bg: 'bg-red-50', color: 'text-red-500' },
  MessageSquare: { bg: 'bg-purple-50', color: 'text-purple-600' },
  Box: { bg: 'bg-sky-50', color: 'text-sky-500' },
  Mail: { bg: 'bg-emerald-50', color: 'text-emerald-600' },
};

const SOURCE_LABEL_KEYS: Record<string, string> = {
  'openclaw-hub': 'library.source_labels.openclaw_hub',
  'claude-code': 'library.source_labels.claude_code',
  'git': 'library.source_labels.git',
  'local': 'library.source_labels.local',
  'internal': 'library.source_labels.internal',
};

export function SkillLibrary({ token }: { token?: string | null }) {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('marketplace');
  const [activeFilter, setActiveFilter] = useState<Category>('all');
  const [skills, setSkills] = useState<SkillCard[]>([]);
  const [stats, setStats] = useState({ total: 0, newThisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const initialFetchRef = React.useRef(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const installingRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (activeSubTab !== 'marketplace') return;
    // 切换筛选时先显示骨架屏
    if (!initialFetchRef.current) {
      setLoading(true);
    }
    initialFetchRef.current = false;

    const fetchData = async () => {
      const start = Date.now();
      try {
        const [skillsData, statsData] = await Promise.all([
          api.get<any>(`/api/skills${activeFilter !== 'all' ? `?category=${activeFilter}` : ''}`),
          api.get<any>('/api/skills/stats'),
        ]);
        
        setSkills(skillsData.data || []);
        setStats(statsData.data || { total: 0, newThisWeek: 0 });

        // Fetch installation status for each skill
        const skillIds = (skillsData.data || []).map((s: SkillCard) => s.id);
        const statusResults = await Promise.all(
          skillIds.map(async (id: string) => {
            try {
              const data = await api.get<any>(`/api/skills/${id}/install/status`);
              return { id, installed: data.data?.installed };
            } catch {
              return { id, installed: false };
            }
          }),
        );
        const installed = new Set(statusResults.filter((r: any) => r.installed).map((r: any) => r.id));
        setInstalledIds(installed);
      } catch (err) {
        console.error('Failed to fetch skills:', err);
      } finally {
        // 保证骨架屏至少显示 300ms
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, 300 - elapsed);
        await new Promise((resolve) => setTimeout(resolve, remaining));
        setLoading(false);
      }
    };
    fetchData();
  }, [activeFilter, token, activeSubTab]);

  const handleInstall = async (skillId: string) => {
    if (installingRef.current) return;
    installingRef.current = skillId;
    setInstallingId(skillId);

    try {
      const data = await api.post<any>(`/api/skills/${skillId}/install`);
      if (data.success) {
        setInstalledIds((prev) => new Set([...prev, skillId]));
      }
    } catch (err) {
      console.error('Install failed:', err);
    } finally {
      installingRef.current = null;
      setInstallingId(null);
    }
  };

  const handleUninstall = async (skillId: string) => {
    if (installingRef.current) return;
    installingRef.current = skillId;
    setInstallingId(skillId);

    try {
      const data = await api.delete<any>(`/api/skills/${skillId}/install`);
      if (data.success) {
        setInstalledIds((prev) => {
          const next = new Set(prev);
          next.delete(skillId);
          return next;
        });
      }
    } catch (err) {
      console.error('Uninstall failed:', err);
    } finally {
      installingRef.current = null;
      setInstallingId(null);
    }
  };

  const filters: { id: Category; label: string }[] = [
    { id: 'all', label: t('library.filters.all') },
    { id: 'pm', label: t('library.filters.pm') },
    { id: 'cicd', label: t('library.filters.cicd') },
    { id: 'vc', label: t('library.filters.vc') },
    { id: 'communication', label: t('library.filters.communication') },
    { id: 'data_science', label: t('library.filters.data_science') },
  ];

  const subTabs = [
    { id: 'marketplace', label: t('library.common.skillset'), icon: LayoutGrid },
    { id: 'mcp', label: 'MCP Servers', icon: Server },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#fcf9f8] p-10 font-sans text-[#1c1b1b] relative pb-32">
      <div className="max-w-[1400px] mx-auto w-full">
        
        {/* Hero Section */}
        <section className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <h2 className="font-display text-4xl font-extrabold tracking-tight text-[#1c1b1b]">
                {t('library.title')} <span className="text-[#a33800]">{t('library.v3')}</span>
              </h2>
              
              {/* Tab Switcher integrated into title row */}
              <div className="flex bg-[#F6F3F2] p-1 rounded-xl gap-0.5 ml-2">
                {subTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as SubTab)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      activeSubTab === tab.id
                        ? "bg-white text-[#EC5B14] shadow-sm"
                        : "text-[#716B67] hover:text-[#1C1B1B]"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[#716B67] max-w-xl text-[17px] leading-relaxed">
              {activeSubTab === 'marketplace' ? t('library.subtitle') : 'Configure and monitor your Model Context Protocol connectors.'}
            </p>
          </div>
          {activeSubTab === 'marketplace' && (
            <div className="flex flex-wrap gap-2">
              <span className="bg-[#ffdbce] text-[#783112] px-3 py-1 rounded-full text-xs font-bold">
                {t('library.stats.total_skills', { count: stats.total })}
              </span>
              <span className="bg-[#ebe7e7] text-[#5a4138] px-3 py-1 rounded-full text-xs font-bold">
                {t('library.stats.new_this_week', { count: stats.newThisWeek })}
              </span>
            </div>
          )}
        </section>

        {activeSubTab === 'marketplace' ? (
          <>
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-10 overflow-x-auto pb-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold transition-all duration-200",
                    activeFilter === filter.id 
                      ? "bg-[#EC5B14] text-white shadow-md transform scale-105" 
                      : "bg-[#F6F3F2] hover:bg-[#ebe7e7] text-[#716B67]"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Bento Grid Marketplace */}
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="skeletons"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
                >
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-6 rounded-2xl bg-[#F6F3F2]">
                      <div className="w-12 h-12 rounded-xl bg-[#E8E4E2] mb-6 animate-pulse" />
                      <div className="h-4 bg-[#E8E4E2] rounded w-3/4 mb-2 animate-pulse" />
                      <div className="h-3 bg-[#E8E4E2] rounded w-full mb-6 animate-pulse" />
                      <div className="flex justify-between mt-4">
                        <div className="h-3 bg-[#E8E4E2] rounded w-20 animate-pulse" />
                        <div className="h-6 bg-[#E8E4E2] rounded w-16 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <div key="cards" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  <AnimatePresence mode="popLayout">
                    {skills.map((card) => {
                      const iconEl = card.icon ? ICON_MAP[card.icon] : <Star className="w-6 h-6" />;
                      const iconStyle = card.icon ? ICON_STYLE_MAP[card.icon] : { bg: 'bg-gray-50', color: 'text-gray-500' };
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                          key={card.id}
                          className="group card-floating p-6 flex flex-col hover:shadow-2xl hover:shadow-[#EC5B14]/5 transition-all"
                        >
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-6", iconStyle.bg, iconStyle.color)}>
                            {iconEl}
                          </div>
                          <div className="flex-grow">
                            <h3 className="font-display font-bold text-lg mb-2 group-hover:text-[#EC5B14] transition-colors">{card.name}</h3>
                            <p className="text-[13px] text-[#716B67] leading-relaxed mb-6 font-medium">
                              {card.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#a8a19c]">
                              {t(SOURCE_LABEL_KEYS[card.source] || card.source)}
                            </span>
                            <button
                              onClick={() => installedIds.has(card.id) ? handleUninstall(card.id) : handleInstall(card.id)}
                              disabled={installingId === card.id}
                              className={cn(
                                "flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg transition-all text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed",
                                "w-28",
                                installedIds.has(card.id)
                                  ? "bg-[#EC5B14]/10 text-[#EC5B14] hover:bg-[#EC5B14]/20"
                                  : "text-[#EC5B14] hover:bg-[#EC5B14]/10"
                              )}
                            >
                              {installingId === card.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Loading</span>
                                </>
                              ) : installedIds.has(card.id) ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{t('library.actions.installed')}</span>
                                </>
                              ) : (
                                <span>{t('library.common.install')}</span>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Featured Slot */}
                    {activeFilter === 'all' && (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="md:col-span-2 bg-[#2E2825] p-8 rounded-[24px] flex flex-col md:flex-row gap-8 items-center overflow-hidden relative shadow-2xl"
                      >
                        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[#EC5B14] opacity-[0.15] blur-[80px] rounded-full pointer-events-none"></div>
                        <div className="relative z-10 flex-1">
                          <div className="inline-flex items-center gap-1.5 bg-[#EC5B14]/20 text-[#ffb599] px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-5">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            {t('library.featured.badge')}
                          </div>
                          <h3 className="font-display font-bold text-2xl text-white mb-3">{t('library.featured.title')}</h3>
                          <p className="text-[#D3CDC9] text-[14px] leading-relaxed mb-8">
                            {t('library.featured.desc')}
                          </p>
                          <button className="btn-kinetic px-6 py-2.5 rounded-xl text-sm font-bold hover:brightness-110 focus:outline-none">
                            {t('library.featured.button')}
                          </button>
                        </div>
                        <div className="w-full md:w-56 h-56 rounded-2xl overflow-hidden shadow-2xl relative z-10 shrink-0 bg-gradient-to-br from-[#403733] to-[#1C1B1B] border border-white/5 flex items-center justify-center">
                           <motion.div 
                             animate={{ rotate: 360 }}
                             transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                             className="absolute inset-0 opacity-30"
                             style={{ background: 'conic-gradient(from 0deg, transparent 0 340deg, #EC5B14 360deg)' }}
                           />
                           <div className="absolute inset-1 rounded-[14px] bg-[#2E2825] flex items-center justify-center p-4">
                              <div className="relative w-full h-full">
                                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#EC5B14] blur-sm opacity-50"></div>
                                 <Star className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-[#ffb599] z-10" />
                                 <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-blue-400"></div>
                                 <div className="absolute bottom-4 right-4 w-4 h-4 rounded-full bg-purple-400"></div>
                                 <div className="absolute top-6 right-8 w-2 h-2 rounded-full bg-green-400"></div>
                                 <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100">
                                    <line x1="20" y1="20" x2="50" y2="50" stroke="white" strokeWidth="1" />
                                    <line x1="80" y1="80" x2="50" y2="50" stroke="white" strokeWidth="1" />
                                    <line x1="70" y1="20" x2="50" y2="50" stroke="white" strokeWidth="1" />
                                 </svg>
                              </div>
                           </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="mt-4">
            <MCPServerManager token={token} hideHeader />
          </div>
        )}

      </div>
    </div>
  );
}
