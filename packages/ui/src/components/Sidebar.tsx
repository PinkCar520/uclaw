import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  FolderOpen,
  FolderRoot,
  GitMerge,
  BookOpen,
  Sparkles,
  MoreHorizontal,
  Star,
  Pencil,
  Trash2,
  Check,
  X,
  Settings,
  LogOut,
  HelpCircle,
  Globe,
  ChevronUp,
  History,
  Search,
  PanelLeft,
  PanelRight,
  Puzzle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { GlobalSearchModal } from './GlobalSearchModal';
import { NodeStatusIndicator } from './NodeStatusIndicator';
import { useProjects } from '../lib/useProjects';
import { ProjectCreateModal } from './ProjectCreateModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from './ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import type { ConversationSummary } from '../lib/useConversations';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
  activeMainTab: string;
  onMainTabChange: (id: string) => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  conversations?: ConversationSummary[];
  currentChatId?: string | null;
  onLoadConversation?: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onDeleteConversation?: (id: string) => void;
  onFavoriteConversation?: (id: string, favorited: boolean) => void;
  user?: any;
  onLogout?: () => void;
}



// ── Single conversation row ──
function ChatRow({
  chat,
  isActive,
  onLoad,
  onRename,
  onDelete,
  onFavorite,
}: {
  chat: ConversationSummary;
  isActive: boolean;
  onLoad: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onFavorite: () => void;
}) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [expandedDateGroups, setExpandedDateGroups] = useState<Record<string, boolean>>({});
  const [renameValue, setRenameValue] = useState(chat.title);
  const renameRef = useRef<HTMLInputElement>(null);

  // Focus input when rename mode activates
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(chat.title);
      setTimeout(() => renameRef.current?.select(), 50);
    }
  }, [isRenaming]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== chat.title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setRenameValue(chat.title);
    setIsRenaming(false);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (isRenaming) {
    return (
      <div className="px-2">
        <div className="w-full px-3 py-1.5 rounded-[12px] bg-white ring-2 ring-[#EC5B14]/30 shadow-sm flex items-center gap-2">
          {chat.favorited && (
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
          )}
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') cancelRename();
            }}
            className="flex-1 bg-transparent text-[13px] font-medium text-[#1C1B1B] outline-none min-w-0"
            autoFocus
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => setIsRenaming(true)}
    >
      <button
        onClick={onLoad}
        title={chat.title}
        className={cn(
          'w-full text-left px-2.5 py-1.5 text-[13px] font-medium rounded-[8px] transition-all flex items-center gap-2 min-w-0',
          isActive
            ? 'bg-[#1C1B1B]/[0.06] text-[#1C1B1B]'
            : 'text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B]'
        )}
      >
        {chat.favorited && (
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
        )}
        <span className="truncate flex-1">{chat.title}</span>
      </button>

      {/* Three-dot trigger — using standard DropdownMenu for reliability */}
      {(isHovered || menuOpen || isActive) && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[60]">
          <DropdownMenu onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'p-1.5 rounded-lg transition-all outline-none',
                  menuOpen
                    ? 'text-[#EC5B14]'
                    : 'text-[#716B67] hover:text-[#1C1B1B]'
                )}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44 border-[#dddddd] shadow-[0_5px_10px_rgba(0,0,0,0.01)]">
              <DropdownMenuItem onClick={onFavorite} className="gap-3 py-1.5 cursor-pointer">
                <Star className={cn('w-4 h-4 transition-colors', chat.favorited ? 'text-amber-400 fill-amber-400' : 'text-[#716B67]')} />
                <span>{chat.favorited ? t('sidebar.unfavorite') : t('sidebar.favorite')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setIsRenaming(true)} className="gap-3 py-1.5 cursor-pointer">
                <Pencil className="w-4 h-4 text-[#716B67]" />
                <span>{t('sidebar.rename')}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setIsConfirmOpen(true)} className="gap-3 py-1.5 text-[#EF4444] focus:text-[#EF4444] focus:bg-[#FEF2F2] cursor-pointer">
                <Trash2 className="w-4 h-4" />
                <span>{t('sidebar.delete')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[460px] sm:rounded-[16px] gap-0 p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1C1B1B]">{t('sidebar.delete_chat_title')}</DialogTitle>
            <DialogDescription className="pt-3 text-base text-[#716B67] leading-relaxed">
              {t('sidebar.delete_chat_desc', { title: chat.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-10 flex sm:justify-end gap-3">
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="px-8 py-1.5 rounded-[12px] border border-[#E8E4E2] text-sm font-bold text-[#716B67] hover:bg-[#F1EFEB] transition-colors min-w-[100px]"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                onDelete();
                setIsConfirmOpen(false);
              }}
              className="px-8 py-1.5 rounded-[12px] bg-[#EF4444] text-sm font-bold text-white hover:bg-[#D93636] transition-all shadow-[0_4px_12px_rgba(239,68,68,0.05)] min-w-[100px]"
            >
              {t('common.delete')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Sidebar ──
import { useWorkspace, type ProjectCategory } from '../contexts/WorkspaceContext';
import { api } from '../lib/api-client';

function ProjectRow({
  project,
  isActive,
  onClick,
  onDeleted
}: {
  project: any;
  isActive: boolean;
  onClick: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(project.name);
      setTimeout(() => renameRef.current?.select(), 50);
    }
  }, [isRenaming]);

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project.name) {
      // 假设有重命名 API，实际中应该在这里调用
      // await api.put(`/api/knowledge-projects/${project.id}`, { name: trimmed });
    }
    setIsRenaming(false);
  };

  const handleRevealInFinder = async () => {
    try {
      const match = project.description?.match(/\(path:(.*?)\)/);
      const targetPath = match && match[1] ? match[1] : undefined;

      if ((window as any).api?.revealInFinder) {
        const res = await (window as any).api.revealInFinder(targetPath || project.id);
        if (!res.success) {
          alert('在 Finder 中显示失败: ' + res.error + '\n路径: ' + (targetPath || project.id));
        }
      } else {
        alert('未检测到桌面端环境 (window.api 为空)，无法调用系统 Finder。');
        await api.post('/api/user/node/reveal-in-finder', {
          path: targetPath,
          projectId: project.id
        });
      }
    } catch (err) {
      console.error('Failed to reveal in finder:', err);
      alert('发生异常: ' + err);
    }
  };

  const handleDelete = async () => {
    if (confirm(`确定要移除项目 "${project.name}" 吗？此操作不会删除本地文件。`)) {
      try {
        await api.delete(`/api/knowledge-projects/${project.id}`);
        onDeleted?.();
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  if (isRenaming) {
    return (
      <div className="px-2 pl-6 mt-1">
        <div className="w-full px-3 py-1.5 rounded-[12px] bg-white ring-2 ring-[#EC5B14]/30 shadow-sm flex items-center gap-2">
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="flex-1 bg-transparent text-[12px] font-medium text-[#1C1B1B] outline-none min-w-0"
            autoFocus
          />
        </div>
      </div>
    );
  }

  // 提取纯净的项目名或路径展示
  const displayName = project.name || 'Untitled';
  const isLocal = project.description?.includes('(path:');

  return (
    <div
      className="relative group pl-6 pr-2 mt-0.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => setIsRenaming(true)}
    >
      <button
        onClick={onClick}
        title={displayName}
        className={cn(
          'w-full text-left px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-all flex items-center gap-2 min-w-0',
          isActive
            ? 'bg-[#1C1B1B]/[0.06] text-[#1C1B1B]'
            : 'text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B]'
        )}
      >
        <FolderRoot className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span className="truncate flex-1">{displayName}</span>
      </button>

      {(isHovered || menuOpen) && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[60]">
          <DropdownMenu onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'p-1 rounded-md transition-all outline-none',
                  menuOpen
                    ? 'text-[#EC5B14] bg-[#1C1B1B]/5'
                    : 'text-[#716B67] hover:text-[#1C1B1B] hover:bg-[#1C1B1B]/10'
                )}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48 border-[#dddddd] shadow-[0_5px_10px_rgba(0,0,0,0.05)] rounded-xl py-1.5">
              <DropdownMenuItem className="gap-3 py-2 cursor-pointer font-medium text-[13px]">
                <Star className="w-4 h-4 text-[#716B67]" />
                <span>置顶项目</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleRevealInFinder} className="gap-3 py-2 cursor-pointer font-medium text-[13px]">
                <FolderOpen className="w-4 h-4 text-[#716B67]" />
                <span>在 Finder 中显示</span>
              </DropdownMenuItem>

              <DropdownMenuItem className="gap-3 py-2 cursor-pointer font-medium text-[13px]">
                <GitMerge className="w-4 h-4 text-[#716B67]" />
                <span>创建永久工作树</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setIsRenaming(true)} className="gap-3 py-2 cursor-pointer font-medium text-[13px]">
                <Pencil className="w-4 h-4 text-[#716B67]" />
                <span>重命名项目</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem className="gap-3 py-2 cursor-pointer font-medium text-[13px]">
                <BookOpen className="w-4 h-4 text-[#716B67]" />
                <span>归档项目</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleDelete} className="gap-3 py-2 text-[#EF4444] focus:text-[#EF4444] focus:bg-[#FEF2F2] cursor-pointer font-medium text-[13px]">
                <Trash2 className="w-4 h-4" />
                <span>移除</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function ProjectQuickAddDropdown({ onCreated }: { onCreated?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isNaming, setIsNaming] = useState(false);

  const handlePickLocalPath = async () => {
    try {
      let path = '';
      if ((window as any).api?.openFolderPicker) {
        const res = await (window as any).api.openFolderPicker();
        if (res.success && res.path) path = res.path;
      } else {
        const res = await api.post<any>('/api/user/node/open-folder-picker');
        if (res.success && res.path) path = res.path;
      }

      if (path) {
        // 用最后的文件夹名作为项目名
        const name = path.split(/[/\\]/).pop() || 'Imported Project';
        await api.post<any>('/api/knowledge-projects', {
          name,
          category: 'Engineering',
          description: `(path:${path})`
        });
        onCreated?.();
      }
    } catch (err) {
      console.error('Failed to trigger local picker:', err);
      alert('无法调起本地助手。请确保 UClaw 本地助手（Daemon）已启动并处于登录状态。');
    }
    setMenuOpen(false);
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#716B67] hover:text-[#1C1B1B] hover:bg-[#1C1B1B]/10 transition-all z-10">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-56 border-[#dddddd] shadow-lg rounded-xl">
          <DropdownMenuItem onClick={() => { setMenuOpen(false); setIsNaming(true); }} className="gap-3 py-2 cursor-pointer font-medium">
            <FolderRoot className="w-4 h-4 text-[#716B67]" />
            <span>New Project</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePickLocalPath} className="gap-3 py-2 cursor-pointer font-medium">
            <FolderOpen className="w-4 h-4 text-[#716B67]" />
            <span>Quick Start (Open Folder)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectCreateModal 
        isOpen={isNaming} 
        onClose={() => setIsNaming(false)} 
        onCreated={() => {
          setIsNaming(false);
          onCreated?.();
        }} 
      />
    </>
  );
}

