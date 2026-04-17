import React from 'react';
import { 
  Plus, FileText, X as CloseIcon, 
  ChevronDown, Paperclip, ArrowUp, Square, Globe, Database, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { beautifyModelName } from '../../lib/chat-utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

interface ChatInputProps {
  localInput: string;
  setLocalInput: (val: string) => void;
  selectedFiles: File[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  isModelDropdownOpen: boolean;
  setIsModelDropdownOpen: (val: boolean) => void;
  isSearchMode: boolean;
  setIsSearchMode: (val: boolean) => void;
  isKnowledgeMode: boolean;
  setIsKnowledgeMode: (val: boolean) => void;
  onFormSubmit: (e?: any) => void;
  handleStop: () => void;
  isLoading: boolean;
  models: any[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  t: any;
}

export function ChatInput({
  localInput,
  setLocalInput,
  selectedFiles,
  setSelectedFiles,
  isModelDropdownOpen,
  setIsModelDropdownOpen,
  isSearchMode,
  setIsSearchMode,
  isKnowledgeMode,
  setIsKnowledgeMode,
  onFormSubmit,
  handleStop,
  isLoading,
  models,
  selectedModelId,
  setSelectedModelId,
  textAreaRef,
  t,
}: ChatInputProps) {
  const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Globe, color: 'text-slate-400' };
  const activeDisplayName = beautifyModelName(activeModel.name);

  return (
    <div className="pt-2 pb-4 md:pb-8 px-4 md:px-8 bg-gradient-to-t from-[#FCF9F8] via-[#FCF9F8] to-transparent z-10 w-full mt-auto">
      <div className="max-w-[800px] mx-auto relative">
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-2 flex flex-col shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-[#1C1B1B]/5 transition-all focus-within:outline-none">
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="flex flex-wrap gap-2 px-2 pb-2 mb-2 border-b border-[#E8E4E2]/40"
              >
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-[#F6F3F2] rounded-xl border border-[#E8E4E2]/60 group relative transition-all hover:border-[#EC5B14]/30">
                    <FileText className="w-3.5 h-3.5 text-[#EC5B14]" />
                    <span className="text-[11px] font-bold text-[#1C1B1B] max-w-[120px] truncate">{file.name}</span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white text-[#716B67] hover:text-red-500 transition-colors">
                      <CloseIcon className="w-3 3" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex flex-col">
            <textarea
              ref={textAreaRef}
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onFormSubmit();
                }
              }}
              placeholder={t('chat.placeholder', 'Ask anything...')}
              className="w-full bg-transparent border-none focus:ring-0 text-[15px] text-[#1C1B1B] placeholder:text-[#A8A4A1] py-3 px-4 resize-none min-h-[44px] max-h-[200px] leading-relaxed"
              rows={1}
            />
          </div>

          <div className="flex items-center justify-between px-2 sm:px-4 pb-2">
            <div className="flex items-center gap-0.5 sm:gap-1.5 overflow-hidden">
              <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-[#716B67] hover:bg-[#eeece9] transition-all border border-transparent hover:border-[#E8E4E2]/40 shrink-0">
                    <activeModel.icon className={cn("w-4 h-4 shrink-0", activeModel.color)} />
                    <span className="text-[10px] sm:text-[11px] font-bold tracking-tight max-w-[60px] sm:max-w-none truncate">{activeDisplayName}</span>
                    <ChevronDown className={cn("w-3 h-3 transition-transform shrink-0", isModelDropdownOpen ? "rotate-180" : "")} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60 border-[#E8E4E2] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-2xl p-1.5 backdrop-blur-xl bg-white/90">
                  <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase text-[#716B67] tracking-widest">{t('chat.available_models')}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#E8E4E2]/40" />
                  <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                    {models.map((m) => {
                      const displayName = beautifyModelName(m.name);
                      return (
                        <DropdownMenuItem key={m.id} onClick={() => setSelectedModelId(m.id)} className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all mb-0.5 hover:bg-[#eeece9]">
                          <div className="flex items-center gap-3">
                            <div className={cn("flex items-center justify-center w-8 h-8", m.color)}>
                              <m.icon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[14px] font-bold text-[#1C1B1B]">{displayName}</span>
                              <span className="text-[11px] text-[#716B67] font-medium">{m.provider}</span>
                            </div>
                          </div>
                          {selectedModelId === m.id && <Check className="w-4 h-4 text-[#EC5B14] shrink-0" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="w-px h-4 bg-[#E8E4E2]/60 mx-1 shrink-0" />
              
              <button 
                onClick={() => { 
                  const input = document.createElement('input'); 
                  input.type = 'file'; 
                  input.multiple = true; 
                  input.onchange = (e: any) => { 
                    if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]); 
                  }; 
                  input.click(); 
                }} 
                className="p-1.5 sm:p-2 rounded-lg text-[#716B67] hover:bg-[#eeece9] hover:text-[#1C1B1B] transition-all shrink-0"
              >
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={() => setIsSearchMode(!isSearchMode)}
                className={cn(
                  "p-1.5 sm:p-2 rounded-lg transition-all transform active:scale-95 shrink-0",
                  isSearchMode
                    ? "text-[#EC5B14] bg-[#EC5B14]/5"
                    : "text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14]"
                )}
              >
                <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={() => setIsKnowledgeMode(!isKnowledgeMode)}
                className={cn(
                  "p-1.5 sm:p-2 rounded-lg transition-all transform active:scale-95 shrink-0",
                  isKnowledgeMode
                    ? "text-[#EC5B14] bg-[#EC5B14]/5"
                    : "text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14]"
                )}
              >
                <Database className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            
            <button 
              onClick={() => isLoading ? handleStop() : onFormSubmit()} 
              className={cn(
                "w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center transition-all", 
                isLoading 
                  ? "bg-[#1C1B1B] text-white" 
                  : ((!localInput.trim() && selectedFiles.length === 0) ? "bg-[#eeece9] text-[#716B67]/40 cursor-not-allowed" : "bg-[#EC5B14] text-white shadow-lg hover:scale-105 active:scale-95")
              )}
            >
              {isLoading ? <Square className="w-4 h-4 fill-current" /> : <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
