import { useEffect, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import {
  ArrowUp, ArrowDown, Sparkles, Terminal, 
  Search, 
  Copy, RotateCcw, Check,
  Plus, FileText, X as CloseIcon, Image as ImageIcon,
  ChevronDown, Cloud, Cpu, Square, Paperclip, ArrowRight, BadgeCheck,
  Bell as BellIcon, Settings, Database, Activity, Globe
  } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from './lib/utils';
import { BugCard } from './components/BugCard';
import { Dashboard } from './components/Dashboard';
import { PipelineCard } from './components/PipelineCard';
import { TaskPlan } from './components/TaskPlan';
import { Settings as SettingsView } from './components/Settings';
import { UIGallery } from './components/UIGallery';
import { SkillLibrary } from './components/SkillLibrary';
import { KnowledgeBase } from './components/KnowledgeBase';
import { NodeMonitor } from './components/NodeMonitor';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './components/ui/dropdown-menu';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { CommandMenu } from './components/CommandMenu';

interface Conversation {
  id: string;
  title: string;
  messages: any[];
  timestamp: number;
  favorited?: boolean;
}

function AppContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: routeChatId } = useParams();
  const { pathname } = useLocation();

  const { messages, sendMessage, status, reload, setMessages, stop } = useChat() as any;
  const isLoading = status === 'streaming' || status === 'submitting';

  const [localInput, setLocalInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isKnowledgeMode, setIsKnowledgeMode] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; contentType: string; url: string } | null>(null);

  // 对话持久化逻辑
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // 1. 初始化加载历史
  useEffect(() => {
    const saved = localStorage.getItem('uclaw_chats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed);

        // 如果当前 URL 有 ID，尝试恢复对话
        const match = pathname.match(/\/chat\/(.+)/);
        const chatIdFromUrl = match ? match[1] : null;
        if (chatIdFromUrl) {
          const chat = parsed.find((c: any) => c.id === chatIdFromUrl);
          if (chat) {
            setMessages(chat.messages);
            setCurrentChatId(chat.id);
          }
        }
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // 2. 监听 URL 变化，同步消息列表 (处理点击侧边栏或浏览器后退)
  useEffect(() => {
    const match = pathname.match(/\/chat\/(.+)/);
    const chatIdFromUrl = match ? match[1] : null;

    if (chatIdFromUrl && chatIdFromUrl !== currentChatId) {
      const chat = conversations.find(c => c.id === chatIdFromUrl);
      if (chat) {
        setMessages(chat.messages);
        setCurrentChatId(chat.id);
      }
    } else if (!chatIdFromUrl && pathname === '/' && currentChatId !== null) {
      // 回到首页，清空当前对话
      setMessages([]);
      setCurrentChatId(null);
    }
  }, [pathname, conversations]);

  // 3. 消息更新时同步到 LocalStorage 并更新 URL
  useEffect(() => {
    if (messages.length === 0) return;
    const id = currentChatId || `chat_${Date.now()}`;

    // 如果是新对话产生的第一个 ID，更新 URL
    if (!currentChatId) {
      setCurrentChatId(id);
      navigate(`/chat/${id}`, { replace: true });
    }

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === id);
      const existing = prev[idx];

      const firstMsg = messages.find((m: any) => m.role === 'user')?.content || 'New Conversation';
      const defaultTitle = firstMsg.slice(0, 25) + (firstMsg.length > 25 ? '...' : '');
      const title = existing ? existing.title : defaultTitle;

      // 只有当消息数量增加时才更新时间戳，点击切换对话不应改变顺序
      const shouldUpdateTimestamp = !existing || messages.length > (existing.messages?.length || 0);
      const timestamp = shouldUpdateTimestamp ? Date.now() : (existing?.timestamp || Date.now());

      const updated = { id, title, messages, timestamp: timestamp, favorited: existing?.favorited };
      
      let newList;
      if (idx > -1) {
        // 如果内容没变且不需要更新时间戳，直接返回以避免不必要的 re-render
        if (!shouldUpdateTimestamp && existing.title === title && existing.messages === messages && existing.favorited === updated.favorited) {
          return prev;
        }
        newList = [...prev];
        newList[idx] = updated;
      } else {
        newList = [updated, ...prev];
      }
      localStorage.setItem('uclaw_chats', JSON.stringify(newList));
      return newList;
    });
  }, [messages]);

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setActiveTab('chat');
    navigate('/');
  };

  const handleRenameChat = (id: string, newTitle: string) => {
    setConversations(prev => {
      const newList = prev.map(c => c.id === id ? { ...c, title: newTitle } : c);
      localStorage.setItem('uclaw_chats', JSON.stringify(newList));
      return newList;
    });
  };

  const handleDeleteChat = (id: string) => {
    setConversations(prev => {
      const newList = prev.filter(c => c.id !== id);
      localStorage.setItem('uclaw_chats', JSON.stringify(newList));
      return newList;
    });
    if (currentChatId === id) {
      handleNewChat();
    }
  };

  const handleFavoriteChat = (id: string, favorited: boolean) => {
    setConversations(prev => {
      const newList = prev.map(c => c.id === id ? { ...c, favorited } : c);
      localStorage.setItem('uclaw_chats', JSON.stringify(newList));
      return newList;
    });
  };

  const loadConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

