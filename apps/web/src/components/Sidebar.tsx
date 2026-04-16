import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  FolderOpen,
  GitMerge,
  BookOpen,
  TerminalSquare,
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
            className="flex-1 bg-transparent text-sm font-medium text-[#1C1B1B] outline-none min-w-0"
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
          'w-full text-left px-2.5 py-1.5 text-[14px] font-medium rounded-[8px] transition-all flex items-center gap-2 min-w-0',
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
export function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggle,
  activeMainTab,
  onMainTabChange,
  onOpenSettings,
  onNewChat,
  conversations = [],
  currentChatId,
  onLoadConversation,
  onRenameConversation,
  onDeleteConversation,
  onFavoriteConversation,
  user,
  onLogout,
}: SidebarProps) {
  const { t, i18n } = useTranslation();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

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

    conversations.forEach(chat => {
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
    { id: 'mcp', icon: Puzzle, label: 'MCP Servers' },
    { id: 'workflows', icon: GitMerge, label: t('sidebar.workflows') },
    { id: 'knowledge', icon: BookOpen, label: t('sidebar.knowledge') },
    { id: 'console', icon: TerminalSquare, label: t('sidebar.console') },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside className={cn(
        "fixed left-0 top-0 h-screen bg-[#f6f3f2] flex flex-col shrink-0 z-50 transition-all duration-300 ease-in-out md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "w-24" : "w-64"
      )}>

        {/* 1. Logo Header */}
        <div className={cn(
          "flex items-center border-b border-[#E8E4E2]/60 h-14",
          isCollapsed ? "px-3 justify-center" : "px-5 justify-between"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="bg-[#EC5B14] p-1.5 rounded-lg shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <span className="font-display font-bold text-[#1C1B1B] text-lg leading-none">uClaw</span>
            )}
          </div>
          {/* Toggle button (desktop only) */}
          <button
            className="hidden md:flex p-2 rounded-lg hover:bg-[#1C1B1B]/5 text-[#716B67] hover:text-[#EC5B14] transition-colors"
            onClick={onToggle}
            title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {isCollapsed ? (
              <PanelRight className="w-5 h-5" />
            ) : (
              <PanelLeft className="w-5 h-5" />
            )}
          </button>
          {/* Mobile close button */}
          <button className="md:hidden p-1.5 text-[#716B67]" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Global Actions (New Chat & Search) */}
        <div className={cn("space-y-1 mt-3", isCollapsed ? "px-2" : "px-3")}>
          <button
            onClick={onNewChat}
            className={cn(
              "w-full flex items-center justify-start text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B] transition-all",
              isCollapsed ? "p-2.5 justify-center" : "px-2.5 py-1.5 gap-2.5 rounded-[8px]"
            )}
            title={t('sidebar.new_chat')}
          >
            <Plus className={cn("text-[#EC5B14]", "w-4 h-4")} />
            {!isCollapsed && (
              <span className="text-[#1C1B1B] font-semibold text-[14px]">{t('sidebar.new_chat')}</span>
            )}
          </button>

          <button
            onClick={() => setIsSearchModalOpen(true)}
            className={cn(
              "w-full flex items-center transition-all text-[#1C1B1B] hover:bg-[#1C1B1B]/5",
              isCollapsed ? "justify-center p-2.5" : "gap-3 px-2.5 py-1.5 rounded-[8px]"
            )}
            title={i18n.language === 'zh' ? '搜索聊天' : 'Search Chats'}
          >
            <Search className={cn("text-[#716B67]", "w-4 h-4")} />
            {!isCollapsed && (
              <span className="font-medium text-[14px] flex-1 text-left">{i18n.language === 'zh' ? '搜索聊天' : 'Search Chats'}</span>
            )}
            {!isCollapsed && (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#A8A4A1] bg-white border border-[#E8E4E2]/60 shrink-0">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Separator */}
        <div className={cn("border-t border-[#E8E4E2]/60", isCollapsed ? "mx-2 mt-3" : "mx-3 mt-3")} />

        {/* 3. Navigation Links (Platform Modules) */}
        <nav className={cn("mt-3 space-y-1 relative", isCollapsed ? "px-2" : "px-3")}>
          {navItems.map((item) => {
            const isActive = activeMainTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onMainTabChange(item.id)}
                className={cn(
                  'w-full flex items-center font-medium text-[14px] transition-all focus:outline-none',
                  isCollapsed ? "justify-center p-2.5" : "items-center gap-3 px-2.5 py-1.5 rounded-[8px]",
                  isActive
                    ? 'bg-[#1C1B1B]/[0.06] text-[#1C1B1B]'
                    : 'text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B]'
                )}
                title={item.label}
              >
                <item.icon className="w-4 h-4" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
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
              'w-full flex items-center gap-3 px-2.5 py-1.5 mb-2 rounded-[8px] font-medium text-[14px] transition-all focus:outline-none',
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
        <div className={cn("pb-3 mt-auto", isCollapsed ? "p-2" : "p-4")}>
          <button
            onClick={onOpenSettings}
            className={cn(
              "w-full flex items-center border border-transparent hover:bg-white hover:border-[#E8E4E2]/50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all text-left group overflow-hidden outline-none",
              isCollapsed ? "justify-center p-1 rounded-full" : "gap-3 p-2 rounded-xl"
            )}
            title={user?.name || 'Alex Rivera'}
          >
            <div className="relative">
              <img
                src={user?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuA0oS2KtsdNSGQoheV6v31oxAq-NhwZzQ47xg8__EJhv8OqGKGnZL3wep9OPHmM8x2Ik6mpZYLUp_nlIoldi6DXVNzDnTDsq10ls1jkUj-t_evdmGKwkn_t5xfFRgHK6-mmcStkVS-zdI45IF3rmBL3mH9KmAB8N9AvKqU-Dv45N0-NNrOIrD2ZlsGh9MmfkPMjEPcNRAJQVNa20KRYE9eY-Svv7Taq6vVmmqM9HxckuxqA9UWUSYJjawCeP6JhTrR_2ym5Y9kmaeo"}
                alt="profile"
                className="w-8 h-8 rounded-full border border-[#E8E4E2] shrink-0 object-cover"
              />
              {isCollapsed && <NodeStatusIndicator token={localStorage.getItem('uclaw_auth_token')} isCollapsed={true} />}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1C1B1B] truncate">{user?.name || 'Alex Rivera'}</span>
                  <NodeStatusIndicator token={localStorage.getItem('uclaw_auth_token')} isCollapsed={false} />
                </div>
                <span className="text-[10px] text-[#716B67] truncate uppercase tracking-widest font-bold mt-0.5">{user?.department || t('sidebar.admin')}</span>
              </div>
            )}
            {!isCollapsed && <ChevronUp className="w-4 h-4 text-[#716B67] shrink-0" />}
          </button>
        </div>

      </aside>
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        conversations={conversations}
        onSelectChat={(id) => {
          if (onLoadConversation) onLoadConversation(id);
        }}
      />
    </>
  );
}
