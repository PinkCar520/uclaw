import { useEffect, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import {
  ArrowUp, ArrowDown, Sparkles, Terminal,
  Search,
  Copy, RotateCcw, Check,
  Plus, FileText, X as CloseIcon, Image as ImageIcon,
  ChevronDown, Cloud, Cpu, Square, Paperclip, ArrowRight, BadgeCheck,
  Bell as BellIcon, Settings, Database, Activity, Globe, Menu
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
import { AllChatsManager } from './components/AllChatsManager';
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

  const firstSessionId = useRef('session_' + Date.now());
  const [activeSessions, setActiveSessions] = useState<{ sessionId: string, chatId: string | null, initialMessages: any[] }[]>([
    { sessionId: firstSessionId.current, chatId: null, initialMessages: [] }
  ]);
  // 用 sessionId 精确追踪当前可见 session，避免多个 null-chatId session 冲突
  const [activeSessionId, setActiveSessionId] = useState<string>(firstSessionId.current);
  const activeSessionIdRef = useRef(activeSessionId);
  
  // 同步 ref，用于在异步回调中获取最新状态
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const [activeTab, setActiveTab] = useState('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isKnowledgeMode, setIsKnowledgeMode] = useState(false);
  const [isStorageInitialized, setIsStorageInitialized] = useState(false);
  
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
    },
    async delete(key: string): Promise<void> {
      try {
        const db = await this.getDb();
        return new Promise<void>((resolve, reject) => {
          const tx = db.transaction('chats', 'readwrite');
          const store = tx.objectStore('chats');
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        console.error('IDB Delete Error:', e);
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
      setIsStorageInitialized(true);

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
          // 确保它在活跃会话中，并将其设为可见
          setActiveSessions(prev => {
            const existing = prev.find(s => s.chatId === chat.id);
            if (existing) {
              setActiveSessionId(existing.sessionId);
              // 同步消息（解决刷新竞态）
              if ((!existing.initialMessages || existing.initialMessages.length === 0) && Array.isArray(chat.messages) && chat.messages.length > 0) {
                return prev.map(s => s.sessionId === existing.sessionId ? { ...s, initialMessages: chat.messages } : s);
              }
              return prev;
            }
            const newSession = { sessionId: 'session_' + Date.now(), chatId: chat.id, initialMessages: chat.messages };
            setActiveSessionId(newSession.sessionId);
            return [...prev, newSession];
          });
        }
      }
    };

    initStorage();
  }, []);

  // 1b. 监听 conversations 变化并同步到 IndexedDB (使用防抖减少 IO 压力)
  const idbSyncTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (!isStorageInitialized) return; // Prevent overwriting DB with empty array before initial load
    if (idbSyncTimeoutRef.current) clearTimeout(idbSyncTimeoutRef.current);
    idbSyncTimeoutRef.current = setTimeout(() => {
      idb.set('uclaw_chats', conversations).catch(err => console.error('IDB sync error:', err));
    }, 1000); // 1s debounce
  }, [conversations, isStorageInitialized]);

  // 2. 监听 URL 变化，同步当前活跃 ID 和可见 Session
  useEffect(() => {
    const match = pathname.match(/\/chat\/(.+)/);
    const chatIdFromUrl = match ? match[1] : null;

    if (chatIdFromUrl && chatIdFromUrl !== currentChatId) {
      setCurrentChatId(chatIdFromUrl);
      // 检查是否已经在活跃会话中，找到则激活，并确保 initialMessages 同步
      const chat = conversations.find(c => c.id === chatIdFromUrl);
      setActiveSessions(prev => {
        const existing = prev.find(s => s.chatId === chatIdFromUrl);
        if (existing) {
          setActiveSessionId(existing.sessionId);
          // 如果现有 session 消息为空但找到了历史消息，则同步它（解决刷新竞态）
          if ((!existing.initialMessages || existing.initialMessages.length === 0) && chat && Array.isArray(chat.messages) && chat.messages.length > 0) {
            return prev.map(s => s.sessionId === existing.sessionId ? { ...s, initialMessages: chat.messages } : s);
          }
          return prev;
        }
        const newSession = { 
          sessionId: 'session_' + Date.now(), 
          chatId: chatIdFromUrl, 
          initialMessages: chat?.messages || [] 
        };
        setActiveSessionId(newSession.sessionId);
        return [...prev, newSession];
      });
      setActiveTab('chat');
    } else if (!chatIdFromUrl && pathname === '/') {
      setCurrentChatId(null);
      // 保持 activeSessionId 指向当前的 null-chatId session（无需改变）
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
        'all_chats': t('sidebar.all_chats'),
      };
      const name = tabNames[activeTab] || activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
      document.title = `uClaw - ${name}`;
    }
  }, [currentChatId, activeTab, conversations, t]);

  // 3. 消息更新回调 (由 ChatSession 触发)
  const syncTimeoutRef = useRef<Record<string, any>>({});
  const syncRetryCount = useRef<Record<string, number>>({});

  const syncChatToBackend = (chatId: string, title: string, messages: any[]) => {
    if (!token) return;
    if (syncTimeoutRef.current[chatId]) {
      clearTimeout(syncTimeoutRef.current[chatId]);
    }

    syncTimeoutRef.current[chatId] = setTimeout(async () => {
      const attemptSync = async (retries = 3, delay = 2000) => {
        try {
          const res = await fetch(`/api/session/${chatId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              title,
              channel: 'web',
              history: messages,
            })
          });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          syncRetryCount.current[chatId] = 0; // reset on success
        } catch(e) {
          console.warn(`Sync push failed for ${chatId}, retries left: ${retries}`, e);
          if (retries > 0) {
            setTimeout(() => attemptSync(retries - 1, delay * 2), delay);
          } else {
            console.error(`Final sync push failed for ${chatId}. Local DB will maintain state until next session pull.`);
          }
        }
      };

      attemptSync();
    }, 2000); // 2s debounce
  };

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

      // Trigger debounced backend sync
      syncChatToBackend(id, title, messages);

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
    // 只更新 chatId，不覆盖 initialMessages（ChatSession 正在流式输出，覆盖会导致消息消失）
    setActiveSessions(prev => prev.map(s => 
      s.sessionId === sessionId ? { ...s, chatId: newChatId } : s
    ));
    
    setCurrentChatId(newChatId);
    
    // 初始化 conversations 以便侧边栏显示（初始统一使用固定占位标题，提高响应速度）
    const title = t('sidebar.new_chat');
    
    const newConv: Conversation = {
      id: newChatId,
      title,
      messages: initialMsgs,
      timestamp: Date.now()
    };
    
    setConversations(prev => [newConv, ...prev]);

    // 关键修复：使用 Ref 获取当前“这一秒”真正的活跃会话 ID
    // 防止因为闭包导致判断了发送消息时的旧 ID
    if (activeSessionIdRef.current === sessionId) {
      setCurrentChatId(newChatId);
      navigate(`/chat/${newChatId}`, { replace: true });
    }
  };

  const handleNewChat = () => {
    const newSessionId = 'session_' + Date.now();
    setActiveSessions(prev => [
      ...prev, 
      { sessionId: newSessionId, chatId: null, initialMessages: [] }
    ]);
    // ← 关键：切换可见 session 到新的空白 session，旧 session 在后台继续运行
    setActiveSessionId(newSessionId);
    setCurrentChatId(null);
    setActiveTab('chat');
    navigate('/');
  };

  const handleRenameChat = (id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        syncChatToBackend(id, newTitle, c.messages);
        return { ...c, title: newTitle };
      }
      return c;
    }));
  };

  const handleDeleteChat = (id: string) => {
    handleDeleteConversations([id]);
  };

  const handleDeleteConversations = (ids: string[]) => {
    setConversations(prev => {
      const updated = prev.filter(c => !ids.includes(c.id));
      idb.set('uclaw_chats', updated).catch(err => console.error('Failed to sync deletion to IDB:', err));
      return updated;
    });
    
    if (token) {
      const attemptDelete = async (retries = 2) => {
        try {
          await Promise.allSettled(ids.map(id => 
            fetch(`/api/session/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            })
          ));
        } catch (e) {
          if (retries > 0) setTimeout(() => attemptDelete(retries - 1), 2000);
          else console.error(`Failed to delete sessions from server.`);
        }
      };
      attemptDelete();
    }
    if (currentChatId && ids.includes(currentChatId)) {
      handleNewChat();
    }
  };

  const handleFavoriteChat = (id: string, favorited: boolean) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, favorited } : c));
  };

  const loadConversation = (id: string) => {
    navigate(`/chat/${id}`);
    setActiveTab('chat');
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

  if (!isStorageInitialized) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#f6f3f2]"><div className="animate-pulse font-bold text-[#716B67]">Loading...</div></div>;
  }

  return (
    <div className="flex h-screen w-full bg-[#f6f3f2] font-sans selection:bg-[#EC5B14]/10 selection:text-[#EC5B14]">
      {/* 1. 侧边栏 (Fixed App Shell) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
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
      <main className="md:ml-64 flex-1 flex flex-col relative h-screen max-w-full overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-[#E8E4E2] bg-white shrink-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-[#716B67] hover:bg-[#F6F3F2] rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-[#1C1B1B] text-lg">uClaw</span>
          <div className="w-9" /> {/* spacer for center alignment */}
        </div>

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
                  isVisible={activeSessionId === session.sessionId}
                  initialMessages={session.initialMessages}
                  onChatCreated={onChatCreated}
                  onMessagesChange={onMessagesChange}
                  onRenameConversation={handleRenameChat}
                  models={models}
                  selectedModelId={selectedModelId}
                  setSelectedModelId={setSelectedModelId}
                  token={token}
                  user={user}
                  t={t}
                />
              ))}
            </div>
          ) : activeTab === 'all_chats' ? (
            <AllChatsManager
              conversations={conversations}
              onLoadConversation={loadConversation}
              onDeleteConversations={handleDeleteConversations}
            />
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
