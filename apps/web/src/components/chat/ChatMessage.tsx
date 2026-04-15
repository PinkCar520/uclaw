import React from 'react';
import { 
  Sparkles, RotateCcw, Check, Copy, Pencil, ThumbsUp, ThumbsDown, FileText, Square
} from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';
import { 
  parseReasoningToSteps, 
  getFriendlyToolName,
  type ThinkingStep
} from '../../lib/chat-utils';
import { ThinkingList } from '../ThinkingList';
import { CapsuleAnchor } from '../CapsuleAnchor';
import { TypingCursor } from './ChatHelpers';
import { MarkdownComponents } from './MarkdownConfig';
import { ToolInvocationRenderer } from './ToolInvocationRenderer';
import { 
  Tooltip, 
  TooltipTrigger, 
  TooltipContent 
} from '../ui/tooltip';

interface ChatMessageProps {
  message: any;
  idx: number;
  isLast: boolean;
  isLoading: boolean;
  reducedMotion: boolean;
  t: any;
  getLocalizedName: any;
  copyToClipboard: (m: any) => void;
  copiedId: string | null;
  messageFeedback: Record<string, 'up' | 'down'>;
  setMessageFeedback: React.Dispatch<React.SetStateAction<Record<string, 'up' | 'down'>>>;
  handleRegenerate: (id: string) => void;
  startEditing: (id: string, content: string) => void;
  editingMessageId: string | null;
  editText: string;
  setEditText: (val: string) => void;
  submitEdit: (id: string) => void;
  cancelEdit: () => void;
  setPreviewAttachment: (attachment: any) => void;
  previewAttachment: any;
  activeCapsule: any;
  setActiveCapsule: (capsule: any) => void;
  sendMessage: (msg: any) => Promise<void>;
  branchIndex: Record<string, number>;
  isStopped: boolean;
}