const [models, setModels] = useState<any[]>([]);
const [selectedModelId, setSelectedModelId] = useState(() => localStorage.getItem('uclaw_selected_model') || '');

// 每次模型选择变化时保存到 localStorage
useEffect(() => {
  if (selectedModelId) {
    localStorage.setItem('uclaw_selected_model', selectedModelId);
  }
}, [selectedModelId]);

// 动态获取可用模型
useEffect(() => {
  const fetchModels = async () => {
    try {
      const res = await fetch('/api/chat/models', {
        headers: {
          'Authorization': localStorage.getItem('uclaw_sso_token') || '',
          'X-User-Id': localStorage.getItem('uclaw_user_id') || ''
        }
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json) ? json : (json.models || []);
        
        const iconMap: Record<string, any> = { 
          'Sparkles': Sparkles,
          'Cloud': Cloud,
          'Cpu': Cpu
        };
        const formattedModels = data.map((m: any) => ({
          ...m,
          icon: iconMap[m.icon] || Sparkles
        }));
        
        setModels(formattedModels);
        
        // 如果 localStorage 中没存，或者存的 ID 在列表中不存在，则使用第一个作为默认
        if (formattedModels.length > 0) {
          const exists = formattedModels.some((m: any) => m.id === selectedModelId);
          if (!selectedModelId || !exists) {
            setSelectedModelId(formattedModels[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  };
  fetchModels();
}, []);

const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Sparkles, color: 'text-slate-400' };

const scrollRef = useRef<HTMLDivElement>(null);
const textAreaRef = useRef<HTMLTextAreaElement>(null);
const fileInputRef = useRef<HTMLInputElement>(null);
const [showScrollButton, setShowScrollButton] = useState(false);

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

useEffect(() => {
  if (activeTab === 'chat' && textAreaRef.current) {
    textAreaRef.current.focus();
  }
}, [currentChatId, activeTab]);

const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files) {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
    e.target.value = ''; // Fix re-upload bug by clearing value
  }
};

const removeFile = (index: number) => {
  setSelectedFiles(prev => prev.filter((_, i) => i !== index));
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(true);
};

const handleDragLeave = () => {
  setIsDragging(false);
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);
  if (e.dataTransfer.files) {
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  }
};

// TextArea 自动增高逻辑
useEffect(() => {
  if (textAreaRef.current) {
    textAreaRef.current.style.height = 'auto';
    textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
  }
}, [localInput]);

useEffect(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }
}, [messages]);

const copyToClipboard = (m: any) => {
  const text = Array.isArray(m.parts)
    ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
    : m.content || '';
  navigator.clipboard.writeText(text);
  setCopiedId(m.id);
  setTimeout(() => setCopiedId(null), 2000);
};

