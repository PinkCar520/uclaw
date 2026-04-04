import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, Sun, Moon, Globe, 
  User, Edit2, CreditCard, Key, 
  Plus, MoreVertical, TerminalSquare, Rocket, MonitorSmartphone,
  Save, ShieldCheck, RefreshCw, LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';

export function UserCenter({ onLogout }: { onLogout?: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState('general');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // Load token from local storage
  const token = localStorage.getItem('uclaw_auth_token');

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': localStorage.getItem('uclaw_user_id') || ''
        }
      });
      const data = await res.json();
      if (data.success) {
        setUserProfile(data.profile);
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (updates: any) => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': localStorage.getItem('uclaw_user_id') || ''
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setSaveStatus('success');
        fetchProfile(); // Refresh
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch (e) {
      setSaveStatus('idle');
    }
  };

  const addCredential = async (systemType: string, tokenVal: string, username: string) => {
    try {
      await fetch('/api/user/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': localStorage.getItem('uclaw_user_id') || ''
        },
        body: JSON.stringify({ systemType, token: tokenVal, username })
      });
      fetchProfile();
    } catch (e) {
      console.error('Failed to add credential');
    }
  };

  if (isLoading && !userProfile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FCF9F8]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-[#EC5B14] animate-spin" />
          <span className="text-[#716B67] font-bold tracking-widest text-[10px] uppercase">Synchronizing User Assets...</span>
        </div>
      </div>
    );
  }

  const preferredModel = userProfile?.preferences?.defaultModel || 'deepseek-v3';

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#FCF9F8]">
      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8 scroll-smooth no-scrollbar">
        <header className="mb-12 max-w-4xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-[#EC5B14]/10 text-[#EC5B14] text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">Member Center</span>
            <span className="text-[#E8E4E2]">•</span>
            <span className="text-[#716B67] text-[10px] font-bold uppercase tracking-widest">ID: {userProfile?.workId}</span>
          </div>
          <h2 className="text-4xl font-display font-extrabold tracking-tight text-[#1C1B1B] mb-2 text-balance lg:max-w-2xl">
            Welcome back, <span className="text-[#EC5B14]">{userProfile?.name || 'Alex'}</span>
          </h2>
          <p className="text-[#716B67] text-lg max-w-2xl">Manage your enterprise identity, AI model preferences, and productivity integrations.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl pb-20">
          
          {/* Left Column: Navigation */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex flex-col space-y-1">
              {[
                { id: 'general', label: 'General Settings', icon: MonitorSmartphone },
                { id: 'profile', label: 'Identity Profile', icon: User },
                { id: 'integrations', label: 'Connectors & Keys', icon: Key },
                { id: 'billing', label: 'Usage & Quota', icon: CreditCard },
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all group",
                    activeSubTab === tab.id 
                      ? "bg-white text-[#EC5B14] shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-[#E8E4E2]/50 font-bold" 
                      : "text-[#716B67] font-semibold hover:bg-[#F6F3F2] hover:text-[#1C1B1B]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className={cn("w-4 h-4", activeSubTab === tab.id ? "text-[#EC5B14]" : "text-[#716B67] group-hover:text-[#1C1B1B]")} />
                    {tab.label}
                  </div>
                  <ChevronRight className={cn("w-4 h-4 transition-transform", activeSubTab === tab.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
                </button>
              ))}
            </div>

            <div className="pt-6 mt-6 border-t border-[#E8E4E2]/50">
               <button 
                 onClick={onLogout}
                 className="flex items-center gap-3 px-4 py-3 w-full text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors"
                >
                 <LogOut className="w-4 h-4" />
                 Sign Out
               </button>
            </div>
          </div>

          {/* Right Column: Dynamic Content */}
          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {activeSubTab === 'general' && (
              <>
                <section className="md:col-span-2 bg-white border border-[#E8E4E2]/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-8 rounded-[32px] space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#EC5B14]/10 p-2 rounded-lg text-[#EC5B14]">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-bold tracking-tight text-[#1C1B1B]">Platform Preferences</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#716B67] mb-3">Default AI Model</label>
                        <select 
                          value={preferredModel}
                          onChange={(e) => updatePreferences({ defaultModel: e.target.value })}
                          className="w-full bg-[#f6f3f2] border border-transparent focus:bg-white focus:border-[#E8E4E2]/50 rounded-xl px-4 py-3 text-sm font-bold text-[#1C1B1B] outline-none transition-all cursor-pointer"
                        >
                          <option value="deepseek-v3">DeepSeek V3 (Default)</option>
                          <option value="qwen-turbo">Qwen Turbo</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#716B67] mb-3">App Appearance</label>
                        <div className="flex gap-2 p-1.5 bg-[#F6F3F2] rounded-2xl border border-[#E8E4E2]/50">
                          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white rounded-xl shadow-sm font-bold text-sm text-[#1C1B1B]">
                            <Sun className="w-4 h-4" /> Light
                          </button>
                          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[#716B67] font-bold text-sm">
                            <Moon className="w-4 h-4" /> Dark
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#716B67] mb-3">Primary Language</label>
                        <select className="w-full bg-[#f6f3f2] border border-transparent focus:bg-white focus:border-[#E8E4E2]/50 rounded-xl px-4 py-3 text-sm font-bold text-[#1C1B1B] outline-none transition-all cursor-pointer">
                          <option>Chinese (Simplified)</option>
                          <option>English (International)</option>
                        </select>
                      </div>
                      <div className="p-5 bg-[#EC5B14]/5 rounded-[24px] border border-[#EC5B14]/10">
                        <p className="text-[11px] font-bold text-[#EC5B14] mb-1 leading-relaxed">Auto-Sync Enabled</p>
                        <p className="text-[11px] text-[#716B67] leading-relaxed">Your preferences are automatically synced across CLI, Web, and IM bots.</p>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeSubTab === 'profile' && (
              <section className="bg-white border md:col-span-2 border-[#E8E4E2]/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-10 rounded-[32px] space-y-8">
                 <div className="flex items-center gap-6">
                    <div className="relative w-24 h-24">
                      <img alt="Avatar" className="w-full h-full rounded-3xl object-cover border-4 border-white shadow-xl shadow-[#000]/5" src={userProfile?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuA0oS2KtsdNSGQoheV6v31oxAq-NhwZzQ47xg8__EJhv8OqGKGnZL3wep9OPHmM8x2Ik6mpZYLUp_nlIoldi6DXVNzDnTDsq10ls1jkUj-t_evdmGKwkn_t5xfFRgHK6-mmcStkVS-zdI45IF3rmBL3mH9KmAB8N9AvKqU-Dv45N0-NNrOIrD2ZlsGh9MmfkPMjEPcNRAJQVNa20KRYE9eY-Svv7Taq6vVmmqM9HxckuxqA9UWUSYJjawCeP6JhTrR_2ym5Y9kmaeo"} />
                      <button className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg border border-[#E8E4E2]">
                        <Edit2 className="w-4 h-4 text-[#EC5B14]" />
                      </button>
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-[#1C1B1B]">{userProfile?.name}</h4>
                      <p className="text-[#716B67] font-semibold mt-1 uppercase tracking-widest text-[10px]">{userProfile?.department || 'R&D Department'}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#716B67]">Work ID</label>
                      <p className="p-3 bg-[#F6F3F2] rounded-xl font-mono text-sm font-bold text-[#1C1B1B]">{userProfile?.workId}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#716B67]">Email</label>
                      <p className="p-3 bg-[#F6F3F2] rounded-xl text-sm font-bold text-[#1C1B1B]">{userProfile?.email || 'alex@uclaw.ai'}</p>
                    </div>
                 </div>
              </section>
            )}

            {activeSubTab === 'integrations' && (
              <section className="md:col-span-2 bg-white border border-[#E8E4E2]/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-10 rounded-[32px] space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[#1C1B1B]">Active Connectors</h3>
                  <button 
                    onClick={() => {
                       const token = prompt('Enter your ZenTao API Token:');
                       if (token) addCredential('zentao', token, 'admin');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#EC5B14] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#EC5B14]/20"
                  >
                    <Plus className="w-4 h-4" /> Add Integration
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userProfile?.credentials?.map((cred: any) => (
                    <div key={cred.id} className="p-5 bg-[#F6F3F2] border border-[#E8E4E2]/50 rounded-[24px] hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                            cred.systemType === 'zentao' ? "bg-[#00ACEE]/10 text-[#00ACEE]" : "bg-[#FC6D26]/10 text-[#FC6D26]"
                          )}>
                            {cred.systemType === 'zentao' ? <Rocket className="w-6 h-6" /> : <TerminalSquare className="w-6 h-6" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#1C1B1B] uppercase tracking-tight">{cred.systemType}</p>
                            <p className="text-[10px] font-bold text-[#716B67]">User: {cred.username}</p>
                          </div>
                        </div>
                        <span className="bg-green-500/10 text-green-500 text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">ACTIVE</span>
                      </div>
                      <div className="pt-4 border-t border-[#E8E4E2]/50 flex items-center justify-between">
                        <code className="text-xs font-mono text-[#716B67]">••••••••••••{cred.id.slice(-4)}</code>
                        <button className="text-[10px] font-black text-[#EC5B14] uppercase hover:underline">Settings</button>
                      </div>
                    </div>
                  ))}
                  {(!userProfile?.credentials || userProfile.credentials.length === 0) && (
                    <div className="md:col-span-2 py-12 border-2 border-dashed border-[#E8E4E2] rounded-[32px] flex flex-col items-center justify-center">
                       <Rocket className="w-10 h-10 text-[#E8E4E2] mb-3" />
                       <p className="text-sm font-bold text-[#716B67]">No systems connected yet</p>
                       <p className="text-[10px] text-[#716B67]/70 mt-1">Connect ZenTao or GitLab to enable AI task orchestration</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeSubTab === 'billing' && (
               <section className="bg-white border border-[#E8E4E2]/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-10 rounded-[32px] space-y-8 md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-[#f6f3f2] rounded-[24px]">
                       <p className="text-[10px] font-black text-[#716B67] uppercase tracking-widest mb-4">Storage Used</p>
                       <p className="text-2xl font-bold text-[#1C1B1B]">1.2 <span className="text-sm text-[#716B67]">GB</span></p>
                       <div className="w-full h-1.5 bg-[#E8E4E2] rounded-full mt-4 overflow-hidden">
                          <div className="w-[12%] h-full bg-[#EC5B14]"></div>
                       </div>
                    </div>
                    <div className="p-6 bg-[#f6f3f2] rounded-[24px]">
                       <p className="text-[10px] font-black text-[#716B67] uppercase tracking-widest mb-4">Tokens Consumed</p>
                       <p className="text-2xl font-bold text-[#1C1B1B]">84 <span className="text-sm text-[#716B67]">k</span></p>
                       <div className="w-full h-1.5 bg-[#E8E4E2] rounded-full mt-4 overflow-hidden">
                          <div className="w-[45%] h-full bg-[#EC5B14]"></div>
                       </div>
                    </div>
                    <div className="p-6 bg-[#EC5B14] text-white rounded-[32px] flex flex-col items-center justify-center text-center shadow-xl shadow-[#EC5B14]/20">
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Plan Details</p>
                       <p className="text-xl font-bold">Pro Enterprise</p>
                       <button className="mt-4 bg-white/20 hover:bg-white/30 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all">Upgrade Plan</button>
                    </div>
                  </div>
               </section>
            )}

            {/* Bottom Floating Bar */}
            {activeSubTab === 'general' && (
              <div className="md:col-span-2 flex items-center justify-end pt-8">
                  <button 
                    onClick={() => updatePreferences({})}
                    className="flex items-center gap-3 px-8 py-4 bg-[#1C1B1B] text-white font-bold rounded-2xl shadow-xl hover:bg-[#000] active:scale-95 transition-all"
                  >
                    {saveStatus === 'saving' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 text-[#EC5B14]" />}
                    {saveStatus === 'saving' ? 'Applying...' : saveStatus === 'success' ? 'Settings Saved!' : 'Save Hub Changes'}
                  </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
