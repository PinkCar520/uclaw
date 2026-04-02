import React, { useState } from 'react';
import { 
  MessageSquare, 
  Cpu, 
  Plus, 
  Settings,
  Database, 
  Sparkles,
  LayoutDashboard,
  History,
  PanelLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Activity,
  Check,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogClose
} from './ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface SidebarProps {
  activeMainTab: string;
  onMainTabChange: (id: string) => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  history: any[];
  onSelectChat: (id: string) => void;
  currentChatId: string | null;
  onRenameChat: (id: string, newTitle: string) => void;
  onDeleteChat: (id: string) => void;
}

export function Sidebar({ 
  activeMainTab, 
  onMainTabChange, 
  onOpenSettings, 
  onNewChat,
  isSidebarOpen, 
  onToggleSidebar,
  history,
  onSelectChat,
  currentChatId,
  onRenameChat,
  onDeleteChat
}: SidebarProps) {
  const { t } = useTranslation();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleRenameClick = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim() !== '') {
      onRenameChat(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteChat(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('nav.dashboard'), color: 'text-indigo-500' },
    { id: 'chat', icon: MessageSquare, label: t('nav.chat'), color: 'text-blue-500' },
    { id: 'node_monitor', icon: Activity, label: t('node.title'), color: 'text-rose-500' },
    { id: 'skill_library', icon: Cpu, label: t('nav.skill_library'), color: 'text-emerald-500' },
    { id: 'database', icon: Database, label: t('nav.database'), color: 'text-amber-500' },
  ];

  const SidebarItem = ({ item }: { item: typeof navItems[0] }) => {
    const content = (
      <button
        key={item.id}
        onClick={() => onMainTabChange(item.id)}
        className={cn(
          "flex items-center transition-all font-bold text-sm rounded-xl",
          isSidebarOpen ? "w-full px-3 py-2 gap-3" : "w-10 h-10 justify-center",
          activeMainTab === item.id 
            ? "bg-slate-100 text-slate-900" 
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        )}
      >
        <item.icon className={cn(isSidebarOpen ? "w-4 h-4" : "w-5 h-5", activeMainTab === item.id ? item.color : "text-slate-400")} />
        {isSidebarOpen && <span>{item.label}</span>}
      </button>
    );

    if (!isSidebarOpen) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside className={cn(
      "flex flex-col bg-white border-r border-slate-200 h-full shrink-0 overflow-hidden z-30 transition-all duration-300",
      isSidebarOpen ? "w-[280px]" : "w-16 items-center"
    )}>
      
      {/* 1. 顶部：Logo 与 折叠按钮联动 */}
      <div className={cn("p-6 pb-2 space-y-6 w-full", !isSidebarOpen && "px-0 flex flex-col items-center")}>
        <div className={cn("flex items-center justify-between px-2 w-full", !isSidebarOpen && "px-0 justify-center pt-2")}>
          {isSidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-1.5 rounded-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-black text-slate-800 tracking-tighter text-lg">UClaw</span>
              </div>
              <Button 
                variant="ghost" size="icon"
                onClick={onToggleSidebar}
                className="h-8 w-8 text-slate-400"
              >
                <PanelLeft className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" size="icon"
                  onClick={onToggleSidebar}
                  className="h-10 w-10 text-slate-400 hover:text-blue-600"
                >
                  <PanelLeft className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand Sidebar</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* New Chat 按钮 */}
        {isSidebarOpen ? (
          <Button 
            onClick={onNewChat}
            variant="outline"
            className="w-full justify-start gap-3 h-12 rounded-2xl border-slate-200 hover:border-blue-400 hover:text-blue-600 group"
          >
            <Plus className="w-4 h-4 text-blue-600 group-hover:rotate-90 transition-transform" />
            <span className="text-xs font-bold tracking-wide">{t('chat.new_chat')}</span>
          </Button>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button 
                onClick={onNewChat}
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-slate-200 hover:border-blue-400 hover:text-blue-600 group"
              >
                <Plus className="w-5 h-5 text-blue-600 group-hover:rotate-90 transition-transform" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('chat.new_chat')}</TooltipContent>
          </Tooltip>
        )}

        {/* 核心导航项 */}
        <nav className={cn("space-y-1 w-full", !isSidebarOpen && "flex flex-col items-center px-2")}>
          {navItems.map((item) => (
            <SidebarItem key={item.id} item={item} />
          ))}
        </nav>
      </div>

      {isSidebarOpen && <div className="px-6 py-2"><div className="h-px bg-slate-100 w-full" /></div>}

      {/* 2. 中部：静态展示区 (折叠时隐藏) */}
      <div className={cn("flex-1 overflow-y-auto px-4 py-4 space-y-8 w-full", !isSidebarOpen && "hidden")}>
        <section className="space-y-3">
          <div className="px-3 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History className="w-3 h-3" />
              {t('sidebar.recent_activity')}
            </h3>
          </div>
          <div className="space-y-1">
            {history.length > 0 ? (
              history.map((chat) => (
                <div key={chat.id} className="relative group/item">
                  {editingId === chat.id ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/50 rounded-xl border border-blue-200">
                      <Input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(chat.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="h-6 text-xs font-bold text-blue-700 bg-transparent border-none shadow-none p-0 focus-visible:ring-0"
                      />
                      <div className="flex gap-0.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600 hover:bg-blue-100" onClick={() => handleSaveRename(chat.id)}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:bg-blue-100" onClick={handleCancelEdit}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div 
                        onClick={() => onSelectChat(chat.id)}
                        className={cn(
                          "w-full px-3 py-2.5 rounded-xl transition-all text-left flex items-center justify-between cursor-pointer",
                          currentChatId === chat.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                        )}
                      >
                        <span className={cn(
                          "text-xs truncate flex-1 pr-2",
                          currentChatId === chat.id ? "font-bold" : "font-semibold text-slate-600 group-hover/item:text-slate-900"
                        )}>
                          {chat.title}
                        </span>
                        <div className="flex items-center">
                          <Button
                            variant="ghost" size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                            }}
                            className={cn(
                              "h-7 w-7 transition-all",
                              menuOpenId === chat.id ? "opacity-100 bg-slate-200" : "opacity-0 group-hover/item:opacity-100"
                            )}
                          >
                            <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                          </Button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {menuOpenId === chat.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 top-10 mt-1 w-36 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 p-1 z-50 overflow-hidden"
                            >
                              <button
                                onClick={(e) => handleRenameClick(e, chat.id, chat.title)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {t('common.rename')}
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(e, chat.id)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t('common.delete')}
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="px-3 text-[10px] text-slate-400 italic">No history yet</p>
            )}
          </div>
        </section>
      </div>

      {/* 3. 底部：设置 & 用户 */}
      <div className={cn("p-4 border-t border-slate-100 bg-slate-50/50 w-full flex flex-col items-center")}>
        {isSidebarOpen ? (
          <Button 
            variant="ghost"
            onClick={onOpenSettings}
            className="w-full h-auto p-3 flex items-center gap-3 justify-start rounded-xl hover:bg-white group"
          >
            <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white shrink-0">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=WangEr" alt="avatar" />
            </div>
            <div className="flex-1 flex flex-col items-start min-w-0">
              <span className="text-xs font-bold text-slate-700 truncate w-full text-left">Wang Er</span>
              <span className="text-[9px] font-mono text-slate-400 uppercase">Admin</span>
            </div>
            <Settings className="w-4 h-4 text-slate-400 group-hover:rotate-90 transition-transform duration-500" />
          </Button>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" size="icon"
                onClick={onOpenSettings}
                className="h-10 w-10 rounded-xl hover:bg-white"
              >
                <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white shrink-0">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=WangEr" alt="avatar" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-none shadow-2xl">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500 rounded-xl text-white">
                <Trash2 className="w-4 h-4" />
              </div>
              <DialogTitle className="text-sm font-bold text-slate-900">{t('common.delete')}</DialogTitle>
            </div>
          </div>

          <div className="p-8 text-center sm:text-left">
            <div className="mb-8">
              <p className="text-sm font-semibold text-slate-800 mb-2">
                {t('common.confirm_delete_title', { defaultValue: '确定要删除该对话吗？' })}
              </p>
              <DialogDescription className="text-xs text-slate-500 leading-relaxed font-medium">
                {t('common.confirm_delete_desc', { defaultValue: '此操作将永久删除该会话及其所有消息记录，且无法撤销。' })}
              </DialogDescription>
            </div>
            
            <div className="flex gap-3">
              <DialogClose asChild>
                <Button variant="secondary" className="flex-1 py-6 rounded-2xl text-xs font-bold">
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button 
                onClick={confirmDelete}
                variant="destructive"
                className="flex-1 py-6 rounded-2xl text-xs font-bold shadow-lg shadow-rose-200"
              >
                {t('common.confirm')}
              </Button>
            </div>
          </div>

          <div className="px-8 py-3 bg-slate-50 border-t border-slate-100 text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">
            Security & Privacy Protected
          </div>
        </DialogContent>
      </Dialog>

    </aside>
  );
}