interface SidebarProps {
  // ... other props
  onOpenSearch?: () => void; // 新增可选 prop
}

export function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggle,
  activeMainTab,
  onMainTabChange,
  onOpenSettings,
  onOpenSearch, // 接收
  onNewChat,
  conversations,
  currentChatId,
  onLoadConversation,
  onRenameConversation,
  onDeleteConversation,
  onFavoriteConversation,
  user,
  onLogout
}: any) {
  const { t, i18n } = useTranslation();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const { projects, fetchProjects: fetchProjectsData } = useProjects();
  const { activeProject, setActiveProjectId } = useWorkspace();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const ipc = (window as any).electron?.ipcRenderer;
    
    const checkFullscreen = async () => {
      if (ipc) {
        try {
          const isFull = await ipc.invoke('is-fullscreen');
          if (mounted) setIsFullscreen(isFull);
        } catch (e) {
          // ignore error if handler not ready
        }
      } else {
        // Fallback for web mode
        setIsFullscreen(window.innerHeight === window.screen.height);
      }
    };
    
    checkFullscreen();

    if (ipc) {
      const callback = (_e: any, isFull: boolean) => {
        if (mounted) setIsFullscreen(isFull);
      };
      ipc.on('fullscreen-change', callback);
      return () => {
        mounted = false;
        ipc.removeListener('fullscreen-change', callback);
      };
    } else {
      const handleResize = () => setIsFullscreen(window.innerHeight === window.screen.height);
      window.addEventListener('resize', handleResize);
      return () => {
        mounted = false;
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // 动态获取项目列表（供全局命令菜单使用）
  useEffect(() => {
    const token = localStorage.getItem('uclaw_auth_token');
    if (token) fetchProjectsData();
  }, [fetchProjectsData]);


  // Cmd+K / Ctrl+K 快捷键打开搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 移除内部强制排序，严格遵循 App.tsx 传入的原始数组顺序（Index 排序）
  const recentChats = conversations.slice(0, 12);

  // 按日期分组：Today / Yesterday / Last 7 days / Older
  type GroupKey = 'today' | 'yesterday' | 'last7' | 'older';
  const groupOrder: GroupKey[] = ['today', 'yesterday', 'last7', 'older'];

  const groupedChats = (() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const last7Start = todayStart - 7 * 86400000;

    const groups: Record<GroupKey, ConversationSummary[]> = {
      today: [],
      yesterday: [],
      last7: [],
      older: [],
    };

    conversations.forEach((chat: any) => {
      const updatedAt = new Date(chat.updatedAt).getTime();
      if (updatedAt >= todayStart) groups.today.push(chat);
      else if (updatedAt >= yesterdayStart) groups.yesterday.push(chat);
      else if (updatedAt >= last7Start) groups.last7.push(chat);
      else groups.older.push(chat);
    });

    return groups;
  })();

  const groupLabels: Record<GroupKey, string> = {
    today: t('sidebar.today', 'Today'),
    yesterday: t('sidebar.yesterday', 'Yesterday'),
    last7: t('sidebar.last_7_days', 'Last 7 days'),
    older: t('sidebar.older', 'Older'),
  };

  const navItems = [
    { id: 'library', icon: FolderOpen, label: t('sidebar.library') },
    { id: 'workflows', icon: GitMerge, label: t('sidebar.workflows') },
    { id: 'projects', icon: FolderRoot, label: t('sidebar.projects') || 'Projects' },
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={onClose} />
      )}

      {/* 
        MacOS Desktop Permanent Drag Region 
        Start it after the traffic lights and sidebar toggle so it doesn't cover controls.
        This ensures the OS doesn't apply its fallback 38px unclickable drag zone over our button when the sidebar is hidden.
      */}
      <div className="hidden md:flex fixed top-0 left-[130px] right-0 h-14 z-[9998] titlebar-drag" />

      {/* Fixed Toggle Button (Desktop Only) */}
      <div
        className={cn(
          "hidden md:flex fixed z-[9999] titlebar-no-drag transition-all duration-300",
          isFullscreen ? "left-[20px] top-4" : "left-[90px] top-[4px]"
        )}
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          className="w-6 h-6 inline-flex items-center justify-center rounded-md hover:bg-[#1C1B1B]/10 text-[#716B67] hover:text-[#1C1B1B] transition-colors cursor-pointer titlebar-no-drag"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={onToggle}
          title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {isCollapsed ? (
            <PanelRight className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-[#f6f3f2] flex flex-col shrink-0 z-50 transition-all duration-300 ease-in-out overflow-hidden border-r border-[#E8E4E2]/60",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "md:border-r-0" : ""
        )}
        style={{
          width: typeof window !== 'undefined' && window.innerWidth >= 768
            ? (isCollapsed ? '0px' : '256px')
            : undefined
        }}
      >
        <div className="w-64 h-full flex flex-col shrink-0">
          {/* 1. Header (Mobile Close / Desktop Drag Area) */}
          <div className="flex items-center border-b border-[#E8E4E2]/60 h-14 titlebar-no-drag justify-end px-3">
            {/* Close button for mobile */}
            <button
              className="md:hidden p-1.5 text-[#716B67] titlebar-no-drag"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Global Actions (New Chat & Search) */}
          <div className="space-y-1 mt-3 px-3">
            <button
              onClick={onNewChat}
              className="w-full flex items-center justify-start font-medium text-[13px] text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B] transition-all px-2.5 py-1.5 gap-3 rounded-[8px] focus:outline-none"
              title={t('sidebar.new_chat')}
            >
              <Plus className="w-4 h-4" />
              <span>{t('sidebar.new_chat')}</span>
            </button>

            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full flex items-center font-medium text-[13px] text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B] transition-all gap-3 px-2.5 py-1.5 rounded-[8px] focus:outline-none"
              title={i18n.language === 'zh' ? '搜索聊天' : 'Search Chats'}
            >
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left">{i18n.language === 'zh' ? '搜索聊天' : 'Search Chats'}</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#A8A4A1] bg-white border border-[#E8E4E2]/60 shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Separator */}
          <div className="border-t border-[#E8E4E2]/60 mx-3 mt-3" />

          {/* 3. Navigation Links (Platform Modules) */}
          <nav className="mt-3 space-y-1 relative px-3">
            {navItems.map((item) => {
              const isActive = activeMainTab === item.id;
              return (
                <React.Fragment key={item.id}>
                  <div className="relative group flex items-center w-full">
                    <button
                      onClick={() => onMainTabChange(item.id)}
                      className={cn(
                        'w-full flex items-center font-medium text-[13px] transition-all focus:outline-none gap-3 px-2.5 py-1.5 rounded-[8px]',
                        isActive
                          ? 'bg-[#1C1B1B]/[0.06] text-[#1C1B1B]'
                          : 'text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B]'
                      )}
                      title={item.label}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                    </button>
                    {item.id === 'projects' && !isCollapsed && (
                      <ProjectQuickAddDropdown onCreated={() => { fetchProjectsData(); onMainTabChange('projects'); }} />
                    )}
                  </div>
                  {/* 渲染项目子列表 */}
                  {item.id === 'projects' && !isCollapsed && projects.length > 0 && (
                    <div className="mt-1 mb-2 space-y-0.5">
                      {projects.map((proj: any) => (
                        <ProjectRow
                          key={proj.id}
                          project={proj}
                          isActive={activeProject?.id === proj.id}
                          onClick={() => { setActiveProjectId(proj.id); onMainTabChange('chat'); }}
                          onDeleted={fetchProjectsData}
                        />
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Separator */}
          <div className={cn("border-t border-[#E8E4E2]/60", isCollapsed ? "mx-3 mt-3" : "mx-3 mt-3")} />

          {/* 4. Recent Activity & All Chats */}
          <div className={cn("flex-1 mt-5 overflow-y-auto no-scrollbar relative", isCollapsed ? "px-2 hidden" : "px-3")}>
            <div className="absolute top-0 left-6 right-6 h-px bg-[#E8E4E2] -mt-2 opacity-70" />

            <button
              onClick={() => onMainTabChange('all_chats')}
              className={cn(
                'w-full flex items-center gap-3 px-2.5 py-1.5 mb-2 rounded-[8px] font-medium text-[13px] transition-all focus:outline-none',
                activeMainTab === 'all_chats' ? 'bg-[#1C1B1B]/[0.06] text-[#1C1B1B]' : 'text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B]'
              )}
            >
              <History className="w-4 h-4" />
              <span>{t('sidebar.all_chats')}</span>
            </button>

            {/* Grouped conversation list */}
            <div className="space-y-3 mt-3">
              {conversations.length === 0 ? (
                <p className="px-2 text-[11px] text-[#716B67]/60 italic">{t('sidebar.no_conversations')}</p>
              ) : (
                groupOrder.map(groupKey => {
                  const chats = groupedChats[groupKey];
                  if (chats.length === 0) return null;
                  return (
                    <div key={groupKey}>
                      <h4 className="text-[10px] font-bold text-[#A8A4A1] uppercase tracking-widest px-2.5 mb-1.5">
                        {groupLabels[groupKey]}
                      </h4>
                      <div className="space-y-0.5">
                        {chats.map(chat => (
                          <ChatRow
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === currentChatId}
                            onLoad={() => onLoadConversation?.(chat.id)}
                            onRename={(title) => onRenameConversation?.(chat.id, title)}
                            onDelete={() => onDeleteConversation?.(chat.id)}
                            onFavorite={() => onFavoriteConversation?.(chat.id, !chat.favorited)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 5. Bottom Profile */}
          <div className="pb-3 mt-auto px-3">
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center border border-transparent hover:bg-white hover:border-[#E8E4E2]/50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all text-left group overflow-hidden outline-none gap-3 p-2 rounded-xl"
              title={user?.name || 'Alex Rivera'}
            >
              <div className="relative">
                <img
                  src={user?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuA0oS2KtsdNSGQoheV6v31oxAq-NhwZzQ47xg8__EJhv8OqGKGnZL3wep9OPHmM8x2Ik6mpZYLUp_nlIoldi6DXVNzDnTDsq10ls1jkUj-t_evdmGKwkn_t5xfFRgHK6-mmcStkVS-zdI45IF3rmBL3mH9KmAB8N9AvKqU-Dv45N0-NNrOIrD2ZlsGh9MmfkPMjEPcNRAJQVNa20KRYE9eY-Svv7Taq6vVmmqM9HxckuxqA9UWUSYJjawCeP6JhTrR_2ym5Y9kmaeo"}
                  alt="profile"
                  className="w-8 h-8 rounded-full border border-[#E8E4E2] shrink-0 object-cover"
                />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#716B67] group-hover:text-[#1C1B1B] transition-colors truncate">{user?.name || 'Alex Rivera'}</span>
                  <NodeStatusIndicator token={localStorage.getItem('uclaw_auth_token')} isCollapsed={false} />
                </div>
                <span className="text-[10px] text-[#716B67] truncate uppercase tracking-widest font-bold mt-0.5">{user?.department || t('sidebar.admin')}</span>
              </div>
              <ChevronUp className="w-4 h-4 text-[#716B67] shrink-0" />
            </button>
          </div>
        </div>
      </aside>
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        conversations={conversations}
        projects={projects}
        onSelectChat={(id) => {
          if (onLoadConversation) onLoadConversation(id);
          onMainTabChange('chat');
        }}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          onMainTabChange('chat');
          setIsSearchModalOpen(false);
        }}
      />
    </>
  );
}
