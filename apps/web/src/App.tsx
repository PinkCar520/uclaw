import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { 
  ArrowUp, Sparkles, Terminal, 
  Search, 
  Copy, RotateCcw, Check,
  Plus, FileText, X as CloseIcon, Image as ImageIcon,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import { cn } from './lib/utils';
import { BugCard } from './components/BugCard';
import { Dashboard } from './components/Dashboard';
import { PipelineCard } from './components/PipelineCard';
import { TaskPlan } from './components/TaskPlan';
import { UIGallery } from './components/UIGallery';
import { SkillLibrary } from './components/SkillLibrary';
import { NodeMonitor } from './components/NodeMonitor';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';

interface Conversation {
  id: string;
  title: string;
  messages: any[];
  timestamp: number;
}

function App() {
  const { t } = useTranslation();
  const { messages, sendMessage, status, reload, setMessages } = useChat() as any;
  const isLoading = status === 'streaming' || status === 'submitting';

  const [localInput, setLocalInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 对话持久化逻辑
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');

  // 动态获取可用模型
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('/api/chat/models');
        if (res.ok) {
          const data = await res.json();
          // 图标组件映射
          const iconMap: Record<string, any> = { 'Sparkles': Sparkles };
          const formattedModels = data.map((m: any) => ({
            ...m,
            icon: iconMap[m.icon] || Sparkles
          }));
          setModels(formattedModels);
          if (formattedModels.length > 0) {
            setSelectedModelId(formattedModels[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('uclaw_chats');
    if (saved) {
      try {
        setConversations(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const id = currentChatId || `chat_${Date.now()}`;
    if (!currentChatId) setCurrentChatId(id);
    
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === id);
      const existing = prev[idx];
      
      const firstMsg = messages.find((m: any) => m.role === 'user')?.content || 'New Conversation';
      const defaultTitle = firstMsg.slice(0, 25) + (firstMsg.length > 25 ? '...' : '');
      const title = existing ? existing.title : defaultTitle;
      
      const updated = { id, title, messages, timestamp: Date.now() };
      let newList;
      if (idx > -1) {
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

  const loadConversation = (id: string) => {
    const chat = conversations.find(c => c.id === id);
    if (chat) {
      setCurrentChatId(chat.id);
      setMessages(chat.messages);
      setActiveTab('chat');
    }
  };

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Sparkles, color: 'text-slate-400' };

  const scrollRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
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

  const onFormSubmit = async (e?: any) => {
    if (e) e.preventDefault();
    if ((!localInput.trim() && selectedFiles.length === 0) || isLoading) return;
    const val = localInput;
    setLocalInput('');
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);
    try {
      await sendMessage({ text: val }, { body: { modelId: selectedModelId } });
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
          onConfirm={() => sendMessage({ text: 'Y' })}
          onCancel={() => sendMessage({ text: 'N' })}
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
    <div className="flex h-screen bg-[#F9FAFB] text-slate-900 font-sans selection:bg-blue-100 overflow-hidden" onDragOver={handleDragOver}>
      
      {/* 1. 侧边栏 */}
      <motion.div
        animate={{ width: isSidebarOpen ? 280 : 64 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="h-full overflow-hidden shrink-0"
      >
        <Sidebar 
          activeMainTab={activeTab} onMainTabChange={setActiveTab} onOpenSettings={() => setIsSettingsOpen(true)}
          onNewChat={handleNewChat} isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          history={conversations} onSelectChat={loadConversation} currentChatId={currentChatId}
          onRenameChat={handleRenameChat} onDeleteChat={handleDeleteChat}
        />
      </motion.div>

      {/* 2. 主区域 */}
      <main className="flex-1 flex flex-col relative bg-white overflow-hidden">
        
        {/* Drag Overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onDragLeave={handleDragLeave} onDrop={handleDrop}
              className="absolute inset-0 z-50 bg-blue-600/5 backdrop-blur-[2px] border-4 border-dashed border-blue-500/20 m-4 rounded-[40px] flex flex-col items-center justify-center text-blue-600"
            >
              <Plus className="w-12 h-12 mb-4" />
              <p className="text-xl font-bold">{t('common.drag_drop')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-all border border-slate-100 group"
              >
                <div className={cn("p-1 rounded-lg bg-slate-50 group-hover:bg-white transition-colors", activeModel.color)}>
                  <activeModel.icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[11px] font-bold text-slate-700">{activeModel.name}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">{activeModel.provider}</span>
                </div>
                <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", isModelDropdownOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isModelDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsModelDropdownOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 p-2 z-40 overflow-hidden"
                    >
                      <div className="px-3 py-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('common.model_select')}</span>
                      </div>
                      <div className="space-y-1">
                        {models.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModelId(model.id);
                              setIsModelDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all",
                              selectedModelId === model.id ? "bg-blue-50/50 text-blue-600" : "hover:bg-slate-50 text-slate-600"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <model.icon className={cn("w-4 h-4", model.color)} />
                              <div className="flex flex-col items-start">
                                <span className="text-xs font-semibold">{model.name}</span>
                                <span className="text-[10px] opacity-60 font-medium">{model.provider}</span>
                              </div>
                            </div>
                            {selectedModelId === model.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input placeholder={t('common.search_placeholder')} className="bg-slate-50 border border-slate-100 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-600 focus:outline-none w-48" />
             </div>
          </div>
        </header>

        {activeTab === 'chat' ? (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-12 scroll-smooth bg-[#F9FAFB]/30 relative">
              <div className="max-w-4xl mx-auto space-y-10">
                <AnimatePresence mode="popLayout" initial={false}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 mb-8"><Sparkles className="w-12 h-12 text-blue-600" /></div>
                      <h3 className="text-2xl font-bold text-slate-900">{t('chat.empty_title')}</h3>
                      <p className="text-sm text-slate-400 mt-4 leading-relaxed"><Trans i18nKey="chat.empty_desc">Bridge your <span className="text-slate-900 font-semibold">CLI node</span> with enterprise workflows.</Trans></p>
                    </div>
                  ) : (
                    messages.map((m: any) => (
                      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} key={m.id} className={cn("flex flex-col group", m.role === 'user' ? "items-end" : "items-start w-full")}>
                        <div className={cn("flex flex-col space-y-2", m.role === 'user' ? "max-w-[85%] items-end" : "w-full")}>
                          <div className={cn("px-7 py-4 rounded-3xl leading-relaxed text-[15px]", m.role === 'user' ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-800")}>
                            {Array.isArray(m.parts) ? m.parts.map((part: any, i: number) => <div key={i}>{part.type === 'text' && <p className="whitespace-pre-wrap">{part.text}</p>}{renderToolResult(part)}</div>) : <p className="whitespace-pre-wrap">{m.content}</p>}
                          </div>
                          <div className={cn("flex items-center gap-3 px-2 mt-1", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{m.role === 'assistant' ? t('chat.role_assistant') : t('chat.role_user')}</span>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => copyToClipboard(m)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400">{copiedId === m.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</button>
                              {m.role === 'assistant' && <button onClick={() => reload?.()} className="p-1 hover:bg-slate-100 rounded-md text-slate-400"><RotateCcw className="w-3 h-3" /></button>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 底部输入区 (TextArea 版) */}
            <div className="p-8 bg-white border-t border-slate-100 z-10">
              {/* 文件预览 */}
              <AnimatePresence>
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-4 max-w-4xl mx-auto">
                    {selectedFiles.map((file, i) => (
                      <motion.div layout key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{file.name}</span>
                        <button onClick={() => removeFile(i)} className="p-1 rounded-full bg-slate-200 text-slate-500 hover:bg-rose-500 hover:text-white"><CloseIcon className="w-3 h-3" /></button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>

              <div className="relative max-w-4xl mx-auto">
                <div className="relative flex flex-col bg-slate-50 border border-slate-200 rounded-[24px] p-2 transition-all">
                  <textarea
                    ref={textAreaRef}
                    rows={1}
                    value={localInput}
                    onChange={(e) => setLocalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onFormSubmit();
                      }
                    }}
                    placeholder={t('chat.placeholder')}
                    className="w-full bg-transparent border-none text-slate-800 text-sm focus:ring-0 focus:outline-none px-4 py-3 resize-none min-h-[44px] max-h-[200px]"
                  />
                  <div className="flex items-center justify-between px-2 pb-1 pt-1 border-t border-slate-100 mt-1">
                    <div className="flex items-center gap-1">
                      <input type="file" multiple ref={fileInputRef} onChange={onFileChange} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors"><ImageIcon className="w-4 h-4" /></button>
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors"><Plus className="w-4 h-4" /></button>
                    </div>
                    <button onClick={() => onFormSubmit()} disabled={isLoading || !localInput.trim()} className="p-2 rounded-xl bg-blue-600 text-white disabled:opacity-20 transition-all"><ArrowUp className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-4 mt-4 opacity-30">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{t('chat.status_secured')}</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{t('chat.status_stable')}</span>
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'dashboard' ? ( <Dashboard /> ) : activeTab === 'skill_library' ? ( <SkillLibrary /> ) : activeTab === 'node_monitor' ? ( <NodeMonitor /> ) : ( <UIGallery /> )}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

export default App;