// 将 File 对象转为 base64 data URL，确保可序列化到 localStorage
const fileToAttachment = (file: File): Promise<{ name: string; contentType: string; url: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      contentType: file.type || 'application/octet-stream',
      url: reader.result as string,
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const onFormSubmit = async (e?: any) => {
  if (e) e.preventDefault();
  if ((!localInput.trim() && selectedFiles.length === 0) || isLoading) return;
  const val = localInput;
  setLocalInput('');
  const filesToUpload = [...selectedFiles];
  setSelectedFiles([]);
  try {
    // 将文件转为 base64 附件，确保渲染和 localStorage 持久化都正常
    const attachments = filesToUpload.length > 0
      ? await Promise.all(filesToUpload.map(fileToAttachment))
      : undefined;
    await sendMessage(
      { content: val, role: 'user', experimental_attachments: attachments } as any,
      { body: { modelId: selectedModelId } }
    );
  } catch (err) {
    console.error(err);
    setLocalInput(val);
    setSelectedFiles(filesToUpload);
  }
};

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
            <Terminal className="w-3 h-3" />
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

return (
  <div className="min-h-screen bg-[#FCF9F8] text-[#1C1B1B] font-sans selection:bg-[#EC5B14]/20" onDragOver={handleDragOver}>

    {/* 1. 侧边栏 (Fixed App Shell) */}
    <Sidebar 
      activeMainTab={activeTab} 
      onMainTabChange={setActiveTab} 
      onOpenSettings={() => setIsSettingsOpen(true)}
      onNewChat={handleNewChat}
      conversations={conversations}
      currentChatId={currentChatId}
      onLoadConversation={loadConversation}
      onRenameConversation={handleRenameChat}
      onDeleteConversation={handleDeleteChat}
      onFavoriteConversation={handleFavoriteChat}
    />

    {/* 2. 主区域 (Fluid Workspace) */}
    <main className="ml-64 flex-1 flex flex-col relative h-screen">

      {/* Drag Overlay */}
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

      {/* Header removed as styling is now fully minimalist */}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Chat / Left Panel */}
        {activeTab === 'chat' || !activeTab ? (
          <div className="flex-1 flex flex-col relative overflow-hidden">
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
                          <h3 className="text-xl font-bold font-display text-[#1C1B1B] mb-2 cursor-default">Deployment Efficiency Optimized</h3>
                          <p className="text-[#716B67] text-sm leading-relaxed max-w-xl">
                            Based on current GitLab PR patterns and Jenkins pipeline history, I've identified a bottleneck in the staging environment.
                          </p>
                          <div className="flex gap-4 mt-6">
                            <div className="bg-white px-5 py-4 rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] min-w-[140px]">
                              <p className="text-[11px] text-[#716B67] font-semibold mb-1">Projected Improvement</p>
                              <p className="text-2xl font-bold font-display text-[#EC5B14]">15% Faster Cycle</p>
                            </div>
                            <div className="bg-white px-5 py-4 rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] min-w-[140px]">
                              <p className="text-[11px] text-[#716B67] font-semibold mb-1">Success Probability</p>
                              <p className="text-2xl font-bold font-display text-[#0066CC]">94%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    messages.map((m: any) => (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={m.id} className={cn("flex flex-col group", m.role === 'user' ? "items-end" : "items-start w-full")}>
                        <div className={cn("flex", m.role === 'user' ? "justify-end max-w-full" : "w-full")}>
                          <div className={cn(
                            "py-3 px-5 rounded-[16px] text-[14px]",
                            m.role === 'user' 
                              ? "bg-white border border-[#E8E4E2]/60 text-[#1C1B1B] shadow-[0_4px_20px_rgba(0,0,0,0.02)] max-w-[85%]" 
                              : "bg-transparent text-[#1C1B1B] w-full"
                          )}>
                            {/* Visual Attachment Indicators — clickable to preview */}
                            {(m.experimental_attachments || m.attachments) && (m.experimental_attachments || m.attachments).length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-[#E8E4E2]/40">
                                {(m.experimental_attachments || m.attachments).map((at: any, idx: number) => {
                                  const isImage = at.contentType?.startsWith('image/') || at.type?.startsWith('image/');
                                  const displayUrl = at.url || (at.data ? `data:${at.contentType || at.type};base64,${at.data}` : '');
                                  const isActive = previewAttachment?.name === at.name && previewAttachment?.url === displayUrl;
                                  
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => setPreviewAttachment(isActive ? null : { name: at.name, contentType: at.contentType || at.type || '', url: displayUrl })}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border max-w-[200px] transition-all ${
                                        isActive
                                          ? 'bg-[#EC5B14]/10 border-[#EC5B14]/40 text-[#EC5B14]'
                                          : 'bg-[#F6F3F2] border-[#E8E4E2]/60 hover:border-[#EC5B14]/30 hover:bg-[#EC5B14]/5'
                                      }`}
                                    >
                                      {isImage && displayUrl ? (
                                        <div className="w-6 h-6 rounded-md bg-white border border-[#E8E4E2] overflow-hidden flex items-center justify-center shrink-0">
                                          <img src={displayUrl} alt={at.name} className="w-full h-full object-cover" />
                                        </div>
                                      ) : (
                                        <FileText className="w-4 h-4 shrink-0" />
                                      )}
                                      <span className="text-[11px] font-bold truncate" title={at.name}>
                                        {at.name}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {Array.isArray(m.parts) ? (
                              m.parts.map((part: any, i: number) => (
                                <div key={i} className="prose prose-slate prose-sm max-w-none">
                                  {part.type === 'text' && <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>}
                                  {renderToolResult(part)}
                                </div>
                              ))
                            ) : (
                              <div className="prose prose-slate prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {m.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={cn("flex items-center gap-3 px-12 mt-2", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => copyToClipboard(m)} className="p-1 hover:bg-[#F6F3F2] rounded-md text-[#716B67]">{copiedId === m.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</button>
                            {m.role === 'assistant' && <button onClick={() => reload?.()} className="p-1 hover:bg-[#F6F3F2] rounded-md text-[#716B67]"><RotateCcw className="w-3 h-3" /></button>}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

             {/* Bottom Input Area */}
            <div className="pt-2 pb-8 px-8 bg-gradient-to-t from-[#FCF9F8] via-[#FCF9F8] to-transparent z-10 w-full mt-auto">
              <div className="max-w-[800px] mx-auto relative">
                <div className="bg-white/70 backdrop-blur-md rounded-2xl p-2 flex flex-col shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-[#1C1B1B]/5 transition-all focus-within:ring-[#EC5B14]/30 focus-within:shadow-[0_10px_40px_-10px_rgba(236,91,20,0.15)]">
                  
                  {/* File Preview Bar */}
                  <AnimatePresence>
                    {selectedFiles.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-wrap gap-2 px-4 py-2 border-b border-[#E8E4E2]/40 overflow-hidden"
                      >
                        {selectedFiles.map((file, idx) => (
                          <motion.div 
                            key={`${file.name}-${idx}`}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex items-center gap-2 bg-[#F6F3F2] px-3 py-1.5 rounded-xl border border-[#E8E4E2]/60 group transition-all hover:border-[#EC5B14]/30"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#716B67]" />
                            <span className="text-xs font-semibold text-[#1C1B1B] max-w-[120px] truncate">{file.name}</span>
                            <button 
                              onClick={() => removeFile(idx)}
                              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white text-[#716B67] hover:text-red-500 transition-colors"
                            >
                              <CloseIcon className="w-3 h-3" />
                            </button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <textarea
                    ref={textAreaRef}
                    rows={1}
                    value={localInput}
                    onChange={(e) => setLocalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isLoading) onFormSubmit();
                      }
                    }}
                    placeholder="Type your instruction..." 
                    className="w-full bg-transparent border-none text-[#1C1B1B] focus:ring-0 text-sm py-4 px-4 resize-none min-h-[56px] max-h-[200px] placeholder:text-[#716B67]/70 focus:outline-none"
                  />
                  <div className="flex items-center justify-between px-4 pb-2">
                      <div className="flex items-center gap-1.5">
                        {/* Model Selector */}
                        <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
                           <DropdownMenuTrigger asChild>
                             <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14] transition-all border border-transparent hover:border-[#E8E4E2]/40">
                               <activeModel.icon className={cn("w-4 h-4", activeModel.color)} />
                               <span className="text-[11px] font-bold tracking-tight">{activeModel.name}</span>
                               <ChevronDown className={cn("w-3 h-3 transition-transform", isModelDropdownOpen ? "rotate-180" : "")} />
                             </button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="start" className="w-60 border-[#E8E4E2] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-2xl p-1.5 backdrop-blur-xl bg-white/90">
                             <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase text-[#716B67] tracking-widest">Available Models</DropdownMenuLabel>
                             <DropdownMenuSeparator className="bg-[#E8E4E2]/40" />
                             <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                               {models.map((m) => (
                                 <DropdownMenuItem 
                                   key={m.id} 
                                   onClick={() => setSelectedModelId(m.id)}
                                   className={cn(
                                     "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all mb-0.5",
                                     selectedModelId === m.id ? "bg-[#EC5B14]/5" : "hover:bg-[#F6F3F2]"
                                   )}
                                 >
                                   <div className="flex items-center gap-3">
                                     <div className={cn("p-2 rounded-lg bg-white shadow-sm border border-[#E8E4E2]/40", m.color)}>
                                       <m.icon className="w-4 h-4" />
                                     </div>
                                     <div className="flex flex-col">
                                       <span className="text-[13px] font-bold text-[#1C1B1B]">{m.name}</span>
                                       <span className="text-[10px] text-[#716B67] font-medium">{m.provider}</span>
                                     </div>
                                   </div>
                                   {selectedModelId === m.id && (
                                     <div className="bg-[#EC5B14] rounded-full p-0.5 shadow-[0_2px_8px_rgba(236,91,20,0.3)]">
                                       <Check className="w-2.5 h-2.5 text-white" />
                                     </div>
                                   )}
                                 </DropdownMenuItem>
                               ))}
                             </div>
                           </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-px h-4 bg-[#E8E4E2]/60 mx-1" />

                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={onFileChange} 
                          className="hidden" 
                          multiple 
                        />
                        <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className={cn(
                            "p-2 rounded-lg transition-colors group relative",
                            selectedFiles.length > 0 ? "text-[#EC5B14]" : "text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14]"
                          )}
                        >
                          <Paperclip className="w-5 h-5" />
                          {selectedFiles.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-[#EC5B14] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                              {selectedFiles.length}
                            </span>
                          )}
                        </button>

                        <button 
                          onClick={() => setIsSearchMode(!isSearchMode)} 
                          className={cn(
                            "p-2 rounded-lg transition-all transform active:scale-95",
                            isSearchMode 
                              ? "text-[#EC5B14]" 
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
                              ? "text-[#EC5B14]" 
                              : "text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14]"
                          )}
                        >
                          <Database className="w-5 h-5" />
                        </button>
                      </div>
                    <button 
                      onClick={() => isLoading ? stop() : onFormSubmit()} 
                      disabled={!isLoading && !localInput.trim() && selectedFiles.length === 0} 
                      className={cn(
                        "text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:shadow-none shadow-lg",
                        isLoading 
                          ? "bg-[#1C1B1B] hover:bg-[#1C1B1B]/80 shadow-[#1C1B1B]/20" 
                          : "bg-gradient-to-br from-[#EC5B14] to-[#cc4900] hover:scale-[1.02] active:scale-95 shadow-[#EC5B14]/30"
                      )}
                    >
                      {isLoading ? <Square className="w-4 h-4 fill-current" /> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (<SettingsView />) : activeTab === 'library' ? (<SkillLibrary />) : activeTab === 'knowledge' ? (<KnowledgeBase />) : activeTab === 'console' ? (<Dashboard />) : (<UIGallery />)}
        
        {/* Sidebar right: File Preview Panel OR Integrations Panel */}
        {(activeTab === 'chat' || !activeTab) && (
          <aside className={`bg-[#FCF9F8] border-l border-[#E8E4E2]/50 flex flex-col overflow-hidden hidden lg:flex transition-all duration-300 ${previewAttachment ? 'w-[560px]' : 'w-[320px]'}`}>

          {previewAttachment ? (
            /* ── File Preview Panel ── */
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4E2]/50 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[#EC5B14] shrink-0" />
                  <span className="text-xs font-bold text-[#1C1B1B] truncate" title={previewAttachment.name}>{previewAttachment.name}</span>
                </div>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-lg hover:bg-[#F6F3F2] text-[#716B67] hover:text-[#1C1B1B] transition-colors shrink-0"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {previewAttachment.contentType.startsWith('image/') ? (
                  <div className="p-4 flex items-center justify-center">
                    <img src={previewAttachment.url} alt={previewAttachment.name} className="max-w-full rounded-xl border border-[#E8E4E2]/60" />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="prose prose-slate prose-xs max-w-none text-[13px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {(() => {
                          try {
                            if (previewAttachment.url.startsWith('data:')) {
                              const b64 = previewAttachment.url.split(',')[1];
                              // 使用 TextDecoder 正确解码 UTF-8（支持中文等多字节内容）
                              const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                              return new TextDecoder('utf-8').decode(bytes);
                            }
                            return previewAttachment.url;
                          } catch {
                            return '无法解码文件内容';
                          }
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
            
            {/* Active Integrations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-sm text-[#1C1B1B]">Active Integrations</h4>
                <button className="text-[11px] font-bold text-[#EC5B14] hover:underline">Manage</button>
              </div>
              <div className="space-y-3">
                <div className="card-floating p-4 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] bg-[#1C1B1B] flex items-center justify-center text-white font-bold text-xs">GL</div>
                    <div>
                      <p className="text-sm font-bold text-[#1C1B1B]">GitLab</p>
                      <p className="text-[11px] text-[#716B67]">2 Pending MRs</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <div className="card-floating p-4 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] bg-[#0E1529] flex items-center justify-center text-red-500 font-bold text-xs"><Cpu className="w-4 h-4"/></div>
                    <div>
                      <p className="text-sm font-bold text-[#1C1B1B]">Jenkins</p>
                      <p className="text-[11px] text-[#716B67]">1 Pipeline Running</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-[#EC5B14]"></div>
                </div>
                <div className="card-floating p-4 flex items-center justify-between group flex-col items-start gap-2">
                   <div className="w-full flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[8px] bg-blue-100 flex items-center justify-center text-blue-600"><Database className="w-4 h-4"/></div>
                        <div>
                          <p className="text-sm font-bold text-[#1C1B1B]">ZenTao</p>
                          <p className="text-[11px] text-[#716B67]">4 Active Tasks</p>
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                   </div>
                </div>
              </div>
            </div>

            {/* Conversation Meta */}
            <div>
              <h4 className="text-[10px] font-extrabold text-[#716B67] uppercase tracking-widest mb-4">Conversation Meta</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#716B67]">Model</span>
                  <span className="text-xs font-bold text-[#1C1B1B] flex items-center gap-1">
                    uClaw-4o <BadgeCheck className="w-3 h-3 text-[#EC5B14]" />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#716B67]">Tokens used</span>
                  <span className="text-xs font-mono font-bold text-[#1C1B1B]">1,402</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#716B67]">Legal Review Mode</span>
                  <span className="bg-[#EC5B14]/10 text-[#EC5B14] px-2 py-0.5 rounded-full text-[10px] font-bold">STRICT</span>
                </div>
              </div>
            </div>

            {/* Weekly Insight Module */}
            <div className="mt-auto">
              <div className="relative rounded-[16px] overflow-hidden aspect-square group cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E8E4E2]/50">
                <img 
                  alt="Office View" 
                  className="absolute inset-0 w-full h-full object-cover grayscale opacity-20 transition-all duration-700 group-hover:scale-110" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAr81NID_90Yy5CvYiCWyQuR_y9N_VafML_ttYyYtfSjf9jKr6XGdQbphqaCw1RNRV7cXKmhd7mCGXKD7zFngPrXo_X9rsn5SOJ_Zm33YJYNwgHgqAMynf0rzM6r8fHecJFgX3JfJUo09Gcb_tYo4uzHiM9j8dPiCGm-gia9TTdnFa3LGPxoKpBvdM0OACh_MqUpC0qNufnob3xIDqaVuMh5orjOJfsmCRQRTUQlwwnBkvCyMbhVztwLZqJMRJuxsJODFHj3ECVE40"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F6F3F2] via-[#F6F3F2]/50 to-transparent"></div>
                <div className="relative h-full p-5 flex flex-col justify-end">
                  <p className="text-[10px] font-bold text-[#716B67] uppercase tracking-widest mb-1.5">Weekly Insight</p>
                  <p className="text-sm font-bold text-[#1C1B1B] leading-snug">New California labor regulations take effect Jan 1, 2025.</p>
                  <button className="mt-3 text-[11px] font-bold text-[#EC5B14] flex items-center gap-1 group-hover:gap-2 transition-all">
                    Review Update <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            </div>
          )}
          </aside>
        )}
      </div>

    </main>
    <SettingsModal 
      isOpen={isSettingsOpen} 
      onClose={() => setIsSettingsOpen(false)} 
      onNavigateSettings={() => {
        setActiveTab('settings');
        setIsSettingsOpen(false);
      }}
    />
  </div>
);
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/chat/:id" element={<AppContent />} />
    </Routes>
  );
}

export default App;
