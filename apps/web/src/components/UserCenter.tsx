import React, { useState, useEffect } from 'react';
import {
  ChevronRight, Sun, Moon, Globe,
  User, Edit2, CreditCard, Key,
  Plus, MoreVertical, TerminalSquare, Rocket, MonitorSmartphone,
  Save, ShieldCheck, RefreshCw, LogOut, Shield, Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { PermissionManager } from './PermissionManager';
import { api } from '../lib/api-client';

export function UserCenter({ token, onLogout }: { token: string | null; onLogout?: () => void }) {
  const { t, i18n } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('general');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // Form states
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedInstructions, setEditedInstructions] = useState('');

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<any>('/api/user/profile');
      if (data.success) {
        setUserProfile(data.profile);
        setEditedName(data.profile.name || '');
        setEditedEmail(data.profile.email || '');
        setEditedInstructions(data.profile.preferences?.customInstructions || '');
      }
    } catch (err: any) {
      console.error('Failed to fetch profile:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (updates: any) => {
    setSaveStatus('saving');
    try {
      await api.patch('/api/user/preferences', updates);
      
      // If theme changed, apply it immediately to UI
      if (updates.theme) {
        document.documentElement.classList.remove('light', 'dark');
        if (updates.theme !== 'system') {
          document.documentElement.classList.add(updates.theme);
        }
      }

      setSaveStatus('success');
      fetchProfile(); // Refresh
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('idle');
      console.error('Failed to update preferences:', err.message);
    }
  };

  const handleSaveProfile = async () => {
    setSaveStatus('saving');
    try {
      await api.patch('/api/user/profile', {
        name: editedName,
        email: editedEmail,
      });
      setSaveStatus('success');
      fetchProfile();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('idle');
      console.error('Failed to update profile:', err.message);
    }
  };

  const addCredential = async (systemType: string, tokenVal: string, username: string) => {
    try {
      await api.post('/api/user/credentials', { systemType, token: tokenVal, username });
      fetchProfile();
    } catch (err: any) {
      console.error('Failed to add credential:', err.message);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await api.get<any>('/api/user/profile');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uclaw-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (err: any) {
      console.error('Export failed:', err.message);
    }
  };

  const handleDeleteConversations = async () => {
    if (!confirm(t('user_center.billing.confirm_delete', 'Are you sure you want to delete all conversations? This cannot be undone.'))) return;
    try {
      await api.delete('/api/sessions/all');
      fetchProfile();
      alert(t('user_center.billing.delete_success', 'All conversations deleted.'));
    } catch (err: any) {
      console.error('Delete failed:', err.message);
    }
  };

  if (isLoading && !userProfile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FCF9F8]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-[#EC5B14] animate-spin" />
          <span className="text-[#716B67] font-bold tracking-widest text-[10px] uppercase">{t('user_center.common.syncing')}</span>
        </div>
      </div>
    );
  }

  const preferredModel = userProfile?.preferences?.defaultModel || 'deepseek-v3';
  const currentTheme = userProfile?.preferences?.theme || 'light';

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#FCF9F8]">
      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8 scroll-smooth no-scrollbar text-foreground">
        <header className="mb-12 max-w-4xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-[#EC5B14]/10 text-[#EC5B14] text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">{t('user_center.member_center')}</span>
            <span className="text-[#E8E4E2]">•</span>
            <span className="text-[#716B67] text-[10px] font-bold uppercase tracking-widest">{t('user_center.common.id_label')}{userProfile?.workId}</span>
          </div>
          <h2 className="text-4xl font-display font-extrabold tracking-tight text-foreground mb-2 text-balance lg:max-w-2xl">
            {t('user_center.welcome')}<span className="text-[#EC5B14]">{userProfile?.name || 'Alex'}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl">{t('user_center.welcome_desc')}</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl pb-20">
          
          {/* Left Column: Navigation */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex flex-col space-y-1">
              {[
                { id: 'general', label: t('user_center.tabs.general'), icon: MonitorSmartphone },
                { id: 'instructions', label: 'Custom Instructions', icon: Sparkles },
                { id: 'permissions', label: 'Permissions', icon: Shield },
                { id: 'profile', label: t('user_center.tabs.profile'), icon: User },
                { id: 'integrations', label: t('user_center.tabs.integrations'), icon: Key },
                { id: 'billing', label: t('user_center.tabs.billing'), icon: CreditCard },
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all group",
                    activeSubTab === tab.id 
                      ? "bg-card text-[#EC5B14] shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-border/50 font-bold" 
                      : "text-muted-foreground font-semibold hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className={cn("w-4 h-4", activeSubTab === tab.id ? "text-[#EC5B14]" : "text-muted-foreground group-hover:text-foreground")} />
                    {tab.label}
                  </div>
                  <ChevronRight className={cn("w-4 h-4 transition-transform", activeSubTab === tab.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
                </button>
              ))}
            </div>

          </div>

          {/* Right Column: Dynamic Content */}
          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {activeSubTab === 'general' && (
              <>
                <section className="md:col-span-2 bg-card border border-border/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-8 rounded-[32px] space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#EC5B14]/10 p-2 rounded-lg text-[#EC5B14]">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-bold tracking-tight text-foreground">{t('user_center.general.title')}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t('user_center.general.default_model')}</label>
                        <select
                          value={preferredModel}
                          onChange={(e) => updatePreferences({ defaultModel: e.target.value })}
                          className="w-full bg-muted border border-transparent focus:bg-card focus:border-border/50 rounded-xl px-4 py-3 text-sm font-bold text-foreground outline-none transition-all cursor-pointer"
                        >
                          <option value="deepseek-v3">{t('user_center.models.deepseek_v3')}</option>
                          <option value="qwen-turbo">{t('user_center.models.qwen_turbo')}</option>
                          <option value="gpt-4o-mini">{t('user_center.models.gpt4o_mini')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t('user_center.general.appearance')}</label>
                        <div className="flex gap-2 p-1.5 bg-muted rounded-2xl border border-border/50">
                          <button 
                            onClick={() => updatePreferences({ theme: 'light' })}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-bold text-sm",
                              currentTheme === 'light' ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Sun className="w-4 h-4" /> {t('user_center.general.appearance_light')}
                          </button>
                          <button 
                            onClick={() => updatePreferences({ theme: 'dark' })}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-bold text-sm",
                              currentTheme === 'dark' ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Moon className="w-4 h-4" /> {t('user_center.general.appearance_dark')}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t('user_center.general.language')}</label>
                        <select
                          value={i18n.language?.startsWith('zh') ? 'zh' : 'en'}
                          onChange={(e) => updatePreferences({ language: e.target.value })}
                          className="w-full bg-muted border border-transparent focus:bg-card focus:border-border/50 rounded-xl px-4 py-3 text-sm font-bold text-foreground outline-none transition-all cursor-pointer"
                        >
                          <option value="zh">{t('user_center.general.lang_zh')}</option>
                          <option value="en">{t('user_center.general.lang_en')}</option>
                        </select>
                      </div>
                      <div className="p-5 bg-[#EC5B14]/5 rounded-[24px] border border-[#EC5B14]/10">
                        <p className="text-[11px] font-bold text-[#EC5B14] mb-1 leading-relaxed">{t('user_center.general.sync_enabled')}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{t('user_center.general.sync_desc')}</p>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeSubTab === 'instructions' && (
              <section className="md:col-span-2 bg-card border border-border/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-10 rounded-[32px] space-y-8">
                <div className="flex items-center gap-3">
                  <div className="bg-[#EC5B14]/10 p-2 rounded-lg text-[#EC5B14]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">Custom Instructions</h3>
                </div>
                
                <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
                  {t('user_center.instructions.desc', 'Give uClaw specific instructions on how you want it to behave and respond. These will be applied to every new conversation.')}
                </p>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t('user_center.instructions.label', 'How should uClaw respond?')}
                    </label>
                    <textarea 
                      value={editedInstructions}
                      onChange={(e) => setEditedInstructions(e.target.value)}
                      placeholder={t('user_center.instructions.placeholder', 'e.g. \"Answer professionally in Chinese. Focus on legal compliance and code quality. Use California law standards for IP discussions.\"')}
                      className="w-full h-48 p-5 bg-muted border border-transparent focus:bg-card focus:border-border/50 rounded-[24px] text-[14px] font-medium text-foreground outline-none transition-all resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => updatePreferences({ customInstructions: editedInstructions })}
                    disabled={saveStatus === 'saving'}
                    className="flex items-center gap-2 px-6 py-3 bg-foreground text-background text-sm font-bold rounded-xl shadow-lg hover:bg-black active:scale-95 transition-all disabled:opacity-50"
                  >
                    {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-[#EC5B14]" />}
                    {saveStatus === 'saving' ? t('user_center.general.applying') : t('user_center.general.save_changes')}
                  </button>
                </div>
              </section>
            )}

            {activeSubTab === 'permissions' && (
              <section className="md:col-span-2">
                <PermissionManager token={token} />
              </section>
            )}

            {activeSubTab === 'profile' && (
              <section className="bg-card border md:col-span-2 border-border/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-10 rounded-[32px] space-y-8">
                 <div className="flex items-center gap-6">
                    <div className="relative w-24 h-24">
                      <img alt={t('user_center.identity.edit_avatar')} className="w-full h-full rounded-3xl object-cover border-4 border-card shadow-xl shadow-[#000]/5" src={userProfile?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuA0oS2KtsdNSGQoheV6v31oxAq-NhwZzQ47xg8__EJhv8OqGKGnZL3wep9OPHmM8x2Ik6mpZYLUp_nlIoldi6DXVNzDnTDsq10ls1jkUj-t_evdmGKwkn_t5xfFRgHK6-mmcStkVS-zdI45IF3rmBL3mH9KmAB8N9AvKqU-Dv45N0-NNrOIrD2ZlsGh9MmfkPMjEPcNRAJQVNa20KRYE9eY-Svv7Taq6vVmmqM9HxckuxqA9UWUSYJjawCeP6JhTrR_2ym5Y9kmaeo"} />
                      <button className="absolute -bottom-2 -right-2 bg-card p-2 rounded-xl shadow-lg border border-border">
                        <Edit2 className="w-4 h-4 text-[#EC5B14]" />
                      </button>
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-foreground">{userProfile?.name}</h4>
                      <p className="text-muted-foreground font-semibold mt-1 uppercase tracking-widest text-[10px]">{userProfile?.department || t('user_center.identity.department')}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('user_center.identity.work_id')}</label>
                      <p className="p-3 bg-muted rounded-xl font-mono text-sm font-bold text-foreground">{userProfile?.workId}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('user_center.identity.name')}</label>
                      <input 
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="w-full p-3 bg-muted border border-transparent focus:bg-card focus:border-border/50 rounded-xl text-sm font-bold text-foreground outline-none transition-all"
                        placeholder={t('user_center.identity.name_placeholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('user_center.identity.email')}</label>
                      <input 
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        className="w-full p-3 bg-muted border border-transparent focus:bg-card focus:border-border/50 rounded-xl text-sm font-bold text-foreground outline-none transition-all"
                        placeholder={t('user_center.identity.email_placeholder')}
                      />
                    </div>
                 </div>

                 <div className="flex justify-end pt-4">
                    <button 
                      onClick={handleSaveProfile}
                      disabled={saveStatus === 'saving'}
                      className="flex items-center gap-2 px-6 py-3 bg-foreground text-background text-sm font-bold rounded-xl shadow-lg hover:bg-black active:scale-95 transition-all disabled:opacity-50"
                    >
                      {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-[#EC5B14]" />}
                      {saveStatus === 'saving' ? t('user_center.general.applying') : t('user_center.general.save_changes')}
                    </button>
                 </div>
              </section>
            )}

            {activeSubTab === 'integrations' && (
              <section className="md:col-span-2 bg-card border border-border/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-10 rounded-[32px] space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-foreground">{t('user_center.integrations.title')}</h3>
                  <button 
                    onClick={() => {
                       const token = prompt(t('user_center.common.prompt_zentao'));
                       if (token) addCredential('zentao', token, 'admin');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#EC5B14] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#EC5B14]/20"
                  >
                    <Plus className="w-4 h-4" /> {t('user_center.integrations.add')}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userProfile?.credentials?.map((cred: any) => (
                    <div key={cred.id} className="p-5 bg-muted border border-border/50 rounded-[24px] hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                            cred.systemType === 'zentao' ? "bg-[#00ACEE]/10 text-[#00ACEE]" : "bg-[#FC6D26]/10 text-[#FC6D26]"
                          )}>
                            {cred.systemType === 'zentao' ? <Rocket className="w-6 h-6" /> : <TerminalSquare className="w-6 h-6" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground uppercase tracking-tight">{cred.systemType}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">{t('user_center.common.user_label')}{cred.username}</p>
                          </div>
                        </div>
                        <span className="bg-green-500/10 text-green-500 text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">{t('user_center.integrations.active')}</span>
                      </div>
                      <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                        <code className="text-xs font-mono text-muted-foreground">••••••••••••{cred.id.slice(-4)}</code>
                        <button className="text-[10px] font-black text-[#EC5B14] uppercase hover:underline">{t('user_center.integrations.settings')}</button>
                      </div>
                    </div>
                  ))}
                  {(!userProfile?.credentials || userProfile.credentials.length === 0) && (
                    <div className="md:col-span-2 py-12 border-2 border-dashed border-border rounded-[32px] flex flex-col items-center justify-center">
                       <Rocket className="w-10 h-10 text-border mb-3" />
                       <p className="text-sm font-bold text-muted-foreground">{t('user_center.integrations.empty')}</p>
                       <p className="text-[10px] text-muted-foreground/70 mt-1">{t('user_center.integrations.empty_desc')}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeSubTab === 'billing' && (
               <section className="bg-card border border-border/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-10 rounded-[32px] space-y-8 md:col-span-2 text-foreground">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#EC5B14]/10 p-2 rounded-lg text-[#EC5B14]">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">Usage & Billing</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-muted rounded-[24px]">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Total Sessions</p>
                       <p className="text-2xl font-bold">{userProfile?.stats?.sessionCount || 0}</p>
                    </div>
                    <div className="p-6 bg-muted rounded-[24px]">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Messages Sent</p>
                       <p className="text-2xl font-bold">{userProfile?.stats?.messageCount || 0}</p>
                    </div>
                    <div className="p-6 bg-[#EC5B14] text-white rounded-[32px] flex flex-col items-center justify-center text-center shadow-xl shadow-[#EC5B14]/20">
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">{t('user_center.usage.plan')}</p>
                       <p className="text-xl font-bold">{t('user_center.usage.pro_plan')}</p>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-border flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4">
                      <button 
                        onClick={handleDeleteConversations}
                        className="px-6 py-2.5 rounded-full text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors uppercase tracking-widest border border-red-200"
                      >
                        Delete All Chats
                      </button>
                      <button 
                        onClick={handleExportData}
                        className="px-6 py-2.5 rounded-full text-[11px] font-bold text-muted-foreground hover:text-foreground bg-card border border-border hover:bg-muted transition-all shadow-sm uppercase tracking-widest"
                      >
                        Export My Data (.JSON)
                      </button>
                    </div>
                  </div>
               </section>
            )}

            {/* Bottom Floating Bar */}
            {activeSubTab === 'general' && (
              <div className="md:col-span-2 flex items-center justify-end pt-8">
                  <button 
                    onClick={() => updatePreferences({})}
                    className="flex items-center gap-3 px-8 py-4 bg-foreground text-background font-bold rounded-2xl shadow-xl hover:opacity-90 active:scale-95 transition-all"
                  >
                    {saveStatus === 'saving' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 text-[#EC5B14]" />}
                    {saveStatus === 'saving' ? t('user_center.general.applying') : saveStatus === 'success' ? t('user_center.general.saved') : t('user_center.general.save_changes')}
                  </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
