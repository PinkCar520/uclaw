import React, { useState } from 'react';
import { 
  Sparkles, Mail, Lock, User, 
  ArrowRight, Globe, CheckCircle2, 
  AlertCircle, ShieldCheck, Cpu, Database, Fingerprint
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import { api } from '../lib/api-client';

interface AuthPageProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login' 
      ? { email, password } 
      : { email, password, name };

    try {
      const data = await api.post<any>(endpoint, body);
      onLoginSuccess(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#faf9f8]">
      
      {/* ── Background Aesthetics ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#EC5B14]/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#EC5B14]/5 rounded-full blur-[100px]" />
        
        {/* Subtle Grid */}
        <div className="absolute inset-0 opacity-[0.03] grayscale invert" 
             style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="flex min-h-full items-start justify-center px-3 py-4 sm:items-center sm:p-4">
        <div className="relative flex w-full max-w-[1100px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] backdrop-blur-3xl lg:h-[720px] lg:flex-row lg:rounded-[40px]">
        
        {/* ── Left Side: Brand & Visuals ── */}
        <div className="relative hidden flex-1 overflow-hidden bg-[#1C1B1B] p-12 lg:flex lg:flex-col">
          {/* Visual Accents */}
          <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/10 rounded-full" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/10 rounded-full" />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3">
              <div className="bg-[#EC5B14] p-2 rounded-[12px] shadow-[0_8px_16px_rgba(236,91,20,0.3)]">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-display font-black text-white tracking-tight">uClaw</span>
            </div>

            <div className="mt-auto">
              <h1 className="text-5xl font-display font-extrabold text-white leading-[1.1] tracking-tight mb-6">
                <Trans i18nKey="auth.hero_title">
                  Orchestrating <br/> <span className="text-[#EC5B14]">Enterprise AI</span> <br/> Intelligence.
                </Trans>
              </h1>
              <p className="text-white/60 text-lg leading-relaxed max-w-sm mb-10 font-medium">
                {t('auth.hero_desc')}
              </p>

              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <ShieldCheck className="w-5 h-5 text-[#EC5B14] mb-2" />
                    <p className="text-[11px] font-bold text-white uppercase tracking-widest">{t('auth.security')}</p>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <Database className="w-5 h-5 text-[#EC5B14] mb-2" />
                    <p className="text-[11px] font-bold text-white uppercase tracking-widest">{t('auth.knowledge')}</p>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Side: Auth Form ── */}
        <div className="relative flex flex-1 flex-col items-center px-4 py-6 sm:p-8 md:p-10 lg:items-stretch lg:flex-[0.8] lg:p-16">
          <div className="mx-auto flex w-full max-w-[320px] flex-1 flex-col sm:max-w-[348px] lg:mx-0 lg:max-w-none">
          
          <div className="mb-8 w-full text-center lg:mb-10 lg:text-left">
            <h2 className="text-2xl font-display font-black text-[#1C1B1B] sm:text-3xl">
              {mode === 'login' ? t('auth.login_title') : t('auth.register_title')}
            </h2>
            <p className="mt-2 text-base font-medium text-[#716B67] sm:text-lg">
              {mode === 'login' 
                ? t('auth.login_desc') 
                : t('auth.register_desc')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4 sm:space-y-5">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1.5"
                >
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#716B67] ml-1">{t('auth.name_label')}</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B67] transition-colors group-focus-within:text-[#EC5B14]" />
                    <input 
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={t('auth.name_placeholder')}
                      className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#f6f3f2] border-2 border-transparent focus:bg-white focus:border-[#EC5B14]/20 outline-none transition-all font-bold text-[#1C1B1B]"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#716B67] ml-1">{t('auth.email_label')}</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B67] transition-colors group-focus-within:text-[#EC5B14]" />
                <input 
                  type="text"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('auth.email_placeholder')}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#f6f3f2] border-2 border-transparent focus:bg-white focus:border-[#EC5B14]/20 outline-none transition-all font-bold text-[#1C1B1B]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#716B67]">{t('auth.password_label')}</label>
                {mode === 'login' && <button type="button" className="text-[10px] font-bold text-[#EC5B14] hover:underline uppercase tracking-wider">{t('auth.forgot_password')}</button>}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B67] transition-colors group-focus-within:text-[#EC5B14]" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('auth.password_placeholder')}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#f6f3f2] border-2 border-transparent focus:bg-white focus:border-[#EC5B14]/20 outline-none transition-all font-bold text-[#1C1B1B]"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="group h-14 w-full rounded-2xl bg-[#1C1B1B] py-3 font-bold text-white shadow-[0_12px_24px_rgba(0,0,0,0.15)] transition-all active:scale-[0.98] hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'login' ? t('auth.sign_in_button') : t('auth.create_account_button')}</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-6 w-full sm:mt-8">
            <div className="relative flex items-center py-4 sm:py-5">
              <div className="flex-grow border-t border-[#E8E4E2]"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-[#716B67] uppercase tracking-widest">{t('auth.continue_with')}</span>
              <div className="flex-grow border-t border-[#E8E4E2]"></div>
            </div>

            <div className="flex w-full flex-col gap-3">
               <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#E8E4E2] bg-white px-4 text-sm font-bold text-[#1C1B1B] transition-colors hover:bg-[#F6F3F2]">
                 <Globe className="h-4 w-4 shrink-0 text-[#EC5B14]" />
                 <span className="whitespace-nowrap">{t('auth.sso_portal')}</span>
               </button>
               <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#E8E4E2] bg-white px-4 text-sm font-bold text-[#1C1B1B] transition-colors hover:bg-[#F6F3F2]">
                 <Fingerprint className="h-4 w-4 shrink-0 text-[#EC5B14]" />
                 <span className="whitespace-nowrap">{t('auth.bio_logic')}</span>
               </button>
            </div>
          </div>

          <div className="w-full pt-8 text-center lg:mt-auto">
            <p className="text-sm font-medium text-[#716B67]">
              {mode === 'login' ? t('auth.no_account') : t('auth.have_account')}{' '}
              <button 
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-[#EC5B14] font-bold hover:underline"
              >
                {mode === 'login' ? t('auth.sign_up') : t('auth.sign_in')}
              </button>
            </p>
          </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
