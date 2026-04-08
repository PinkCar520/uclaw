import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare, CornerDownLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: any[];
  onSelectChat: (id: string) => void;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  conversations,
  onSelectChat
}: GlobalSearchModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter conversations
  const filtered = React.useMemo(() => {
    if (!query.trim()) return conversations.slice(0, 10); // Show recent 10 if no query
    const lowerQ = query.toLowerCase();
    return conversations
      .filter(c => c.title.toLowerCase().includes(lowerQ))
      .slice(0, 50); // limit to 50 results
  }, [conversations, query]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Small delay to ensure dialog has mounted before focusing
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        onSelectChat(filtered[selectedIndex].id);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onSelectChat, onClose]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Format relative time helper
  const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 3600000) return 'Past hour';
    if (diff < 86400000) return 'Today';
    if (diff < 604800000) return 'Past week';
    if (diff < 2592000000) return 'Past month';
    return 'Older';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Hidden DialogTitle for screen readers to avoid radix-ui warnings */}
      <DialogTitle className="sr-only">Search Modal</DialogTitle>
      
      <DialogContent 
        className="sm:max-w-[640px] p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-[#E8E4E2] shadow-2xl rounded-[12px] top-[15%] translate-y-0 [&>button]:hidden"
      >
        <div className="flex flex-col h-full max-h-[80vh]">
          {/* Search Input Area */}
          <div className="flex items-center px-6 py-5 border-b border-[#E8E4E2]/50 gap-4">
            <Search className="w-5 h-5 text-[#716B67]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_modal.placeholder', 'Search chats and projects...')}
              className="flex-1 bg-transparent border-none outline-none text-[16px] font-medium text-[#1C1B1B] placeholder:text-[#A8A4A1] placeholder:font-normal"
            />
            {/* ESC hint */}
            <div className="hidden sm:flex px-2 py-1 rounded-md text-[11px] font-bold text-[#A8A4A1] bg-[#F6F3F2]">
              ESC
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-[#A8A4A1] text-[15px]">
                {t('search_modal.no_results', 'No chats found')}
              </div>
            ) : (
              <div className="flex flex-col space-y-1">
                {!query && (
                  <div className="px-4 py-3 text-[11px] font-bold tracking-wider text-[#A8A4A1] uppercase mb-1">
                    {t('search_modal.recent_discussions', 'Recent Discussions')}
                  </div>
                )}
                
                {filtered.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectChat(item.id);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#1C1B1B]/[0.06]' : 'hover:bg-[#1C1B1B]/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <MessageSquare className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#1C1B1B]' : 'text-[#A8A4A1]'}`} />
                        <span className={`text-[15px] truncate ${isSelected ? 'text-[#1C1B1B] font-semibold' : 'text-[#494543] font-medium'}`}>
                          {item.title}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className="text-[12px] text-[#A8A4A1]">
                          {getRelativeTime(item.timestamp)}
                        </span>
                        {isSelected && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-[#A8A4A1]" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Footer Footer */}
          <div className="px-6 py-3 border-t border-[#E8E4E2]/50 bg-[#FBFBFB] flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#A8A4A1]">
              {t('search_modal.shortcut_hint', 'Use ↑↓ to navigate, Enter to select, Esc to close')}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
