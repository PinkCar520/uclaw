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
import { ChatSession } from './components/ChatSession';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from './lib/utils';
import { BugCard } from './components/BugCard';
import { Dashboard } from './components/Dashboard';
import { PipelineCard } from './components/PipelineCard';
import { TaskPlan } from './components/TaskPlan';
import { UserCenter } from './components/UserCenter';
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
import { AuthPage } from './components/AuthPage';

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

  const [activeSessions, setActiveSessions] = useState<{ sessionId: string, chatId: string | null, initialMessages: any[] }[]>([
    { sessionId: 'session_' + Date.now(), chatId: null, initialMessages: [] }
  ]);

  const [activeTab, setActiveTab] = useState('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isKnowledgeMode, setIsKnowledgeMode] = useState(false);
  
  // ── Global Authentication & Identity State ──
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('uclaw_auth_token'));
  const [user, setUser] = useState<any>(null);

  const handleLoginSuccess = (newToken: string, userData: any) => {
    localStorage.setItem('uclaw_auth_token', newToken);
    localStorage.setItem('uclaw_user_id', userData.workId);
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('uclaw_auth_token');
    localStorage.removeItem('uclaw_user_id');
    setToken(null);
    setUser(null);
    navigate('/');
  };

  // --- IndexedDB Storage Helper ---
  const idb = {
    db: null as IDBDatabase | null,
    async getDb() {
      if (this.db) return this.db;
      return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('uclaw_db', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('chats')) {
            request.result.createObjectStore('chats');
          }
        };
        request.onsuccess = () => {
          this.db = request.result;
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    },
    async get(key: string): Promise<any> {
      try {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('chats', 'readonly');
          const store = tx.objectStore('chats');
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        return null;
      }
    },
    async set(key: string, val: any): Promise<void> {
      try {
        const db = await this.getDb();
        return new Promise<void>((resolve, reject) => {
          const tx = db.transaction('chats', 'readwrite');
          const store = tx.objectStore('chats');
          const request = store.put(val, key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        console.error('IDB Set Error:', e);
      }
    }
  };

  // 对话持久化逻辑
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // 1. 初始化加载历史 (含 LocalStorage 迁移)
  useEffect(() => {
    const initStorage = async () => {
      // 检查迁移
      const legacy = localStorage.getItem('uclaw_chats');
      let initialData: Conversation[] = [];
      
      if (legacy) {
        try {
          initialData = JSON.parse(legacy);
          await idb.set('uclaw_chats', initialData);
          localStorage.removeItem('uclaw_chats');
          console.log('Migrated legacy chats to IndexedDB');
        } catch (e) {
          console.error('Migration failed:', e);
        }
      } else {
        const saved = await idb.get('uclaw_chats');
        if (saved) initialData = saved;
      }

      setConversations(initialData);

      if (!token) return;

      // Fetch User Center assets from backend
      try {
        const res = await fetch('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-user-id': localStorage.getItem('uclaw_user_id') || ''
          }
        });
        const data = await res.json();
        if (data.success) {
          setUser(data.profile);
        } else if (res.status === 401) {
          handleLogout();
        }
      } catch (e) {
        console.error('Core user sync failed');
      }

      // 如果当前 URL 有 ID，尝试恢复对话
      const match = pathname.match(/\/chat\/(.+)/);
      const chatIdFromUrl = match ? match[1] : null;
      if (chatIdFromUrl) {
        const chat = initialData.find((c: any) => c.id === chatIdFromUrl);
        if (chat) {
          setCurrentChatId(chat.id);
          // 确保它在活跃会话中
          setActiveSessions(prev => {
            if (prev.some(s => s.chatId === chat.id)) return prev;
            return [...prev, { sessionId: 'session_' + Date.now(), chatId: chat.id, initialMessages: chat.messages }];
          });
        }
      }
    };

    initStorage();
  }, []);

  // 1b. 监听 conversations 变化并同步到 IndexedDB
  useEffect(() => {
    if (conversations.length > 0) {
      idb.set('uclaw_chats', conversations);
    }
  }, [conversations]);

  // 2. 监听 URL 变化，同步当前活跃 ID
  useEffect(() => {
    const match = pathname.match(/\/chat\/(.+)/);
    const chatIdFromUrl = match ? match[1] : null;

    if (chatIdFromUrl && chatIdFromUrl !== currentChatId) {
      setCurrentChatId(chatIdFromUrl);
      // 检查是否已经在活跃会话中，不在则加入
      const chat = conversations.find(c => c.id === chatIdFromUrl);
      setActiveSessions(prev => {
        if (prev.some(s => s.chatId === chatIdFromUrl)) return prev;
        return [...prev, { 
          sessionId: 'session_' + Date.now(), 
          chatId: chatIdFromUrl, 
          initialMessages: chat?.messages || [] 
        }];
      });
    } else if (!chatIdFromUrl && pathname === '/' && currentChatId !== null) {
      setCurrentChatId(null);
    }
  }, [pathname, conversations]);

  // 2b. 同步浏览器标题
  useEffect(() => {
    if (activeTab === 'chat') {
      if (currentChatId) {
        const chat = conversations.find(c => c.id === currentChatId);
        document.title = chat ? `uClaw - ${chat.title}` : 'uClaw - AI Assistant';
      } else {
        document.title = `uClaw - ${t('sidebar.new_chat')}`;
      }
    } else {
      const tabNames: Record<string, string> = {
        'library': t('sidebar.library'),
        'workflows': t('sidebar.workflows'),
        'knowledge': t('sidebar.knowledge'),
        'console': t('sidebar.console'),
        'settings': t('settings.title'),
      };
      const name = tabNames[activeTab] || activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
      document.title = `uClaw - ${name}`;
    }
  }, [currentChatId, activeTab, conversations, t]);

  // 3. 消息更新回调 (由 ChatSession 触发)
  const onMessagesChange = (id: string, messages: any[]) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === id);
      const existing = prev[idx];
      
      const firstMsg = messages.find((m: any) => m.role === 'user')?.content || 'New Conversation';
      const defaultTitle = firstMsg.slice(0, 25) + (firstMsg.length > 25 ? '...' : '');
      const title = existing ? existing.title : defaultTitle;
      
      const updated = { 
        ...existing, 
        id, 
        title, 
        messages, 
        timestamp: Date.now() 
      };

      if (idx > -1) {
        const newList = [...prev];
        newList[idx] = updated;
        return newList;
      } else {
        return [updated, ...prev];
      }
    });
  };

  const onChatCreated = (sessionId: string, initialMsgs: any[]) => {
    const newChatId = `chat_${Date.now()}`;
    
    // 更新会话池，关联永久 ID
    setActiveSessions(prev => prev.map(s => 
      s.sessionId === sessionId ? { ...s, chatId: newChatId, initialMessages: initialMsgs } : s
    ));
    
    setCurrentChatId(newChatId);
    
    // 初始化 conversations 以便侧边栏显示
    const firstMsg = initialMsgs[0]?.content || 'New Conversation';
    const title = firstMsg.slice(0, 25) + (firstMsg.length > 25 ? '...' : '');
    
    const newConv: Conversation = {
      id: newChatId,
      title,
      messages: initialMsgs,
      timestamp: Date.now()
    };
    
    setConversations(prev => [newConv, ...prev]);
    navigate(`/chat/${newChatId}`, { replace: true });
  };

  const handleNewChat = () => {
    const newSessionId = 'session_' + Date.now();
    setActiveSessions(prev => [
      ...prev, 
      { sessionId: newSessionId, chatId: null, initialMessages: [] }
    ]);
    setCurrentChatId(null);
    setActiveTab('chat');
    navigate('/');
  };

  const handleRenameChat = (id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleDeleteChat = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) {
      handleNewChat();
    }
  };

  const handleFavoriteChat = (id: string, favorited: boolean) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, favorited } : c));
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
            'Authorization': token ? `Bearer ${token}` : '',
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
    if (token) fetchModels();
  }, [token]);

  const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Sparkles, color: 'text-slate-400' };

  if (!token) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-full bg-[#f6f3f2] font-sans selection:bg-[#EC5B14]/10 selection:text-[#EC5B14]">
      {/* 1. 侧边栏 (Fixed App Shell) */}
      <Sidebar
        activeMainTab={activeTab}
        onMainTabChange={(id) => {
          setActiveTab(id);
        }}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
        }}
        onNewChat={handleNewChat}
        conversations={conversations}
        currentChatId={currentChatId}
        onLoadConversation={loadConversation}
        onRenameConversation={handleRenameChat}
        onDeleteConversation={handleDeleteChat}
        onFavoriteConversation={handleFavoriteChat}
        user={user}
        onLogout={handleLogout}
      />{/* 2. 主区域 (Fluid Workspace) */}
      <main className="ml-64 flex-1 flex flex-col relative h-screen">
        {/* Header removed as styling is now fully minimalist */}
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat / Left Panel */}
          {activeTab === 'chat' || !activeTab ? (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {activeSessions.map((session) => (
                <ChatSession
                  key={session.sessionId}
                  id={session.sessionId}
                  chatId={session.chatId}
                  isVisible={(currentChatId === session.chatId)}
                  initialMessages={session.initialMessages}
                  onChatCreated={onChatCreated}
                  onMessagesChange={onMessagesChange}
                  models={models}
                  selectedModelId={selectedModelId}
                  setSelectedModelId={setSelectedModelId}
                  token={token}
                  user={user}
                  t={t}
                />
              ))}
            </div>
          ) : activeTab === 'settings' ? (
            <UserCenter onLogout={handleLogout} />
          ) : activeTab === 'library' ? (
            <SkillLibrary />
          ) : activeTab === 'knowledge' ? (
            <KnowledgeBase />
          ) : activeTab === 'console' ? (
            <Dashboard />
          ) : (
            <UIGallery />
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
        onLogout={handleLogout}
        user={user}
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
