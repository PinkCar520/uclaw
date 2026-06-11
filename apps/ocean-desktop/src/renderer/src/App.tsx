import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Sparkles,
  Cloud,
  Cpu,
  Menu,
} from 'lucide-react';
import { ChatSession } from '@ocean/ui/components/ChatSession';
import { useTranslation } from 'react-i18next';
import { Dashboard } from '@ocean/ui/components/Dashboard';
import { SettingsDialog } from '@ocean/ui/components/SettingsDialog';
import { UIGallery } from '@ocean/ui/components/UIGallery';
import { SkillLibrary } from '@ocean/ui/components/SkillLibrary';
import { MCPServerManager } from '@ocean/ui/components/MCPServerManager';
import { KnowledgeBase } from '@ocean/ui/components/KnowledgeBase';
import { Projects } from '@ocean/ui/components/Projects';
import { AllChatsManager } from '@ocean/ui/components/AllChatsManager';
import { Sidebar } from '@ocean/ui/components/Sidebar';
import { SettingsModal } from '@ocean/ui/components/SettingsModal';
import { AuthPage } from '@ocean/ui/components/AuthPage';
import { useConversations } from '@ocean/ui/lib/useConversations';
import { cn } from '@ocean/ui/lib/utils';
import { Toaster } from '@ocean/ui/components/GlobalToast';
import { api } from '@ocean/ui/lib/api-client';

import { WorkspaceProvider, useWorkspace } from '@ocean/ui/contexts/WorkspaceContext';

function AppContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id: sessionIdFromUrl } = useParams<{ id?: string }>();
  
  // ── Global Authentication & Identity State ──
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ocean_auth_token'));
  const [user, setUser] = useState<any>(null);

  return (
    <WorkspaceProvider token={token}>
      <AppInternal 
        token={token} 
        setToken={setToken} 
        user={user} 
        setUser={setUser} 
        sessionIdFromUrl={sessionIdFromUrl}
      />
    </WorkspaceProvider>
  );
}