export const ChatMessage = React.memo(({
  message: m,
  idx,
  isLast,
  isLoading,
  reducedMotion,
  t,
  getLocalizedName,
  copyToClipboard,
  copiedId,
  messageFeedback,
  setMessageFeedback,
  handleRegenerate,
  startEditing,
  editingMessageId,
  editText,
  setEditText,
  submitEdit,
  cancelEdit,
  setPreviewAttachment,
  previewAttachment,
  activeCapsule,
  setActiveCapsule,
  sendMessage,
  branchIndex,
  isStopped,
}: ChatMessageProps) => {
  const isAssistant = m.role === 'assistant';
  const isUser = m.role === 'user';
  const isStreaming = isLast && isLoading && isAssistant;
  const hasContent = m.content || (Array.isArray(m.parts) && m.parts.some((p: any) => p.text || p.type === 'reasoning'));

  const messageAnimation = reducedMotion
    ? { initial: false, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  return (
    <motion.div {...messageAnimation} key={m.id || idx} className={cn("flex flex-col group", isUser ? "items-end" : "items-start w-full")}>
      <div className={cn("flex w-full gap-4", isUser ? "justify-end" : "justify-start")}>
        {isAssistant && (
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#EC5B14] to-[#FF8C42] flex items-center justify-center shadow-[0_4px_15px_rgba(236,91,20,0.3)] text-white shrink-0 mt-1">
            <Sparkles className="w-4 h-4" />
          </div>
        )}
        <div className={cn(
          "py-3 rounded-[20px] text-[15px] leading-relaxed",
          isUser
            ? "bg-[#eeece9] text-[#1C1B1B] max-w-[85%] px-5"
            : "bg-transparent text-[#1C1B1B] flex-1 min-w-0"
        )}>
          {(m.experimental_attachments || m.attachments) && (m.experimental_attachments || m.attachments).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-[#E8E4E2]/40">
              {(m.experimental_attachments || m.attachments).map((at: any, aidx: number) => {
                const isImage = at.contentType?.startsWith('image/') || at.type?.startsWith('image/');
                const displayUrl = at.url || (at.data ? `data:${at.contentType || at.type};base64,${at.data}` : '');
                const isActive = previewAttachment?.name === at.name && previewAttachment?.url === displayUrl;
                return (
                  <button
                    key={aidx}
                    onClick={() => setPreviewAttachment(isActive ? null : { name: at.name, contentType: at.contentType || at.type || '', url: displayUrl })}
                    className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border max-w-[200px] transition-all", isActive ? 'bg-[#EC5B14]/10 border-[#EC5B14]/40 text-[#EC5B14]' : 'bg-[#F6F3F2] border-[#E8E4E2]/60 hover:border-[#EC5B14]/30 hover:bg-[#EC5B14]/5')}
                  >
                    {isImage && displayUrl ? <div className="w-6 h-6 rounded-md bg-white border border-[#E8E4E2] overflow-hidden flex items-center justify-center shrink-0"><img src={displayUrl} alt={at.name} className="w-full h-full object-cover" /></div> : <FileText className="w-4 h-4 shrink-0" />}
                    <span className="text-[11px] font-bold truncate" title={at.name}>{at.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!hasContent && isAssistant && isLoading ? (
            <ThinkingList steps={[{ label: t('chat.thinking'), status: 'active' }]} />
          ) : Array.isArray(m.parts) ? (
            <div className="flex flex-col gap-1">
              {(() => {
                const allThinkingSteps: ThinkingStep[] = [];
                const completedTools: any[] = [];
                const textParts: any[] = [];

                m.parts.forEach((part: any) => {
                  const isTool = part.type === 'tool-invocation' || part.toolName || part.type?.startsWith('tool-');
                  const isReasoning = part.type === 'reasoning';

                  if (isTool) {
                    const isCompleted = !!(part.output || part.result);
                    allThinkingSteps.push({
                      label: getFriendlyToolName(part, t, getLocalizedName),
                      status: isCompleted ? 'done' : 'active',
                    });
                    if (isCompleted) {
                      completedTools.push(part);
                    }
                  } else if (isReasoning) {
                    const reasoningSteps = parseReasoningToSteps(part.text, isStreaming, false);
                    allThinkingSteps.push(...reasoningSteps);
                  } else {
                    textParts.push(part);
                  }
                });

                if (isStreaming && allThinkingSteps.length > 0) {
                  const hasTextContent = textParts.some(p => p.type === 'text' && p.text?.trim());
                  if (!hasTextContent) {
                    allThinkingSteps[allThinkingSteps.length - 1].status = 'active';
                  }
                } else if (allThinkingSteps.length > 0 && !isStreaming) {
                  allThinkingSteps.forEach(s => s.status = 'done');
                }

                const hasAnySteps = allThinkingSteps.length > 0 || completedTools.length > 0;

                return (
                  <>
                    {allThinkingSteps.length > 0 && (
                      <ThinkingList steps={allThinkingSteps} />
                    )}
                    {!hasAnySteps && isStreaming && (
                      <ThinkingList steps={[{ label: t('chat.thinking'), status: 'active' }]} />
                    )}
                    {textParts.map((part: any, i: number) => (
                      <div key={i} className="prose prose-slate prose-sm max-w-none">
                        {part.type === 'text' && (
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                            {part.text}
                          </ReactMarkdown>
                        )}
                      </div>
                    ))}
                    {isStreaming && <TypingCursor />}
                    {completedTools.map((part: any) => {
                      const result = part.output || part.result;
                      if (result?.ui) {
                        return (
                          <CapsuleAnchor
                            key={part.toolCallId}
                            uiType={result.ui.uiType}
                            isActive={activeCapsule?.toolCallId === part.toolCallId}
                            onClick={() => setActiveCapsule({ toolCallId: part.toolCallId, uiKit: result.ui })}
                          />
                        );
                      }
                      return (
                        <ToolInvocationRenderer
                          key={part.toolCallId}
                          part={part}
                          t={t}
                          getLocalizedName={getLocalizedName}
                          sendMessage={sendMessage}
                          setPreviewAttachment={setPreviewAttachment}
                        />
                      );
                    })}
                  </>
                );
              })()}
            </div>
          ) : (
            editingMessageId === m.id ? (
              <div className="space-y-3">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      submitEdit(m.id);
                    }
                    if (e.key === 'Escape') {
                      cancelEdit();
                    }
                  }}
                  autoFocus
                  rows={Math.min(6, editText.split('\n').length + 1)}
                  className="w-full bg-white border border-[#E8E4E2] rounded-xl px-4 py-3 text-sm text-[#1C1B1B] focus:ring-2 focus:ring-[#EC5B14]/30 focus:border-[#EC5B14]/30 outline-none resize-none"
                />
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-[10px] text-[#716B67]/60 mr-auto hidden sm:inline">
                    {t('chat.edit.hint', '⌘Enter to save, Esc to cancel')}
                  </span>
                  <button onClick={cancelEdit} className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#716B67] hover:bg-[#F6F3F2] transition-colors">{t('common.cancel')}</button>
                  <button onClick={() => submitEdit(m.id)} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#EC5B14] text-white hover:bg-[#d44e00] transition-colors">{t('chat.edit.save', 'Save & Send')}</button>
                </div>
              </div>
            ) : (
              <div className="prose prose-slate prose-sm max-w-none relative">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{m.content}</ReactMarkdown>
                {isStreaming && <TypingCursor />}
                {isStreaming && (
                  <div className="mt-1">
                    <ThinkingList steps={[{ label: t('chat.thinking'), status: 'active' }]} />
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
      <div className={cn(
        "flex items-center gap-3 mt-2 transition-opacity duration-300",
        isUser ? "px-5 flex-row-reverse" : "px-12 flex-row",
        (isAssistant && isLoading && isLast) ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        <div className="flex items-center gap-1 transition-opacity">
          {isUser && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={() => startEditing(m.id, m.content || '')} className="p-1.5 hover:bg-[#F6F3F2] rounded-md text-[#716B67]" aria-label={t('common.edit', 'Edit message')}><Pencil className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">{t('common.edit', 'Edit message')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button onClick={() => copyToClipboard(m)} className="p-1.5 hover:bg-[#F6F3F2] rounded-md text-[#716B67]" aria-label={copiedId === m.id ? t('common.copied') : t('common.copy', 'Copy message')}>{copiedId === m.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">{copiedId === m.id ? t('common.copied') : t('common.copy')}</TooltipContent>
          </Tooltip>
          {isAssistant && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={() => setMessageFeedback(prev => ({ ...prev, [m.id]: prev[m.id] === 'up' ? undefined : 'up' }))} className={cn("p-1.5 rounded-md transition-colors", messageFeedback[m.id] === 'up' ? "bg-[#EC5B14]/10 text-[#EC5B14]" : "hover:bg-[#F6F3F2] text-[#716B67]")} aria-label={t('common.good_response', 'Good response')}><ThumbsUp className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">{t('common.good_response', 'Good response')}</TooltipContent>
            </Tooltip>
          )}
          {isAssistant && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={() => setMessageFeedback(prev => ({ ...prev, [m.id]: prev[m.id] === 'down' ? undefined : 'down' }))} className={cn("p-1.5 rounded-md transition-colors", messageFeedback[m.id] === 'down' ? "bg-red-500/10 text-red-500" : "hover:bg-[#F6F3F2] text-[#716B67]")} aria-label={t('common.bad_response', 'Bad response')}><ThumbsDown className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">{t('common.bad_response', 'Bad response')}</TooltipContent>
            </Tooltip>
          )}
          {isAssistant && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={() => handleRegenerate(m.id)} className="p-1.5 hover:bg-[#F6F3F2] rounded-md text-[#716B67]" aria-label={t('common.regenerate', 'Regenerate response')}><RotateCcw className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">{t('common.regenerate')}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {m.createdAt && <span className="text-[10px] text-[#716B67]/60 font-mono">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        {isUser && (branchIndex[m.id] || 0) > 0 && <span className="text-[10px] text-[#716B67]/60 font-mono">{branchIndex[m.id] + 1}</span>}
        {isAssistant && isStopped && isLast && <span className="text-[10px] text-[#716B67] font-medium flex items-center gap-1"><Square className="w-3 h-3 fill-current" />{t('chat.stopped', '已停止')}</span>}
      </div>
    </motion.div>
  );
});
