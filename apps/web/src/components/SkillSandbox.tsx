import React, { useState } from 'react';
import { api } from '../lib/api-client';
import { Play, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function SkillSandbox({ activeSkill }: { activeSkill: any }) {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTest = async () => {
    if (!message.trim()) return;
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      // Create a test payload with the current skill force-injected
      const payload = {
        message: message,
        skill_ids: activeSkill.id ? [activeSkill.id] : []
      };

      // Call the FastAPI resolve endpoint directly or via gateway if available.
      // We know FastAPI runs on 8000 but the frontend goes through /api
      // /api/internal/skills/resolve is for internal nestjs, but let's see if we have a direct test route.
      // For now, let's just hit the FastAPI route directly if we can, or we assume there's a proxy.
      // Actually we have `/api/internal/skills/resolve` which takes `message` and `skill_ids`
      
      const res = await api.post('/api/internal/skills/resolve', payload);
      setResult(res);
    } catch (err: any) {
      console.error('Sandbox error', err);
      setError(err.message || 'Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-4 border-b border-[#E8E4E2] bg-white flex items-center justify-between shadow-sm z-10">
        <h3 className="font-bold text-[#1C1B1B] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#EC5B14]" />
          Sandbox Testing
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[#716B67] uppercase tracking-wider">Test Message</label>
          <div className="relative">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. 帮我分析这个报错..."
              className="w-full border border-[#E8E4E2] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30 min-h-[100px] resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleTest();
                }
              }}
            />
            <div className="absolute bottom-3 right-3">
              <button
                onClick={handleTest}
                disabled={isLoading || !message.trim()}
                className="bg-[#1C1B1B] text-white p-2 rounded-lg hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center gap-1 text-xs font-bold"
              >
                {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
                Run
              </button>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs font-bold text-[#716B67] uppercase tracking-wider">Result</label>
          <div className="flex-1 bg-[#1C1B1B] rounded-xl p-4 overflow-y-auto border border-[#E8E4E2] text-white font-mono text-xs shadow-inner">
            {error && (
              <div className="text-red-400 flex items-start gap-2">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-all">{error}</span>
              </div>
            )}
            
            {!error && !result && !isLoading && (
              <div className="text-[#A8A4A1] flex h-full items-center justify-center italic">
                Press Run (⌘+Enter) to test skill injection
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-green-400 font-bold border-b border-white/10 pb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Successfully resolved skills
                </div>
                
                <div>
                  <div className="text-[#A8A4A1] mb-1">Matched Skills:</div>
                  <div className="flex gap-2">
                    {result.matched_skills?.length > 0 ? result.matched_skills.map((id: string) => (
                      <span key={id} className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-[10px]">{id}</span>
                    )) : (
                      <span className="text-yellow-500/70">No skills matched</span>
                    )}
                  </div>
                </div>

                {result.injected_prompt && (
                  <div>
                    <div className="text-[#A8A4A1] mb-1">Injected System Prompt:</div>
                    <div className="bg-black/30 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap text-emerald-300">
                      {result.injected_prompt}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
