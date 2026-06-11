import React, { useState, useLayoutEffect } from 'react';
import { 
  Plus, FileText, X as CloseIcon, 
  ChevronDown, Paperclip, ArrowUp, Square, Globe, Database, Check, Sparkles, Terminal, Cpu, FolderPlus, Wand2, Plug, BookOpen, Wrench, Briefcase, Archive, Settings2, Bug, Puzzle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { beautifyModelName } from '../../lib/chat-utils';
import { useProjects } from '../../lib/useProjects';
import { useInstalledSkills } from '../../lib/useInstalledSkills';
import { ProjectCreateModal } from '../ProjectCreateModal';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { globalToast } from '../GlobalToast';
import { api } from '../../lib/api-client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '../ui/dropdown-menu';

interface ChatInputProps {
  localInput: string;
  setLocalInput: (val: string) => void;
  attachments: any[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
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
  setPreviewAttachment?: (attachment: any) => void;
  ghostText?: string;
  setGhostText?: (text: string) => void;
  isPredicting?: boolean;
  isEmpty?: boolean;
  onMainTabChange?: (id: string) => void;
}

const ICON_MAP: Record<string, any> = {
  'Globe': Globe,
  'Sparkles': Sparkles,
  'Database': Database,
  'Cpu': FileText,
  'Zap': Sparkles,
  'Cloud': Sparkles
};

export const ChatInput = React.memo(({
  localInput,
  setLocalInput,
  attachments,
  addFiles,
  removeFile,
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
  setPreviewAttachment,
  ghostText = '',
  setGhostText = () => {},
  isPredicting = false,
  isEmpty = false,
  onMainTabChange,
}: ChatInputProps) => {
  const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: 'Globe', color: 'text-slate-400' };
  const activeDisplayName = beautifyModelName(activeModel.name);
  const ActiveIcon = ICON_MAP[activeModel.icon] || Globe;

  const [isFocused, setIsFocused] = useState(false);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [isProjectCreateModalOpen, setIsProjectCreateModalOpen] = useState(false);

  const { projects, fetchProjects } = useProjects();
  const { installedSkills } = useInstalledSkills();
  const { activeProject, setActiveProjectId } = useWorkspace();

  const MENTION_OPTIONS = [
    { id: 'search', label: 'Web Search', icon: Globe, desc: 'Search the live web', type: 'search' },
    { id: 'lexis', label: 'LexisNexis', icon: Database, desc: 'Case law & statutes', type: 'knowledge' },
    { id: 'internal', label: 'Internal Docs', icon: FileText, desc: 'Workspace files', type: 'knowledge' },
  ];

  const SLASH_OPTIONS = [
    { id: 'clear', label: '/clear', desc: 'Clear conversation context', action: 'clear', icon: CloseIcon },
    { id: 'prompt', label: '/prompt', desc: 'Insert prompt template', action: 'prompt', icon: FileText },
    { id: 'jenkins', label: '/jenkins', desc: 'Execute Jenkins skill', action: 'tool', icon: Wrench },
    { id: 'zentao', label: '/zentao', desc: 'Execute ZenTao skill', action: 'tool', icon: Wrench },
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

  const ghostRef = React.useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const syncScroll = () => {
      if (textAreaRef.current && ghostRef.current) {
        ghostRef.current.scrollTop = textAreaRef.current.scrollTop;
      }
    };
    const ta = textAreaRef.current;
    ta?.addEventListener('scroll', syncScroll);
    return () => ta?.removeEventListener('scroll', syncScroll);
  }, [textAreaRef]);

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
      addFiles(filesArray);
    }
  };

  const filteredMentions = MENTION_OPTIONS.filter(o => o.label.toLowerCase().includes(mentionQuery.toLowerCase()));
  const filteredSlash = SLASH_OPTIONS.filter(o => o.label.toLowerCase().includes('/' + slashQuery.toLowerCase()));

  return (
    <div className={cn(
      "px-4 md:px-8 z-10 w-full font-sans transition-all duration-500",
      isEmpty ? "pb-4 mt-4" : "pt-2 pb-4 md:pb-8 bg-gradient-to-t from-[#FCF9F8] via-[#FCF9F8] to-transparent mt-auto"
    )}>
      <div className="max-w-[800px] mx-auto relative">
        <AnimatePresence>
          {mentionMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-[calc(100%+8px)] left-4 w-auto min-w-[280px] pr-4 bg-white/95 backdrop-blur-xl border border-[#E8E4E2] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden z-50 p-1.5"
            >
              <div className="max-h-64 overflow-y-auto no-scrollbar">
                {filteredMentions.length > 0 ? filteredMentions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleMentionSelect(opt.type as any, opt.label)}
                    className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-[#F6F3F2] rounded-lg transition-colors group mb-0.5"
                  >
                    <opt.icon className="w-4 h-4 text-[#716B67] shrink-0" />
                    <span className="text-[13px] font-medium text-[#1C1B1B] flex-1 truncate">
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[#A8A4A1] ml-2 font-normal">{opt.desc}</span>
                    </span>
                  </button>
                )) : (
                  <div className="px-3 py-2 text-center text-[13px] text-[#A8A4A1]">No matches found</div>
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
              className="absolute bottom-[calc(100%+8px)] left-4 w-auto min-w-[280px] pr-4 bg-white/95 backdrop-blur-xl border border-[#E8E4E2] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden z-50 p-1.5"
            >
              <div className="max-h-64 overflow-y-auto no-scrollbar">
                {filteredSlash.length > 0 ? filteredSlash.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSlashSelect(opt.action, opt.label)}
                    className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-[#F6F3F2] rounded-lg transition-colors group mb-0.5"
                  >
                    <opt.icon className="w-4 h-4 text-[#716B67] shrink-0" />
                    <span className="text-[13px] font-medium text-[#1C1B1B] flex-1 truncate">
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[#A8A4A1] ml-2 font-normal">{opt.desc}</span>
                    </span>
                  </button>
                )) : (
                  <div className="px-3 py-2 text-center text-[13px] text-[#A8A4A1]">No commands found</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          "bg-white/70 backdrop-blur-md rounded-2xl p-2 flex flex-col shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] ring-1 transition-all duration-300",
          isFocused ? "ring-[#EC5B14]/30 shadow-[0_0_15px_rgba(236,91,20,0.15)]" : "ring-[#1C1B1B]/5"
        )}>
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="flex flex-wrap gap-2 px-4 pt-3 pb-1"
              >
                {attachments.map((file) => (
                  <div key={file.id} className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl border group relative transition-all",
                    file.isUploading ? "bg-white/50 border-[#E8E4E2]/40" : "bg-[#F6F3F2] border-[#E8E4E2]/60 hover:border-[#EC5B14]/30 cursor-pointer hover:bg-white"
                  )}
                  onClick={() => {
                    if (!file.isUploading && file.url && setPreviewAttachment) {
                      setPreviewAttachment({ name: file.name, contentType: file.contentType, url: file.url });
                    }
                  }}>
                    {file.isUploading ? (
                      <div className="w-4 h-4 rounded-full border-2 border-[#E8E4E2] border-t-[#EC5B14] animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 text-[#EC5B14]" />
                    )}
                    <span className={cn(
                      "text-[12px] font-bold max-w-[160px] truncate",
                      file.isUploading ? "text-[#716B67] animate-pulse" : "text-[#1C1B1B]"
                    )}>{file.name}</span>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        removeFile(file.id); 
                        if (setPreviewAttachment) {
                          setPreviewAttachment((prev: any) => prev?.name === file.name ? null : prev);
                        }
                      }} 
                      className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#E8E4E2] text-[#716B67] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-1"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex flex-col">
            <div 
              ref={ghostRef}
              className={cn(
                "absolute inset-0 pointer-events-none whitespace-pre-wrap break-words overflow-auto text-[15px] px-4 leading-relaxed font-sans no-scrollbar border-none",
                attachments.length > 0 ? "pt-1 pb-3" : "py-3"
              )}
            >
              <span className="text-transparent border-none">{localInput}</span>
              {ghostText && <span className="text-[#A8A4A1]/50 border-none">{ghostText}</span>}
            </div>

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
                if (e.key === 'Tab' && ghostText) {
                  e.preventDefault();
                  setLocalInput(localInput + ghostText);
                  setGhostText('');
                  setTimeout(() => {
                    if (textAreaRef.current) {
                      const newLen = textAreaRef.current.value.length;
                      textAreaRef.current.setSelectionRange(newLen, newLen);
                    }
                  }, 0);
                  return;
                }
                
                if (!['Shift', 'Control', 'Alt', 'Meta', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                  setGhostText('');
                }

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
              onScroll={() => {
                if (ghostRef.current && textAreaRef.current) {
                  ghostRef.current.scrollTop = textAreaRef.current.scrollTop;
                }
              }}
              placeholder={t('chat.placeholder', 'Ask anything...')}
              className={cn(
                "w-full bg-transparent border-none focus:ring-0 focus:outline-none text-[15px] text-[#1C1B1B] placeholder:text-[#A8A4A1] px-4 resize-none min-h-[44px] max-h-[200px] leading-relaxed font-sans relative z-0",
                attachments.length > 0 ? "pt-1 pb-3" : "py-3"
              )}
              rows={1}
            />

            <AnimatePresence>
              {ghostText && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-2 right-4 text-[10px] text-[#A8A4A1] px-2 py-0.5 rounded-md bg-[#F6F3F2] border border-[#E8E4E2]/60 pointer-events-none z-10 font-bold tracking-widest shadow-sm"
                >
                  [TAB] TO COMPLETE
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between px-2 sm:px-4 pb-2">
            <div className="flex items-center gap-0.5 sm:gap-1.5 overflow-hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 sm:p-2 rounded-lg text-[#716B67] bg-transparent hover:bg-[#eeece9] hover:text-[#1C1B1B] transition-all shrink-0">
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-56 border-[#E8E4E2] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-xl p-1.5 backdrop-blur-xl bg-white/95 mb-2">
                  <DropdownMenuItem onClick={() => {
                    const input = document.createElement('input'); 
                    input.type = 'file'; 
                    input.multiple = true; 
                    input.onchange = (e: any) => { 
                      if (e.target.files) addFiles(Array.from(e.target.files as FileList)); 
                    }; 
                    input.click(); 
                  }} className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2] mb-0.5">
                    <div className="flex items-center gap-3">
                      <Paperclip className="w-4 h-4 text-[#716B67]" />
                      <span className="text-[13px] font-medium text-[#1C1B1B]">Add files or photos</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2] mb-0.5 data-[state=open]:bg-[#F6F3F2]">
                      <FolderPlus className="w-4 h-4 text-[#716B67] shrink-0" />
                      <span className="text-[13px] font-medium text-[#1C1B1B] flex-1">Add to project</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent sideOffset={8} className="w-56 border-[#E8E4E2] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-xl p-1.5 backdrop-blur-xl bg-white/95">
                        {projects.map(project => (
                          <DropdownMenuItem 
                            key={project.id} 
                            onClick={() => {
                              setActiveProjectId(project.id);
                              globalToast(`Chat moved to ${project.name}`);
                            }}
                            className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2]"
                          >
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                              <div className="w-8 h-8 rounded-lg bg-white border border-[#E8E4E2] flex items-center justify-center shrink-0">
                                <Briefcase className="w-4 h-4 text-[#716B67]" />
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[13px] font-bold text-[#1C1B1B] truncate">{project.name}</span>
                                <span className="text-[10px] text-[#A8A4A1] truncate">Local Project</span>
                              </div>
                            </div>
                            {activeProject?.id === project.id && (
                              <Check className="w-4 h-4 text-[#EC5B14] shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                        {projects.length > 0 && <DropdownMenuSeparator className="bg-[#E8E4E2]/50 my-1" />}
                        <DropdownMenuItem onClick={() => setIsProjectCreateModalOpen(true)} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2]">
                          <Plus className="w-4 h-4 text-[#716B67]" />
                          <span className="text-[13px] font-medium text-[#1C1B1B]">Start a new project</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  
                  <DropdownMenuSeparator className="bg-[#E8E4E2]/50 my-1" />
                  
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2] mb-0.5 data-[state=open]:bg-[#F6F3F2]">
                      <Wrench className="w-4 h-4 text-[#716B67] shrink-0" />
                      <span className="text-[13px] font-medium text-[#1C1B1B] flex-1">Skills</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent sideOffset={8} className="w-60 border-[#E8E4E2] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-xl p-1.5 backdrop-blur-xl bg-white/95">
                        {installedSkills.map(skill => (
                          <DropdownMenuItem key={skill.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2] mb-0.5">
                            <FileText className="w-4 h-4 text-[#716B67] shrink-0" />
                            <span className="text-[13px] font-medium text-[#1C1B1B] truncate">{skill.name}</span>
                          </DropdownMenuItem>
                        ))}
                        {installedSkills.length > 0 && <DropdownMenuSeparator className="bg-[#E8E4E2]/50 my-1" />}
                        <DropdownMenuItem onClick={() => onMainTabChange?.('library')} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2] mb-0.5">
                          <Archive className="w-4 h-4 text-[#716B67] shrink-0" />
                          <span className="text-[13px] font-medium text-[#1C1B1B]">Manage skills</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMainTabChange?.('library')} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2]">
                          <Plus className="w-4 h-4 text-[#716B67] shrink-0" />
                          <span className="text-[13px] font-medium text-[#1C1B1B]">Add skill</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuItem disabled className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-not-allowed opacity-40 mb-0.5">
                    <Puzzle className="w-4 h-4 text-[#716B67]" />
                    <span className="text-[13px] font-medium text-[#1C1B1B]">Add plugins...</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-[#E8E4E2]/50 my-1" />
                  
                  <DropdownMenuItem onClick={() => setIsSearchMode(!isSearchMode)} className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F6F3F2] mb-0.5">
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-[#716B67]" />
                      <span className="text-[13px] font-medium text-[#1C1B1B]">Web search</span>
                    </div>
                    {isSearchMode && <Check className="w-4 h-4 text-[#EC5B14]" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AnimatePresence>
                {activeProject && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 'auto' }}
                    exit={{ opacity: 0, scale: 0.9, width: 0 }}
                    className="flex items-center ml-1 overflow-hidden"
                  >
                    <button 
                      onClick={() => onMainTabChange?.('projects')}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#EC5B14] bg-[#EC5B14]/5 hover:bg-[#EC5B14]/10 transition-colors whitespace-nowrap group"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-[#EC5B14]" />
                      <span className="text-xs font-bold text-[#EC5B14] truncate max-w-[120px]">
                        {activeProject.name}
                      </span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-[#716B67] hover:bg-[#eeece9] transition-all border border-transparent hover:border-[#E8E4E2]/40 shrink-0">
                    <ActiveIcon className={cn("w-4 h-4 shrink-0", activeModel.color)} />
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
                      const ModelIcon = ICON_MAP[m.icon] || Globe;
                      return (
                        <DropdownMenuItem key={m.id} onClick={() => setSelectedModelId(m.id)} className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all mb-0.5 hover:bg-[#eeece9]">
                          <div className="flex items-center gap-3">
                            <div className={cn("flex items-center justify-center w-8 h-8", m.color)}>
                              <ModelIcon className="w-5 h-5" />
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
                    if (e.target.files) addFiles(Array.from(e.target.files as FileList)); 
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
                  : ((!localInput.trim() && attachments.length === 0) ? "bg-[#eeece9] text-[#716B67]/40 cursor-not-allowed" : "bg-gradient-to-br from-[#a33800] to-[#cc4900] text-white shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95")
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

      <ProjectCreateModal
        isOpen={isProjectCreateModalOpen}
        onClose={() => setIsProjectCreateModalOpen(false)}
        onCreated={async (name: string) => {
          setIsProjectCreateModalOpen(false);
          await fetchProjects();
          
          // Try to automatically find and select the new project by name
          // We need a short delay since fetchProjects might be async
          setTimeout(async () => {
             try {
                const res = await api.get<any>('/api/knowledge-projects');
                const newProj = res.data?.find((p: any) => p.name === name);
                if (newProj) {
                   setActiveProjectId(newProj.id);
                   globalToast(`Chat moved to ${newProj.name}`);
                }
             } catch (e) {
                // Ignore error on fallback
             }
          }, 500);

          onMainTabChange?.('projects');
        }}
      />
    </div>
  );
});
