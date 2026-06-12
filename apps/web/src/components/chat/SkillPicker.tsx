import React, {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react';
import { useSkillStore } from '../../lib/skill-store';
import { Cpu, X, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface SkillPickerHandle {
  navigateUp: () => void;
  navigateDown: () => void;
  selectCurrent: () => void;
}

export const SkillPicker = forwardRef<SkillPickerHandle>((_, ref) => {
  const { catalog, pickerOpen, closePicker, selectSkill, pickerQuery } = useSkillStore();
  const [filteredCatalog, setFilteredCatalog] = useState(catalog);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerQuery) {
      setFilteredCatalog(catalog);
    } else {
      const q = pickerQuery.toLowerCase();
      setFilteredCatalog(
        catalog.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.trigger_keywords &&
              s.trigger_keywords.some((k) => k.toLowerCase().includes(q)))
        )
      );
    }
    // Reset selection when query changes
    setActiveIndex(0);
  }, [pickerQuery, catalog]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLButtonElement>('[data-skill-item]');
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  useImperativeHandle(ref, () => ({
    navigateUp: () => {
      setActiveIndex((prev) => (prev <= 0 ? Math.max(filteredCatalog.length - 1, 0) : prev - 1));
    },
    navigateDown: () => {
      setActiveIndex((prev) =>
        prev >= filteredCatalog.length - 1 ? 0 : prev + 1
      );
    },
    selectCurrent: () => {
      if (filteredCatalog[activeIndex]) {
        selectSkill(filteredCatalog[activeIndex]);
      }
    },
  }));

  if (!pickerOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 mb-2 w-[400px] max-w-full z-50"
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.18)] border border-[#E8E4E2] overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-[#E8E4E2]/60 bg-[#F6F3F2]/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#EC5B14] to-[#cc4900] flex items-center justify-center shadow-sm">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="text-[10px] font-black uppercase text-[#716B67] tracking-widest">
                Select an AI Skill
              </span>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closePicker();
              }}
              className="w-5 h-5 flex items-center justify-center rounded-md text-[#A8A4A1] hover:text-[#1C1B1B] hover:bg-[#E8E4E2]/60 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="px-3 py-1.5 border-b border-[#E8E4E2]/40 flex items-center gap-3 bg-[#FDFCFB]">
            <div className="flex items-center gap-1 text-[10px] text-[#A8A4A1]">
              <kbd className="px-1.5 py-0.5 rounded bg-[#F0EDE9] border border-[#E8E4E2] font-mono text-[9px] text-[#716B67]">↑↓</kbd>
              <span>导航</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#A8A4A1]">
              <kbd className="px-1.5 py-0.5 rounded bg-[#F0EDE9] border border-[#E8E4E2] font-mono text-[9px] text-[#716B67]">↵</kbd>
              <span>选择</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#A8A4A1]">
              <kbd className="px-1.5 py-0.5 rounded bg-[#F0EDE9] border border-[#E8E4E2] font-mono text-[9px] text-[#716B67]">Esc</kbd>
              <span>关闭</span>
            </div>
          </div>

          {/* List */}
          <div
            ref={listRef}
            className="max-h-[280px] overflow-y-auto p-1.5 space-y-0.5"
            style={{ scrollbarWidth: 'thin' }}
          >
            {filteredCatalog.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#A8A4A1]">
                <Cpu className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p>没有找到匹配的 Skill</p>
                {pickerQuery && (
                  <p className="text-xs mt-1 text-[#C8C4C1]">"{pickerQuery}"</p>
                )}
              </div>
            ) : (
              filteredCatalog.map((skill, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={skill.id}
                    data-skill-item
                    onClick={() => selectSkill(skill)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'flex flex-col gap-0.5 w-full px-3 py-2.5 rounded-lg text-left transition-all duration-100',
                      isActive
                        ? 'bg-[#EC5B14]/8 ring-1 ring-[#EC5B14]/20'
                        : 'hover:bg-[#F6F3F2]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all',
                        isActive
                          ? 'bg-gradient-to-br from-[#EC5B14] to-[#cc4900] shadow-sm'
                          : 'bg-[#F0EDE9] border border-[#E8E4E2]'
                      )}>
                        <Cpu className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-[#716B67]')} />
                      </div>
                      <span className={cn(
                        'text-[13px] font-bold transition-colors',
                        isActive ? 'text-[#EC5B14]' : 'text-[#1C1B1B]'
                      )}>
                        {skill.name}
                      </span>
                      {isActive && (
                        <span className="ml-auto text-[10px] text-[#EC5B14]/60 font-medium shrink-0">
                          ↵ 选择
                        </span>
                      )}
                    </div>
                    {skill.description && (
                      <span className={cn(
                        'text-[11px] line-clamp-1 ml-8 transition-colors',
                        isActive ? 'text-[#EC5B14]/70' : 'text-[#A8A4A1]'
                      )}>
                        {skill.description}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

SkillPicker.displayName = 'SkillPicker';

// ─── SkillChip ────────────────────────────────────────────────────────────────

export function SkillChip({
  id,
  name,
  onRemove,
}: {
  id: string;
  name: string;
  onRemove: (id: string) => void;
}) {
  return (
    <span className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EC5B14]/8 text-[#EC5B14] text-xs font-bold border border-[#EC5B14]/20 shadow-sm group animate-in zoom-in-95 duration-200">
      <Cpu className="w-3 h-3 opacity-70 shrink-0" />
      <span className="max-w-[120px] truncate">{name}</span>
      {/* X button: absolute top-right, visible on group hover */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(id);
        }}
        className={cn(
          'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full',
          'flex items-center justify-center',
          'bg-[#1C1B1B] text-white shadow-sm',
          'opacity-0 group-hover:opacity-100',
          'scale-75 group-hover:scale-100',
          'transition-all duration-150',
          'hover:bg-red-500'
        )}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}
