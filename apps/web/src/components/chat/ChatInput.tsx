import React, { useState, useLayoutEffect } from 'react';
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
  lastUserMessage?: string;
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
  lastUserMessage,
}: ChatInputProps) {
  const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Globe, color: 'text-slate-400' };
  const activeDisplayName = beautifyModelName(activeModel.name);

  const [isFocused, setIsFocused] = useState(false);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");

  const MENTION_OPTIONS = [
    { id: 'search', label: 'Web Search', icon: Globe, desc: 'Search the live web', type: 'search' },
    { id: 'lexis', label: 'LexisNexis', icon: Database, desc: 'Case law & statutes', type: 'knowledge' },
    { id: 'internal', label: 'Internal Docs', icon: FileText, desc: 'Workspace files', type: 'knowledge' },
  ];

  const SLASH_OPTIONS = [
    { id: 'clear', label: '/clear', desc: 'Clear context', action: 'clear', icon: CloseIcon },
    { id: 'prompt', label: '/prompt', desc: 'Use prompt template', action: 'prompt', icon: FileText },
    { id: 'jenkins', label: '/jenkins', desc: 'Run Jenkins tool', action: 'tool', icon: Plus },
    { id: 'zentao', label: '/zentao', desc: 'Run ZenTao tool', action: 'tool', icon: Plus },
  ];

  const handleMentionSelect = (type: 'search' | 'knowledge', label: string) => {
    if (type === 'search') setIsSearchMode(true);
    if (type === 'knowledge') setIsKnowledgeMode(true);
    
    const cursorPosition = textAreaRef.current?.selectionStart || 0;
    const textBeforeCursor = localInput.slice(0, cursorPosition);
    const textAfterCursor = localInput.slice(cursorPosition);
    
    const textBeforeMatch = textBeforeCursor.replace(/(?:^|\s)@([^\s]*)$/, (match) => {
      return match.startsWith(' ') ? ' ' : '';
    });
    
    const newText = textBeforeMatch + '@' + label + ' ' + textAfterCursor;
    setLocalInput(newText);
    setMentionMenuOpen(false);
    
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
        const newPos = textBeforeMatch.length + label.length + 2;
        textAreaRef.current.selectionStart = newPos;
        textAreaRef.current.selectionEnd = newPos;
      }
    }, 10);
  };

  const handleSlashSelect = (action: string, label: string) => {
    const cursorPosition = textAreaRef.current?.selectionStart || 0;
    const textBeforeCursor = localInput.slice(0, cursorPosition);
    const textAfterCursor = localInput.slice(cursorPosition);
    
    const textBeforeMatch = textBeforeCursor.replace(/(?:^|\s)\/([^\s]*)$/, (match) => {
      return match.startsWith(' ') ? ' ' : '';
    });
    
    const newText = textBeforeMatch + label + ' ' + textAfterCursor;
    setLocalInput(newText);
    setSlashMenuOpen(false);
    
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
        const newPos = textBeforeMatch.length + label.length + 1;
        textAreaRef.current.selectionStart = newPos;
        textAreaRef.current.selectionEnd = newPos;
      }
    }, 10);
  };

  useLayoutEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
    }
  }, [localInput, textAreaRef]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const filesArray = Array.from(e.clipboardData.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const filteredMentions = MENTION_OPTIONS.filter(o => o.label.toLowerCase().includes(mentionQuery.toLowerCase()));
  const filteredSlash = SLASH_OPTIONS.filter(o => o.label.toLowerCase().includes('/' + slashQuery.toLowerCase()));

  return (
    <div className="pt-2 pb-4 md:pb-8 px-4 md:px-8 bg-gradient-to-t from-[#FCF9F8] via-[#FCF9F8] to-transparent z-10 w-full mt-auto">
      <div className="max-w-[800px] mx-auto relative">
        <AnimatePresence>
          {mentionMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-[calc(100%+8px)] left-4 w-64 bg-white/95 backdrop-blur-xl border border-[#E8E4E2] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-xl overflow-hidden z-50"
            >
              <div className="px-3 py-2 bg-[#F6F3F2]/50 border-b border-[#E8E4E2]/50">
                <span className="text-[10px] font-black uppercase text-[#716B67] tracking-widest">Add Context</span>
              </div>
              <div className="p-1 max-h-64 overflow-y-auto">
                {filteredMentions.length > 0 ? filteredMentions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleMentionSelect(opt.type as any, opt.label)}
                    className="flex items-center gap-3 w-full p-2 text-left hover:bg-[#EC5B14]/5 hover:text-[#EC5B14] rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E8E4E2] flex items-center justify-center group-hover:border-[#EC5B14]/30 group-hover:bg-white shadow-sm shrink-0 transition-colors">
                      <opt.icon className="w-4 h-4 text-[#716B67] group-hover:text-[#EC5B14] transition-colors" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-[#1C1B1B]">{opt.label}</span>
                      <span className="text-[10px] text-[#A8A4A1] group-hover:text-[#EC5B14]/70 transition-colors">{opt.desc}</span>
                    </div>
                  </button>
                )) : (
                  <div className="p-3 text-center text-xs text-[#A8A4A1]">No matches found</div>
                )}
              </div>
            </motion.div>
          )}

          {slashMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-[calc(100%+8px)] left-4 w-64 bg-white/95 backdrop-blur-xl border border-[#E8E4E2] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-xl overflow-hidden z-50"
            >
              <div className="px-3 py-2 bg-[#F6F3F2]/50 border-b border-[#E8E4E2]/50">
                <span className="text-[10px] font-black uppercase text-[#716B67] tracking-widest">Slash Commands</span>
              </div>
              <div className="p-1 max-h-64 overflow-y-auto">
                {filteredSlash.length > 0 ? filteredSlash.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSlashSelect(opt.action, opt.label)}
                    className="flex items-center gap-3 w-full p-2 text-left hover:bg-[#EC5B14]/5 hover:text-[#EC5B14] rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E8E4E2] flex items-center justify-center group-hover:border-[#EC5B14]/30 group-hover:bg-white shadow-sm shrink-0 transition-colors">
                      <opt.icon className="w-4 h-4 text-[#716B67] group-hover:text-[#EC5B14] transition-colors" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-[#1C1B1B]">{opt.label}</span>
                      <span className="text-[10px] text-[#A8A4A1] group-hover:text-[#EC5B14]/70 transition-colors">{opt.desc}</span>
                    </div>
                  </button>
                )) : (
                  <div className="p-3 text-center text-xs text-[#A8A4A1]">No commands found</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          "bg-white/70 backdrop-blur-md rounded-2xl p-2 flex flex-col shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] ring-1 transition-all duration-300",
          isFocused ? "ring-[#EC5B14]/30 shadow-[0_0_15px_rgba(236,91,20,0.15)]" : "ring-[#1C1B1B]/5"
        )}>
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="flex flex-wrap gap-2 px-4 pt-3 pb-1"
              >
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-[#F6F3F2] rounded-xl border border-[#E8E4E2]/60 group relative transition-all hover:border-[#EC5B14]/30 shadow-sm">
                    <FileText className="w-3.5 h-3.5 text-[#EC5B14]" />
                    <span className="text-[11px] font-bold text-[#1C1B1B] max-w-[120px] truncate">{file.name}</span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white text-[#716B67] hover:text-red-500 transition-colors">
                      <CloseIcon className="w-3 h-3" />
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
              onChange={(e) => {
                const val = e.target.value;
                setLocalInput(val);
                
                const cursorPosition = e.target.selectionStart;
                const textBeforeCursor = val.slice(0, cursorPosition);
                
                const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^\s]*)$/);
                const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([^\s]*)$/);
                
                if (mentionMatch) {
                  setMentionMenuOpen(true);
                  setMentionQuery(mentionMatch[1]);
                  setSlashMenuOpen(false);
                } else if (slashMatch) {
                  setSlashMenuOpen(true);
                  setSlashQuery(slashMatch[1]);
                  setMentionMenuOpen(false);
                } else {
                  setMentionMenuOpen(false);
                  setSlashMenuOpen(false);
                }
              }}
              onKeyDown={(e) => {
                if (mentionMenuOpen && e.key === 'Escape') {
                  setMentionMenuOpen(false);
                  e.preventDefault();
                } else if (slashMenuOpen && e.key === 'Escape') {
                  setSlashMenuOpen(false);
                  e.preventDefault();
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  if (mentionMenuOpen) {
                    e.preventDefault();
                    if (filteredMentions.length > 0) {
                      handleMentionSelect(filteredMentions[0].type as any, filteredMentions[0].label);
                    }
                  } else if (slashMenuOpen) {
                    e.preventDefault();
                    if (filteredSlash.length > 0) {
                      handleSlashSelect(filteredSlash[0].action, filteredSlash[0].label);
                    }
                  } else {
                    e.preventDefault();
                    onFormSubmit();
                  }
                } else if (e.key === 'ArrowUp' && !localInput.trim() && lastUserMessage) {
                  e.preventDefault();
                  setLocalInput(lastUserMessage);
                  setTimeout(() => {
                    if (textAreaRef.current) {
                      textAreaRef.current.selectionStart = textAreaRef.current.value.length;
                      textAreaRef.current.selectionEnd = textAreaRef.current.value.length;
                    }
                  }, 0);
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onPaste={handlePaste}
              placeholder={t('chat.placeholder', 'Ask anything...')}
              className={cn(
                "w-full bg-transparent border-none focus:ring-0 focus:outline-none text-[15px] text-[#1C1B1B] placeholder:text-[#A8A4A1] px-4 resize-none min-h-[44px] max-h-[200px] leading-relaxed transition-all duration-200",
                selectedFiles.length > 0 ? "pt-1 pb-3" : "py-3"
              )}
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
                "w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 relative overflow-hidden", 
                isLoading 
                  ? "bg-[#1C1B1B] text-white shadow-sm" 
                  : ((!localInput.trim() && selectedFiles.length === 0) ? "bg-[#eeece9] text-[#716B67]/40 cursor-not-allowed" : "bg-gradient-to-br from-[#a33800] to-[#cc4900] text-white shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95")
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div
                    key="stop"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="send"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
