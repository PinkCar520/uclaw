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
  ChevronRight,
  Globe,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';

interface Conversation {
  id: string;
  title: string;
  messages: any[];
  timestamp: number;
  favorited?: boolean;
}

interface SidebarProps {
  activeMainTab: string;
  onMainTabChange: (id: string) => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  conversations?: Conversation[];
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
  chat: Conversation;
  isActive: boolean;
  onLoad: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onFavorite: () => void;
}) {
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
        <div className="w-full px-3 py-2.5 rounded-[12px] bg-white ring-2 ring-[#EC5B14]/30 shadow-sm flex items-center gap-2">
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
      className="relative px-2 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => setIsRenaming(true)}
    >
      <button
        onClick={onLoad}
        title={chat.title}
        className={cn(
          'w-full text-left px-3 py-2.5 text-sm font-medium rounded-[12px] transition-all flex items-center gap-2 min-w-0',
          isActive
            ? 'bg-[#eeece9] text-[#1C1B1B]'
            : 'text-[#716B67] hover:text-[#1C1B1B] hover:bg-[#eeece9]'
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
              <DropdownMenuItem onClick={onFavorite} className="gap-3 py-2.5 cursor-pointer">
                <Star className={cn('w-4 h-4 transition-colors', chat.favorited ? 'text-amber-400 fill-amber-400' : 'text-[#716B67]')} />
                <span>{chat.favorited ? 'Unfavorite' : 'Favorite'}</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setIsRenaming(true)} className="gap-3 py-2.5 cursor-pointer">
                <Pencil className="w-4 h-4 text-[#716B67]" />
                <span>Rename</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setIsConfirmOpen(true)} className="gap-3 py-2.5 text-[#EF4444] focus:text-[#EF4444] focus:bg-[#FEF2F2] cursor-pointer">
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[460px] sm:rounded-[16px] gap-0 p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1C1B1B]">Delete Chat?</DialogTitle>
            <DialogDescription className="pt-3 text-base text-[#716B67] leading-relaxed">
              This will permanently delete the conversation "<span className="font-semibold text-[#1C1B1B]">{chat.title}</span>"<br />
              and its message history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-10 flex sm:justify-end gap-3">
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="px-8 py-2.5 rounded-[12px] border border-[#E8E4E2] text-sm font-bold text-[#716B67] hover:bg-[#F1EFEB] transition-colors min-w-[100px]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDelete();
                setIsConfirmOpen(false);
              }}
              className="px-8 py-2.5 rounded-[12px] bg-[#EF4444] text-sm font-bold text-white hover:bg-[#D93636] transition-all shadow-[0_4px_12px_rgba(239,68,68,0.05)] min-w-[100px]"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Sidebar ──
export function Sidebar({
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

  // Favorites first, then by timestamp desc
  const recentChats = [...conversations]
    .sort((a, b) => {
      if (a.favorited && !b.favorited) return -1;
      if (!a.favorited && b.favorited) return 1;
      return b.timestamp - a.timestamp;
    })
    .slice(0, 12);

  const navItems = [
    { id: 'library', icon: FolderOpen, label: 'Library' },
    { id: 'workflows', icon: GitMerge, label: 'Workflows' },
    { id: 'knowledge', icon: BookOpen, label: 'Knowledge' },
    { id: 'console', icon: TerminalSquare, label: 'Console' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#f6f3f2] flex flex-col shrink-0 z-50">

      {/* 1. Logo Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#EC5B14] p-1.5 rounded-lg shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-[#1C1B1B] text-xl leading-none">uClaw</span>
            <span className="text-[9px] font-bold text-[#716B67] uppercase tracking-widest mt-0.5">Enterprise AI</span>
          </div>
        </div>
      </div>

      {/* 2. New Chat CTA */}
      <div className="px-5 space-y-3 mt-4">
        <button
          onClick={onNewChat}
          className="w-full h-11 flex items-center justify-start gap-3 bg-white px-4 rounded-[8px] border border-[#E8E4E2]/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all"
        >
          <div className="bg-[#EC5B14]/10 p-1 rounded-md">
            <Plus className="w-4 h-4 text-[#EC5B14]" />
          </div>
          <span className="text-[#EC5B14] font-semibold text-sm">New Chat</span>
        </button>
      </div>

      {/* 3. Navigation Links */}
      <nav className="px-3 mt-8 space-y-1">
        {navItems.map((item) => {
          const isActive = activeMainTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onMainTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] font-medium text-sm transition-all focus:outline-none',
                isActive
                  ? 'bg-white shadow-sm text-[#1C1B1B]'
                  : 'text-[#716B67] hover:bg-[#1C1B1B]/5 hover:text-[#1C1B1B]'
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 4. Recent Activity — real conversations */}
      <div className="flex-1 px-5 mt-10 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-bold text-[#716B67] uppercase tracking-widest">Recent Activity</h4>
        </div>
        <div className="space-y-0.5 -mx-2">
          {recentChats.length === 0 ? (
            <p className="px-2 text-[11px] text-[#716B67]/60 italic">No conversations yet</p>
          ) : (
            recentChats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                isActive={chat.id === currentChatId}
                onLoad={() => onLoadConversation?.(chat.id)}
                onRename={(title) => onRenameConversation?.(chat.id, title)}
                onDelete={() => onDeleteConversation?.(chat.id)}
                onFavorite={() => onFavoriteConversation?.(chat.id, !chat.favorited)}
              />
            ))
          )}
        </div>
      </div>

      {/* 5. Bottom Profile */}
      <div className="p-4 pb-3 mt-auto">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 p-2 rounded-xl border border-transparent hover:bg-white hover:border-[#E8E4E2]/50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all text-left group overflow-hidden outline-none"
        >
          <img
            src={user?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuA0oS2KtsdNSGQoheV6v31oxAq-NhwZzQ47xg8__EJhv8OqGKGnZL3wep9OPHmM8x2Ik6mpZYLUp_nlIoldi6DXVNzDnTDsq10ls1jkUj-t_evdmGKwkn_t5xfFRgHK6-mmcStkVS-zdI45IF3rmBL3mH9KmAB8N9AvKqU-Dv45N0-NNrOIrD2ZlsGh9MmfkPMjEPcNRAJQVNa20KRYE9eY-Svv7Taq6vVmmqM9HxckuxqA9UWUSYJjawCeP6JhTrR_2ym5Y9kmaeo"}
            alt="profile"
            className="w-9 h-9 rounded-full border border-[#E8E4E2] shrink-0 object-cover"
          />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-bold text-[#1C1B1B] truncate">{user?.name || 'Alex Rivera'}</span>
            <span className="text-[10px] text-[#716B67] truncate uppercase tracking-widest font-bold mt-0.5">{user?.department || 'Admin'}</span>
          </div>
          <ChevronUp className="w-4 h-4 text-[#716B67] shrink-0" />
        </button>
      </div>

    </aside>
  );
}