function AppInternal({ token, setToken, user, setUser, sessionIdFromUrl }: any) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeProject, setActiveProjectId } = useWorkspace();

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('ocean_active_tab');
    return saved || 'chat';
  });

  useEffect(() => {
    localStorage.setItem('ocean_active_tab', activeTab);
  }, [activeTab]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Used for UserMenu Popover
  const [isMainSettingsOpen, setIsMainSettingsOpen] = useState(false); // Used for Settings Dialog Modal
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('ocean_sidebar_collapsed');
    return saved === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const newState = !current;
      localStorage.setItem('ocean_sidebar_collapsed', String(newState));
      return newState;
    });
  };

  const handleLoginSuccess = (newToken: string, userData: any) => {
    localStorage.setItem('ocean_auth_token', newToken);
    localStorage.setItem('ocean_user_id', userData.workId);
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('ocean_auth_token');
    localStorage.removeItem('ocean_user_id');
    setToken(null);
    setUser(null);
    navigate('/');
  };

  // ── Server-First 会话管理 ──
  const {
    isInitialized,
    conversations,
    currentMessages,
    isLoadingMessages,
    createSession,
    handleNewChat,
    loadConversation,
    handleRenameChat,
    handleDeleteConversations,
    onStreamFinished,
  } = useConversations({
    token,
    sessionId: sessionIdFromUrl ?? null,
    navigate,
    onAuthExpired: handleLogout,
    onUserProfile: setUser,
    t,
  });

  useEffect(() => {
    if (activeTab === 'chat') return;
    const tabNames: Record<string, string> = {
      library: t('sidebar.library'),
      workflows: t('sidebar.workflows'),
      projects: t('sidebar.projects') || 'Projects',
      settings: t('settings.title'),
      all_chats: t('sidebar.all_chats'),
    };
    const name = tabNames[activeTab] || activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    document.title = `Ocean - ${name}`;
  }, [activeTab, t]);

  const handleDeleteChat = (id: string) => {
    handleDeleteConversations([id]);
  };

  const loadConversationAndActivate = (id: string) => {
    loadConversation(id);
    setActiveTab('chat');
  };

  const handleNewChatAndActivate = () => {
    handleNewChat();
    setActiveTab('chat');
  };

  const [models, setModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(() => localStorage.getItem('ocean_selected_model') || '');

  useEffect(() => {
    if (selectedModelId) {
      localStorage.setItem('ocean_selected_model', selectedModelId);
    }
  }, [selectedModelId]);

  // 动态获取可用模型
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const json = await api.get<any>('/api/chat/models');
        const data = Array.isArray(json) ? json : (json.models || []);

        const iconMap: Record<string, any> = {
          'Sparkles': Sparkles,
          'Cloud': Cloud,
          'Cpu': Cpu,
          'Zap': Sparkles, // fallback for Zap icon
        };
        const formattedModels = data.map((m: any) => ({
          ...m,
          icon: iconMap[m.icon] || Sparkles
        }));

        setModels(formattedModels);

        if (formattedModels.length > 0) {
          const exists = formattedModels.some((m: any) => m.id === selectedModelId);
          if (!selectedModelId || !exists) {
            setSelectedModelId(formattedModels[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
      }
    };
    if (token) fetchModels();
  }, [token]);

  const [projects, setProjects] = useState<any[]>([]);

  // 动态获取项目列表（供全局命令菜单使用）
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get<any>('/api/knowledge-projects');
        if (res.success) setProjects(res.data);
      } catch (err) {
        console.error('Failed to fetch projects for command menu:', err);
      }
    };
    if (token) fetchProjects();
  }, [token, activeTab]);

  if (!token) {
    return (
      <>
        <Toaster />
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  if (!isInitialized) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#f6f3f2]"><div className="animate-pulse font-bold text-[#716B67]">Loading...</div></div>;
  }

  return (
    <div className="flex h-screen w-full bg-[#f6f3f2] font-sans selection:bg-[#EC5B14]/10 selection:text-[#EC5B14]">
      <Toaster />
      {/* 1. 侧边栏 (Fixed App Shell) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
        activeMainTab={activeTab}
        onMainTabChange={(id: string) => { setActiveTab(id); }}
        onOpenSettings={() => { setIsSettingsOpen(true); }}
        onNewChat={handleNewChatAndActivate}
        conversations={conversations}
        currentChatId={sessionIdFromUrl ?? null}
        onLoadConversation={loadConversationAndActivate}
        onRenameConversation={handleRenameChat}
        onDeleteConversation={handleDeleteChat}
        onFavoriteConversation={() => {}} // Favorite 功能可后续实现
        user={user}
        onLogout={handleLogout}
      />
      {/* 2. 主区域 (Fluid Workspace) */}
      <main className={cn(
        "flex-1 flex flex-col relative h-screen max-w-full overflow-hidden transition-all duration-300",
        isSidebarCollapsed ? "md:ml-0" : "md:ml-64"
      )}>
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-[#E8E4E2] bg-white shrink-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-[#716B67] hover:bg-[#F6F3F2] rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-[#1C1B1B] text-lg">Ocean</span>
          <div className="w-9" />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'chat' || !activeTab ? (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <ChatSession
                sessionId={sessionIdFromUrl ?? null}
                initialMessages={currentMessages}
                models={models}
                selectedModelId={selectedModelId}
                setSelectedModelId={setSelectedModelId}
                token={token}
                user={user}
                createSession={createSession}
                onStreamFinished={onStreamFinished}
                onRenameConversation={handleRenameChat}
                isLoadingHistory={isLoadingMessages}
                onMainTabChange={(id: string) => setActiveTab(id)}
                t={t}
              />
            </div>
          ) : activeTab === 'all_chats' ? (
            <AllChatsManager
              conversations={conversations}
              onLoadConversation={loadConversationAndActivate}
              onDeleteConversations={handleDeleteConversations}
            />
          ) : activeTab === 'library' ? (
            <SkillLibrary token={token} />
          ) : activeTab === 'projects' ? (
            activeProject?.id ? (
              <KnowledgeBase 
                projectId={activeProject.id} 
                onBack={() => setActiveProjectId(null)} 
              />
            ) : (
              <Projects />
            )
          ) : (
            <UIGallery />
          )}
        </div>

      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onNavigateSettings={() => {
          setIsMainSettingsOpen(true);
          setIsSettingsOpen(false);
        }}
        onLogout={handleLogout}
        user={user}
      />
      <SettingsDialog 
        isOpen={isMainSettingsOpen} 
        onClose={() => setIsMainSettingsOpen(false)} 
        token={token} 
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
