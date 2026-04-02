import React from 'react';
import { 
  X, Cpu, Globe, Terminal, 
  GitBranch, Activity, Plus,
  Shield, Zap, Radio, CheckCircle2,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  if (!isOpen) return null;

  const mcpServers = [
    { id: 'zentao', name: 'ZenTao MCP Server', icon: Globe, status: 'online', color: 'text-blue-500', desc: t('skills.tools.zentao.desc'), version: 'v1.2.0' },
    { id: 'local_fs', name: 'Filesystem MCP', icon: Terminal, status: 'online', color: 'text-blue-500', desc: t('skills.tools.local_fs.desc'), version: 'v3.0.1' },
    { id: 'gitlab', name: 'GitLab Connector', icon: GitBranch, status: 'standby', color: 'text-slate-400', desc: t('skills.tools.gitlab.desc'), version: 'v2.4.0' },
    { id: 'jenkins', name: 'Jenkins Master', icon: Activity, status: 'offline', color: 'text-slate-300', desc: t('skills.tools.jenkins.desc'), version: 'v0.9.5' },
  ];

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('zh') ? 'en' : 'zh';
    i18n.changeLanguage(nextLang);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
        />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-[32px] overflow-hidden flex flex-col max-h-[85vh]"
        >
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl text-white">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t('settings.title')}</h2>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">{t('settings.mcp_desc')}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-10">
            
            {/* 1. Language Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 px-1">
                <Languages className="w-4 h-4 text-indigo-500" />
                Language Settings
              </h3>
              <div className="flex p-1 bg-slate-100 rounded-2xl w-fit min-w-[240px]">
                <button 
                  onClick={() => i18n.changeLanguage('zh')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs font-bold transition-all",
                    i18n.language.startsWith('zh') ? "bg-white text-blue-600" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  简体中文
                </button>
                <button 
                  onClick={() => i18n.changeLanguage('en')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs font-bold transition-all",
                    i18n.language.startsWith('en') ? "bg-white text-blue-600" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  English
                </button>
              </div>
            </section>

            {/* 2. MCP Servers */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-500" />
                  Model Context Protocol (MCP)
                </h3>
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Gateway Connected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mcpServers.map((server) => (
                  <div key={server.id} className="group p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn("p-2 rounded-xl bg-white border border-slate-100", server.color)}>
                        <server.icon className="w-5 h-5" />
                      </div>
                      <div className={cn("w-2 h-2 rounded-full", 
                        server.status === 'online' ? "bg-emerald-500" : 
                        server.status === 'standby' ? "bg-amber-500" : "bg-slate-300"
                      )} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800">{server.name}</h4>
                      <p className="text-[11px] text-slate-500 leading-tight line-clamp-2">{server.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Security */}
            <section className="pt-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 px-1">
                <Shield className="w-4 h-4 text-emerald-500" />
                {t('settings.security')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: t('settings.encryption'), status: t('settings.active') },
                  { label: t('settings.sandbox'), status: t('settings.enabled') },
                  { label: t('settings.residency'), status: t('settings.verified') },
                ].map((item) => (
                  <div key={item.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.label}</span>
                    <span className="text-[11px] font-bold text-emerald-600">{item.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>UClaw Agent Core v1.1.0-alpha</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
              {t('settings.powered_by')}
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
