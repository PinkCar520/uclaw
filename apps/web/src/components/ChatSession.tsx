import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  ArrowDown, Sparkles, Copy, RotateCcw, Check,
  Plus, FileText, X as CloseIcon, Image as ImageIcon,
  ChevronDown, Paperclip, ArrowRight, Terminal, Cpu, Database, BadgeCheck, Globe, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { BugCard } from './BugCard';
import { PipelineCard } from './PipelineCard';
import { TaskPlan } from './TaskPlan';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

interface ChatSessionProps {
  id: string; // Internal session ID
  chatId: string | null; // Persisted chat ID (URL slug)
  onChatCreated: (id: string, messages: any[]) => void;
  onMessagesChange: (id: string, messages: any[]) => void;
  onRenameConversation?: (id: string, title: string) => void;
  initialMessages?: any[];
  models: any[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  token: string | null;
  user: any;
  isVisible: boolean;
  t: (key: string, options?: any) => string;
}

export function ChatSession({
  id: sessionId,
  chatId,
  onChatCreated,
  onMessagesChange,
  onRenameConversation,
  initialMessages = [],
  models,
  selectedModelId,
  setSelectedModelId,
  token,
  user,
  isVisible,
  t
}: ChatSessionProps) {
  const { messages, sendMessage, status, reload, setMessages, stop } = useChat({
    id: sessionId, // 始终用 sessionId，chatId 变化时不重建实例（否则流式输出会被清空）
    onFinish: async (message: any) => {
      // 这里的 messages 是“之前的”列表，message 是“新的回答”
      const updatedMessages = [...messages, message];
      
      // 使用实时的 Ref 来判断
      const currentChatId = chatIdRef.current;
      
      if (currentChatId) {
        onMessagesChange(currentChatId, updatedMessages);
        
        // 智能标题摘要逻辑：如果是第一轮且尚未生成标题
        if (updatedMessages.length >= 2 && !titleGeneratedRef.current && token) {
          titleGeneratedRef.current = true; // 立即标记，防止重入
          
          try {
            const res = await fetch('/api/chat/generate-title', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ 
                message: updatedMessages[0].content,
                modelId: selectedModelId 
              })
            });
            const data = await res.json();
            if (data.success && data.title) {
              onRenameConversation?.(currentChatId, data.title);
            }
          } catch (err) {
             console.warn('Auto title summary failed:', err);
          }
        }
      }
    }
  }) as any;

  // 只在首次挂载时设置历史消息，流式输出期间不再触发（防止覆盖正在输出的内容）
  const initializedRef = useRef(false);
  const chatIdRef = useRef(chatId);
  const titleGeneratedRef = useRef(false);

  // 同步 ref，确保异步回调中总能拿到最新值
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    if (!initializedRef.current && initialMessages.length > 0) {
      initializedRef.current = true;
      setMessages(initialMessages);
      // 如果加载的是历史记录，标记为已生成标题，防止重复总结
      titleGeneratedRef.current = true;
    }
  }, [initialMessages]);

  const isLoading = status === 'streaming' || status === 'submitting';

  const [localInput, setLocalInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; contentType: string; url: string } | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isKnowledgeMode, setIsKnowledgeMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Sparkles, color: 'text-slate-400' };

  // Sync back to parent when messages change
  useEffect(() => {
    if (chatId && messages.length > 0) {
      onMessagesChange(chatId, messages);
    }
  }, [messages, chatId]);

  // Scroll to bottom effect
  useEffect(() => {
    if (isVisible && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isVisible]);

  // TextArea Resize
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
    }
  }, [localInput]);

  useEffect(() => {
    if (isVisible && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [isVisible]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const copyToClipboard = (m: any) => {
    const text = Array.isArray(m.parts)
      ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
      : m.content || '';
    navigator.clipboard.writeText(text);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const uploadFile = async (file: File): Promise<{ name: string; contentType: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) throw new Error(`Failed to upload file: ${res.statusText}`);
    const data = await res.json();
    return { name: file.name, contentType: file.type || 'application/octet-stream', url: data.url };
  };

  const onFormSubmit = async (e?: any) => {
    if (e) e.preventDefault();
    if ((!localInput.trim() && selectedFiles.length === 0) || isLoading) return;
    const val = localInput;
    setLocalInput('');
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);
    try {
      const attachments = filesToUpload.length > 0 ? await Promise.all(filesToUpload.map(uploadFile)) : undefined;
      const isFirstMessage = messages.length === 0 && !chatId;
      if (isFirstMessage) {
        onChatCreated(sessionId, [{ content: val, role: 'user', experimental_attachments: attachments }]);
      }

      await sendMessage(
        { content: val, role: 'user', experimental_attachments: attachments } as any,
        { 
          body: { 
            modelId: selectedModelId,
            search: isSearchMode,
            knowledge: isKnowledgeMode
          } 
        }
      );
    } catch (err) {
      console.error(err);
      setLocalInput(val);
      setSelectedFiles(filesToUpload);
    }
  };
  const TypingCursor = () => (
    <span className="inline-block w-[1.5px] h-[14px] bg-[#716B67] ml-1 translate-y-[2px] animate-cursor-blink" />
  );

  const renderToolResult = (part: any) => {
    if (part.type === 'tool-getBugInfo' || part.toolName === 'getBugInfo') {
      const bug = part.output || part.result;
      if (bug) return <BugCard key={part.toolCallId} {...bug} />;
    }
    if (part.type === 'tool-searchBugs' || part.toolName === 'searchBugs') {
      const bugs = part.output || part.result || [];
      return (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mt-2">
          {bugs.map((b: any) => <BugCard key={b.id} {...b} />)}
        </div>
      );
    }
    if (part.type === 'tool-getPipelineStatus' || part.toolName === 'getPipelineStatus') {
      const pipeline = part.output || part.result;
      if (pipeline) return <PipelineCard key={part.toolCallId} {...pipeline} />;
    }
    if (part.type === 'tool-proposePlan' || part.toolName === 'proposePlan') {
      const plan = part.output || part.result;
      if (plan) return (
        <TaskPlan
          key={part.toolCallId}
          {...plan}
          onConfirm={() => sendMessage({ content: 'Y', role: 'user' })}
          onCancel={() => sendMessage({ content: 'N', role: 'user' })}
        />
      );
    }
    if (part.type === 'tool-runLocalCommand' || part.toolName === 'runLocalCommand') {
      const res = part.output || part.result;
      if (res?.status === 'Success') {
        return (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs mt-2 overflow-hidden">
            <div className="flex items-center gap-2 mb-2 text-blue-600 font-semibold">
              <Terminal className="w-3 h-3 text-blue-600" />
              <span>Local Node Execute: {res.command}</span>
            </div>
            <pre className="text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {JSON.stringify(res.result, null, 2)}
            </pre>
          </div>
        );
      }
    }
    return null;
  };

  const beautifyModelName = (name: string) => {
    return name
      .split(/[-:_]/)
      .filter(word => !['it', '8bit', 'v3', 'v2', 'latest'].includes(word.toLowerCase()))
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const activeDisplayName = beautifyModelName(activeModel.name);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  return (
    <div 
      className={cn("flex-1 flex overflow-hidden h-full", !isVisible && "hidden")}
      onDragOver={handleDragOver}
    >
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white/40">
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onDragLeave={handleDragLeave} onDrop={handleDrop}
              className="absolute inset-0 z-50 bg-[#EC5B14]/5 backdrop-blur-[2px] border-4 border-dashed border-[#EC5B14]/20 m-4 rounded-[40px] flex flex-col items-center justify-center text-[#EC5B14]"
            >
              <Plus className="w-12 h-12 mb-4" />
              <p className="text-xl font-bold font-display">{t('common.drag_drop')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-8 py-4 scroll-smooth"
        >
          <div className="max-w-[800px] mx-auto space-y-8">
            <AnimatePresence mode="popLayout" initial={false}>
              {messages.length === 0 ? (
                <div className="flex flex-col mt-10">
                  <div className="flex items-start gap-6 bg-[#f6f3f2] p-8 rounded-[24px] mb-8 border border-transparent">
                    <div className="w-12 h-12 rounded-[12px] bg-white flex items-center justify-center shrink-0 shadow-sm text-[#EC5B14]">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold font-display text-[#1C1B1B] mb-2 cursor-default">{t('chat.empty_state.title')}</h3>
                      <p className="text-[#716B67] text-sm leading-relaxed max-w-xl">
                        {t('chat.empty_state.desc')}
                      </p>
                      <div className="flex gap-4 mt-6">
                        <div className="bg-white px-5 py-4 rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] min-w-[140px]">
                          <p className="text-[11px] text-[#716B67] font-semibold mb-1">{t('chat.empty_state.improvement_label')}</p>
                          <p className="text-2xl font-bold font-display text-[#EC5B14]">{t('chat.empty_state.improvement_value')}</p>
                        </div>
                        <div className="bg-white px-5 py-4 rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] min-w-[140px]">
                          <p className="text-[11px] text-[#716B67] font-semibold mb-1">{t('chat.empty_state.success_label')}</p>
                          <p className="text-2xl font-bold font-display text-[#0066CC]">{t('chat.empty_state.success_value')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m: any, idx: number) => {
                  const isLast = idx === messages.length - 1;
                  const isAssistant = m.role === 'assistant';
                  const isUser = m.role === 'user';
                  const isStreaming = isLast && isLoading && isAssistant;
                  const hasContent = m.content || (Array.isArray(m.parts) && m.parts.some((p: any) => p.text));

                  return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={m.id || idx} className={cn("flex flex-col group", isUser ? "items-end" : "items-start w-full")}>
                      <div className={cn("flex w-full gap-4", isUser ? "justify-end" : "justify-start")}>
                        {isAssistant && (
                          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#EC5B14] to-[#FF8C42] flex items-center justify-center shadow-[0_4px_15px_rgba(236,91,20,0.3)] text-white shrink-0 mt-1">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                        <div className={cn(
                          "py-3 rounded-[20px] text-[15px] leading-relaxed",
                          isUser
                            ? "bg-[#eeece9] text-[#1C1B1B] max-w-[85%] px-5"
                            : "bg-transparent text-[#1C1B1B] flex-1 min-w-0"
                        )}>
                          {(m.experimental_attachments || m.attachments) && (m.experimental_attachments || m.attachments).length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-[#E8E4E2]/40">
                              {(m.experimental_attachments || m.attachments).map((at: any, aidx: number) => {
                                const isImage = at.contentType?.startsWith('image/') || at.type?.startsWith('image/');
                                const displayUrl = at.url || (at.data ? `data:${at.contentType || at.type};base64,${at.data}` : '');
                                const isActive = previewAttachment?.name === at.name && previewAttachment?.url === displayUrl;
                                return (
                                  <button
                                    key={aidx}
                                    onClick={() => setPreviewAttachment(isActive ? null : { name: at.name, contentType: at.contentType || at.type || '', url: displayUrl })}
                                    className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border max-w-[200px] transition-all", isActive ? 'bg-[#EC5B14]/10 border-[#EC5B14]/40 text-[#EC5B14]' : 'bg-[#F6F3F2] border-[#E8E4E2]/60 hover:border-[#EC5B14]/30 hover:bg-[#EC5B14]/5')}
                                  >
                                    {isImage && displayUrl ? <div className="w-6 h-6 rounded-md bg-white border border-[#E8E4E2] overflow-hidden flex items-center justify-center shrink-0"><img src={displayUrl} alt={at.name} className="w-full h-full object-cover" /></div> : <FileText className="w-4 h-4 shrink-0" />}
                                    <span className="text-[11px] font-bold truncate" title={at.name}>{at.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {!hasContent && isAssistant && isLoading ? (
                            <div className="flex items-center gap-2 py-2">
                              <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-[11px] font-bold text-[#EC5B14] uppercase tracking-widest">
                                {t('chat.thinking')}
                              </motion.span>
                              <TypingCursor />
                            </div>
                          ) : Array.isArray(m.parts) ? (
                            m.parts.map((part: any, i: number) => (
                              <div key={i} className="prose prose-slate prose-sm max-w-none">
                                {part.type === 'text' && (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {isStreaming && i === m.parts.length - 1 ? part.text : part.text}
                                  </ReactMarkdown>
                                )}
                                {renderToolResult(part)}
                              </div>
                            ))
                          ) : (
                            <div className="prose prose-slate prose-sm max-w-none relative">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                              {isStreaming && <TypingCursor />}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-3 mt-2", isUser ? "px-5 flex-row-reverse" : "px-12 flex-row")}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => copyToClipboard(m)} className="p-1 hover:bg-[#F6F3F2] rounded-md text-[#716B67]">{copiedId === m.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</button>
                          {isAssistant && <button onClick={() => reload?.()} className="p-1 hover:bg-[#F6F3F2] rounded-md text-[#716B67]"><RotateCcw className="w-3 h-3" /></button>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                
               {/* 当正在提交但 messages 列表还没更新出 assistant 回复时的“先行占位” */}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full gap-4 items-start mb-8">
                  <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#EC5B14] to-[#FF8C42] flex items-center justify-center shadow-[0_4px_15px_rgba(236,91,20,0.3)] text-white shrink-0 mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-2 py-3">
                    <div className="flex items-center gap-2">
                      <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-[11px] font-bold text-[#EC5B14] uppercase tracking-widest">
                        {t('chat.thinking')}
                      </motion.span>
                      <TypingCursor />
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}

            </AnimatePresence>
          </div>
        </div>

        <div className="pt-2 pb-8 px-8 bg-gradient-to-t from-[#FCF9F8] via-[#FCF9F8] to-transparent z-10 w-full mt-auto">
          <div className="max-w-[800px] mx-auto relative">
            <AnimatePresence>{showScrollButton && <motion.button initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }} onClick={scrollToBottom} className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 w-8 h-8 bg-white rounded-full shadow-lg border border-[#E8E4E2] flex items-center justify-center text-[#716B67] hover:text-[#EC5B14] hover:border-[#EC5B14]/30 transition-all active:scale-95"><ArrowDown className="w-4 h-4" /></motion.button>}</AnimatePresence>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-2 flex flex-col shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-[#1C1B1B]/5 transition-all focus-within:ring-[#EC5B14]/30 focus-within:shadow-[0_10px_40px_-10px_rgba(236,91,20,0.15)]">
              <AnimatePresence>
                {selectedFiles.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 px-4 py-2 border-b border-[#E8E4E2]/40 overflow-hidden">
                    {selectedFiles.map((file, idx) => (
                      <motion.div key={`${file.name}-${idx}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-2 bg-[#F6F3F2] px-3 py-1.5 rounded-xl border border-[#E8E4E2]/60 group transition-all hover:border-[#EC5B14]/30">
                        <FileText className="w-3.5 h-3.5 text-[#716B67]" /><span className="text-xs font-semibold text-[#1C1B1B] max-w-[120px] truncate">{file.name}</span>
                        <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white text-[#716B67] hover:text-red-500 transition-colors"><CloseIcon className="w-3 h-3" /></button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <textarea ref={textAreaRef} rows={1} value={localInput} onChange={(e) => setLocalInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isLoading) onFormSubmit(); } }} placeholder={t('chat.placeholder')} className="w-full bg-transparent border-none text-[#1C1B1B] focus:ring-0 text-sm py-4 px-4 resize-none min-h-[56px] max-h-[200px] placeholder:text-[#716B67]/70 focus:outline-none" />
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="flex items-center gap-1.5">
                  <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[#716B67] hover:bg-[#eeece9] transition-all border border-transparent hover:border-[#E8E4E2]/40">
                        <activeModel.icon className={cn("w-4 h-4", activeModel.color)} />
                        <span className="text-[11px] font-bold tracking-tight">{activeDisplayName}</span>
                        <ChevronDown className={cn("w-3 h-3 transition-transform", isModelDropdownOpen ? "rotate-180" : "")} />
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
                              <div className="flex items-center gap-3"><div className={cn("flex items-center justify-center w-8 h-8", m.color)}><m.icon className="w-5 h-5" /></div><div className="flex flex-col"><span className="text-[14px] font-bold text-[#1C1B1B]">{displayName}</span><span className="text-[11px] text-[#716B67] font-medium">{m.provider}</span></div></div>
                              {selectedModelId === m.id && <Check className="w-4 h-4 text-[#EC5B14] shrink-0" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="w-px h-4 bg-[#E8E4E2]/60 mx-1" />
                  <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.onchange = (e: any) => { if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]); }; input.click(); }} className="p-2 rounded-lg text-[#716B67] hover:bg-[#eeece9] hover:text-[#1C1B1B] transition-all"><Paperclip className="w-4 h-4" /></button>
                  
                  <button
                    onClick={() => setIsSearchMode(!isSearchMode)}
                    className={cn(
                      "p-2 rounded-lg transition-all transform active:scale-95",
                      isSearchMode
                        ? "text-[#EC5B14] bg-[#EC5B14]/5"
                        : "text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14]"
                    )}
                  >
                    <Globe className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setIsKnowledgeMode(!isKnowledgeMode)}
                    className={cn(
                      "p-2 rounded-lg transition-all transform active:scale-95",
                      isKnowledgeMode
                        ? "text-[#EC5B14] bg-[#EC5B14]/5"
                        : "text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14]"
                    )}
                  >
                    <Database className="w-5 h-5" />
                  </button>
                </div>
                <button onClick={() => isLoading ? stop() : onFormSubmit()} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", isLoading ? "bg-[#1C1B1B] text-white" : ((!localInput.trim() && selectedFiles.length === 0) ? "bg-[#eeece9] text-[#716B67]/40 cursor-not-allowed" : "bg-[#EC5B14] text-white shadow-lg hover:scale-105 active:scale-95"))}>
                  {isLoading ? <Square className="w-4 h-4 fill-current" /> : <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Right (Meta + Preview) */}
      <aside className="w-80 border-l border-[#E8E4E2] bg-[#fcf9f8]/80 backdrop-blur-md flex flex-col h-full overflow-hidden">
        {previewAttachment ? (
          /* ── File Preview Overrides Aside (Claude/Deepseek style) ── */
          <div className="flex-1 flex flex-col h-full bg-white animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-[#E8E4E2]/60 flex items-center justify-between bg-[#F6F3F2]/50">
              <div className="flex items-center gap-3">
                {previewAttachment.contentType.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-[#EC5B14]" /> : <FileText className="w-4 h-4 text-[#EC5B14]" />}
                <span className="font-bold text-[12px] text-[#1C1B1B] truncate max-w-[150px]">{previewAttachment.name}</span>
              </div>
              <button onClick={() => setPreviewAttachment(null)} className="p-1.5 hover:bg-[#eeece9] rounded-lg transition-colors"><CloseIcon className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {previewAttachment.contentType.startsWith('image/') ? (
                <div className="p-4 flex items-center justify-center"><img src={previewAttachment.url} alt={previewAttachment.name} className="max-w-full rounded-xl border border-[#E8E4E2]/60" /></div>
              ) : (
                <div className="p-4">
                  <div className="prose prose-slate prose-xs max-w-none text-[13px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {(() => {
                        try {
                          if (previewAttachment.url.startsWith('data:')) {
                            const b64 = previewAttachment.url.split(',')[1];
                            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                            return new TextDecoder('utf-8').decode(bytes);
                          }
                          return previewAttachment.url;
                        } catch { return '无法解码文件内容'; }
                      })()}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Integrations Panel ── */
          <div className="p-6 flex flex-col gap-8 overflow-y-auto flex-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-sm text-[#1C1B1B]">{t('chat.integrations.active_title')}</h4>
                <button className="text-[11px] font-bold text-[#EC5B14] hover:underline">{t('chat.integrations.manage')}</button>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-[8px] bg-[#1C1B1B] flex items-center justify-center text-white font-bold text-xs">GL</div><div><p className="text-sm font-bold text-[#1C1B1B]">GitLab</p><p className="text-[11px] text-[#716B67]">2 {t('chat.integrations.pending_mrs')}</p></div></div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-[8px] bg-[#0E1529] flex items-center justify-center text-red-500 font-bold text-xs"><Cpu className="w-4 h-4" /></div><div><p className="text-sm font-bold text-[#1C1B1B]">Jenkins</p><p className="text-[11px] text-[#716B67]">1 {t('chat.integrations.pipeline_running')}</p></div></div>
                  <div className="w-2 h-2 rounded-full bg-[#EC5B14]"></div>
                </div>
                <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group flex-col items-start gap-2">
                  <div className="w-full flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-[8px] bg-blue-100 flex items-center justify-center text-blue-600"><Database className="w-4 h-4" /></div><div><p className="text-sm font-bold text-[#1C1B1B]">ZenTao</p><p className="text-[11px] text-[#716B67]">4 {t('chat.integrations.active_tasks')}</p></div></div><div className="w-2 h-2 rounded-full bg-green-500"></div></div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-extrabold text-[#716B67] uppercase tracking-widest mb-4">{t('chat.meta.title')}</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-xs text-[#716B67]">{t('chat.meta.model')}</span><span className="text-xs font-bold text-[#1C1B1B] flex items-center gap-1">{activeDisplayName} <BadgeCheck className="w-3 h-3 text-[#EC5B14]" /></span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#716B67]">{t('chat.meta.tokens')}</span><span className="text-xs font-mono font-bold text-[#1C1B1B]">1,402</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#716B67]">{t('chat.meta.review_mode')}</span><span className="bg-[#EC5B14]/10 text-[#EC5B14] px-2 py-0.5 rounded-full text-[10px] font-bold">{t('chat.meta.strict')}</span></div>
              </div>
            </div>
            <div className="mt-auto pointer-events-none opacity-40 grayscale">
                <div className="relative rounded-[16px] overflow-hidden aspect-square border border-[#E8E4E2]/50">
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAr81NID_90Yy5CvYiCWyQuR_y9N_VafML_ttYyYtfSjf9jKr6XGdQbphqaCw1RNRV7cXKmhd7mCGXKD7zFngPrXo_X9rsn5SOJ_Zm33YJYNwgHgqAMynf0rzM6r8fHecJFgX3JfJUo09Gcb_tYo4uzHiM9j8dPiCGm-gia9TTdnFa3LGPxoKpBvdM0OACh_MqUpC0qNufnob3xIDqaVuMh5orjOJfsmCRQRTUQlwwnBkvCyMbhVztwLZqJMRJuxsJODFHj3ECVE40" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#F6F3F2] to-transparent"></div>
                    <div className="relative h-full p-5 flex flex-col justify-end"><p className="text-[10px] font-bold text-[#716B67] uppercase tracking-widest mb-1.5">{t('chat.weekly_insight.title')}</p><p className="text-sm font-bold text-[#1C1B1B] leading-snug">{t('chat.weekly_insight.content')}</p></div>
                </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
