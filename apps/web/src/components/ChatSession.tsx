import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ThinkingList } from './ThinkingList';
import { DiffViewer } from './DiffViewer';
import { TypingCursor, BrailleSpinner } from './chat/ChatHelpers';
import { parseReasoningToSteps, getFriendlyToolName, beautifyModelName, type ThinkingStep } from '../lib/chat-utils';
import { useChatSession } from '../lib/useChatSession';
import { useChatInput } from '../lib/useChatInput';
import { ChatInput } from './chat/ChatInput';
import { ToolInvocationRenderer, ToolInvocationBadge } from './chat/ToolInvocationRenderer';
import { ChatMessage } from './chat/ChatMessage';
import { IntegrationsPanel } from './chat/IntegrationsPanel';
import { ActiveContextPanel } from './chat/ActiveContext';
import { EmptyState } from './chat/EmptyState';
import { CopyCodeButton, MarkdownComponents, CodeBlock } from './chat/MarkdownConfig';
import { api } from '../lib/api-client';

import { useChat } from '@ai-sdk/react';
import {
  ArrowDown, Sparkles, Copy, RotateCcw, Check,
  Plus, FileText, X as CloseIcon, Image as ImageIcon,
  ChevronDown, Paperclip, ArrowRight, ArrowUp, Terminal, Cpu, Database, BadgeCheck, Globe, Square,
  ThumbsUp, ThumbsDown, AlertCircle, Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { useSkillCatalog } from '../lib/useSkillCatalog';
import { UIRenderer } from './UIRenderer';
import { CapsuleAnchor } from './CapsuleAnchor';
import { BugCard } from './BugCard';
import { PipelineCard } from './PipelineCard';
import { TaskPlan } from './TaskPlan';
import { ApprovalModal } from './ApprovalModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from './ui/tooltip';

interface ChatSessionProps {
  sessionId: string | null;                  // URL 中的会话 ID（null = 新对话）
  initialMessages?: any[];                   // 从服务端拉取的历史消息
  models: any[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  token: string | null;
  user: any;
  createSession: () => Promise<string | null>; // 服务端创建新会话
  onStreamFinished: (sessionId: string) => Promise<void>; // 流完成后刷新侧边栏
  onRenameConversation?: (id: string, title: string) => void;
  isLoadingHistory?: boolean;
  t: (key: string, options?: any) => string;
}

export function ChatSession({
                              sessionId,
                              initialMessages = [],
                              models,
                              selectedModelId,
                              setSelectedModelId,
                              token,
                              user,
                              createSession,
                              onStreamFinished,
                              onRenameConversation,
                              isLoadingHistory,
                              t
                            }: ChatSessionProps) {
  const reducedMotion = useReducedMotion();

  // Custom Hook: globally fetches & caches dynamic skill names
  const { getLocalizedName } = useSkillCatalog();

  // 处理带有 autoSubmit 状态的跳转，将发送行为顺延到导航完成后进行
  const [isLocalThinking, setIsLocalThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Session Configuration State ──
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isKnowledgeMode, setIsKnowledgeMode] = useState(false);

  // ── Hooks ──
  const {
    messages, fullTree, sendMessage, status, setMessages, stop, error,
    isLoading, isStopped, setIsStopped, totalUsage, handleStop,
    sessionIdRef, titleGeneratedRef, data, switchBranch, setCurrentLeafId
  } = useChatSession({
    sessionId, initialMessages, token, selectedModelId,
    isSearchMode, isKnowledgeMode, onStreamFinished
  });

  // ── 实时解析并合并 Active Context 元数据 ──
  const activeContext = useMemo(() => {
    if (!data || !Array.isArray(data)) return null;
    const contexts = (data as any[]).filter(d => d.type === 'active-context');
    if (contexts.length === 0) return null;
    
    // 合并所有历史 Context 事件（最新的覆盖旧的）
    return contexts.reduce((acc, curr) => {
      return { 
        ...acc, 
        payload: { ...(acc.payload || {}), ...(curr.payload || {}) } 
      };
    }, { payload: {} });
  }, [data]);

  const {
    localInput, setLocalInput, attachments, addFiles, removeFile,
    textAreaRef, onFormSubmit, uploadFile, ghostText, setGhostText, isPredicting
  } = useChatInput({
    sendMessage, createSession, token, selectedModelId,
    isSearchMode, isKnowledgeMode, navigate,
    sessionIdRef, setIsLocalThinking, userScrolledUpRef, isLoading
  });

  // ── Local UI State ──
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; contentType: string; url: string } | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const [activeCapsule, setActiveCapsule] = useState<{ 
    toolCallId?: string; 
    uiKit?: any; 
    artifact?: {
      type: 'code' | 'web';
      title: string;
      content: string;
      language?: string;
    }
  } | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // ── Branching Metadata Calculation ──
  const branchMetadata = useMemo(() => {
    const totalBranches: Record<string, number> = {};
    const branchIndex: Record<string, number> = {};

    messages.forEach((m: any) => {
      // 找到该消息的所有兄弟节点（具有相同 parentId 的节点）
      const siblings = fullTree
        .filter((node: any) => node.parentId === m.parentId)
        .sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      
      totalBranches[m.id] = siblings.length;
      branchIndex[m.id] = siblings.findIndex((s: any) => s.id === m.id);
    });

    return { totalBranches, branchIndex };
  }, [messages, fullTree]);

  const onBranchChange = useCallback((msgId: string, index: number) => {
    const currentMsg = fullTree.find(m => m.id === msgId);
    if (!currentMsg) return;

    const siblings = fullTree
      .filter(node => node.parentId === currentMsg.parentId)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    
    const targetSibling = siblings[index];
    if (targetSibling) {
      switchBranch(targetSibling.id);
    }
  }, [fullTree, switchBranch]);

  // ── Effects ──
  useEffect(() => {
    if (sessionId && location.state?.autoSubmit) {
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => onFormSubmit(), 0);
    }
  }, [sessionId, location.state, navigate, onFormSubmit]);

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setIsLocalThinking(false);
    }
  }, [messages]);

  // ── Scroll Management ──
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      userScrolledUpRef.current = !isNearBottom;
      setShowScrollButton(!isNearBottom);
    }
  };

  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    if (!scrollRef.current || userScrolledUpRef.current) return;
    const shouldSmooth = messages.length > prevMessagesLengthRef.current || isLoading;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: shouldSmooth ? 'smooth' : 'auto',
    });
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isLoading]);

  useEffect(() => {
    if (textAreaRef.current) textAreaRef.current.focus();
  }, [textAreaRef]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  // ── Actions ──
  const copyToClipboard = useCallback((m: any) => {
    const text = Array.isArray(m.parts)
        ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
        : m.content || '';
    navigator.clipboard.writeText(text);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleRegenerate = useCallback(async (msgId: string) => {
    if (isLoading) return;
    const currentMsg = fullTree.find(m => m.id === msgId);
    if (!currentMsg) return;

    const userMsgId = currentMsg.parentId;
    if (!userMsgId) return;

    const userMsg = fullTree.find(m => m.id === userMsgId);
    if (!userMsg) return;

    try {
      await sendMessage({
        content: userMsg.content,
        role: 'user',
        experimental_attachments: userMsg.experimental_attachments
      } as any, {
        body: { parentId: userMsg.parentId } 
      });
    } catch (err) {
      console.error('Regenerate failed:', err);
    }
  }, [isLoading, fullTree, sendMessage]);

  const handleRetry = useCallback(async () => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'user') return;

    try {
      await sendMessage({
        content: lastMsg.content,
        role: 'user',
        experimental_attachments: lastMsg.experimental_attachments,
      } as any, {
        body: { parentId: lastMsg.parentId }
      });
    } catch (err) {
      console.error('Retry failed:', err);
    }
  }, [messages, sendMessage]);

  const startEditing = useCallback((msgId: string, content: string) => {
    setEditingMessageId(msgId);
    setEditText(content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditText('');
  }, []);

  const submitEdit = useCallback(async (msgId: string) => {
    const trimmed = editText.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    const currentMsg = fullTree.find(m => m.id === msgId);
    if (!currentMsg) return;

    try {
      await sendMessage({
        content: trimmed,
        role: 'user',
        experimental_attachments: currentMsg.experimental_attachments,
      } as any, {
        body: { parentId: currentMsg.parentId },
      });
    } catch (err) {
      console.error('Edit submit failed:', err);
    }
    cancelEdit();
  }, [editText, fullTree, sendMessage, cancelEdit]);

  const handleApprovalResponse = useCallback(async (status: 'approved' | 'denied') => {
    if (!pendingApproval) return;
    try {
      await api.post(`/api/chat/approvals/${pendingApproval.id}/respond`, { status });
      setPendingApproval(null);
    } catch (err: any) {
      console.error('Approval response failed:', err.message);
    }
  }, [pendingApproval]);

  const onExtractArtifact = useCallback((artifact: any) => {
    setActiveCapsule({ artifact: { ...artifact, type: 'code' } });
  }, []);

  const activeModel = useMemo(() => models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Sparkles, color: 'text-slate-400' }, [models, selectedModelId]);
  const activeDisplayName = useMemo(() => beautifyModelName(activeModel.name), [activeModel]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }, [addFiles]);

  return (
      <div
          className="flex-1 flex overflow-hidden h-full"
          onDragOver={handleDragOver}
      >
        <div className="flex-1 flex flex-col relative overflow-hidden bg-white/40">
          <AnimatePresence>
            {isDragging && (
                <motion.div
                    {...(reducedMotion ? { initial: false, animate: { opacity: 1 } } : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } })}
                    onDragLeave={handleDragLeave} onDrop={handleDrop}
                    className="absolute inset-0 z-50 bg-[#EC5B14]/5 backdrop-blur-[2px] border-4 border-dashed border-[#EC5B14]/20 m-4 rounded-[40px] flex flex-col items-center justify-center text-[#EC5B14]"
                >
                  <Plus className="w-12 h-12 mb-4" />
                  <p className="text-xl font-bold font-display">{t('common.drag_drop')}</p>
                </motion.div>
            )}
          </AnimatePresence>

          <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 md:px-8 py-4 scroll-smooth relative"
          >
            {/* 右侧栏关闭按钮 */}
            {previewAttachment && (
                <button
                    onClick={() => setPreviewAttachment(null)}
                    className="absolute right-4 top-4 z-30 p-2 rounded-lg bg-white/80 backdrop-blur-sm border border-[#E8E4E2]/60 text-[#716B67] hover:text-[#EC5B14] hover:bg-white hover:border-[#EC5B14]/30 transition-all shadow-sm"
                    title="关闭预览"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
            )}

            <div className="max-w-[800px] mx-auto space-y-8">
              <AnimatePresence mode="popLayout" initial={false}>
                {isLoadingHistory ? (
                    <div className="flex flex-col mt-8 w-full gap-8 max-w-3xl mx-auto px-2">
                      <div className="flex justify-end w-full opacity-60">
                        <div className="bg-[#eeece9] w-2/3 h-14 rounded-[20px] animate-pulse rounded-tr-[4px]"></div>
                      </div>
                      <div className="flex justify-start w-full gap-4 mt-2 opacity-60">
                        <div className="w-8 h-8 rounded-xl bg-[#E8E4E2] animate-pulse shrink-0"></div>
                        <div className="flex-1 max-w-[80%] h-32 rounded-[20px] bg-[#fcfcfc] animate-pulse rounded-tl-[4px] border border-[#f0f0f0]"></div>
                      </div>
                    </div>
                ) : messages.length === 0 ? (
                  /* 还原 EmptyState 在此处的渲染，但逻辑改为判断 messages */
                  <EmptyState
                    t={t}
                    setLocalInput={setLocalInput}
                    onFormSubmit={onFormSubmit}
                  />
                ) : (
                    <div key="chat-messages" className="flex flex-col w-full">
                      {Array.from(new Map(messages.map((m: any) => [m.id || m.createdAt || Math.random(), m])).values())
                          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
                          .map((m: any, idx: number, arr: any[]) => (
                            <ChatMessage
                              key={m.id || idx}
                              message={m}
                              idx={idx}
                              isLast={idx === arr.length - 1}
                              isLoading={isLoading}
                              reducedMotion={reducedMotion}
                              t={t}
                              getLocalizedName={getLocalizedName}
                              copyToClipboard={copyToClipboard}
                              copiedId={copiedId}
                              messageFeedback={messageFeedback}
                              setMessageFeedback={setMessageFeedback}
                              handleRegenerate={handleRegenerate}
                              startEditing={startEditing}
                              editingMessageId={editingMessageId}
                              editText={editText}
                              setEditText={setEditText}
                              submitEdit={submitEdit}
                              cancelEdit={cancelEdit}
                              setPreviewAttachment={setPreviewAttachment}
                              previewAttachment={previewAttachment}
                              activeCapsule={activeCapsule}
                              setActiveCapsule={setActiveCapsule}
                              sendMessage={sendMessage}
                              branchIndex={branchMetadata.branchIndex}
                              totalBranches={branchMetadata.totalBranches}
                              onBranchChange={onBranchChange}
                              isStopped={isStopped}
                              onExtract={onExtractArtifact}
                            />
                          ))}

                      {/* Error Banner */}
                      {error && (
                          <motion.div
                              {...(reducedMotion ? { initial: false, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } })}
                              className="flex w-full gap-4 items-start mb-8"
                          >
                            <div className="w-8 h-8 rounded-[10px] bg-red-50 flex items-center justify-center shrink-0 mt-1">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="bg-red-50/80 border border-red-200 rounded-[20px] px-5 py-4">
                                <p className="text-sm font-semibold text-red-700 mb-1">
                                  {t('chat.error.title', 'Request failed')}
                                </p>
                                <p className="text-xs text-red-500/80 break-words">
                                  {error.message || t('chat.error.message', 'Something went wrong while generating the response. Please try again.')}
                                </p>
                                <button
                                    onClick={() => handleRetry()}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 active:scale-[0.98] transition-all"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  {t('chat.error.retry', 'Retry')}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                      )}

                      {/* 当正在提交但 messages 列表还没更新出 assistant 回复时的"先行占位" */}
                      {(isLoading || isLocalThinking) && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
                          <motion.div {...(reducedMotion ? { initial: false, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } })} className="flex w-full gap-4 items-start mb-8">
                            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#EC5B14] to-[#FF8C42] flex items-center justify-center shadow-[0_4px_15px_rgba(236,91,20,0.3)] text-white shrink-0 mt-1">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <ThinkingList steps={[{ label: t('chat.thinking'), status: 'active' }]} />
                            </div>
                          </motion.div>
                      )}
                    </div>
                )}

              </AnimatePresence>            </div>
          </div>

          <ChatInput
          localInput={localInput}
          setLocalInput={setLocalInput}
          attachments={attachments}
          addFiles={addFiles}
          removeFile={removeFile}
          isModelDropdownOpen={isModelDropdownOpen}
          setIsModelDropdownOpen={setIsModelDropdownOpen}
          isSearchMode={isSearchMode}
          setIsSearchMode={setIsSearchMode}
          isKnowledgeMode={isKnowledgeMode}
          setIsKnowledgeMode={setIsKnowledgeMode}
          onFormSubmit={onFormSubmit}
          handleStop={handleStop}
          isLoading={isLoading}
          models={models}
          selectedModelId={selectedModelId}
          setSelectedModelId={setSelectedModelId}
          textAreaRef={textAreaRef}
          t={t}
          lastUserMessage={messages.filter(m => m.role === 'user').pop()?.content}
          setPreviewAttachment={setPreviewAttachment}
          ghostText={ghostText}
          setGhostText={setGhostText}
          isPredicting={isPredicting}
          />
        </div>

        {/* Approval Modal */}
        <ApprovalModal
            request={pendingApproval ? { id: pendingApproval.id, toolName: pendingApproval.toolName, args: pendingApproval.args } : null}
            onRespond={handleApprovalResponse}
            onClose={() => setPendingApproval(null)}
        />

        {/* Sidebar Right (Capsule Panel + Preview + Meta) */}
        <aside className={cn(
            "absolute lg:relative right-0 top-0 bottom-0 z-40 border-l border-[#E8E4E2] bg-[#fcf9f8] lg:bg-[#fcf9f8]/80 backdrop-blur-md flex-col h-full overflow-hidden transition-all duration-300",
            (previewAttachment || activeCapsule) ? "translate-x-0 flex w-full lg:w-[450px]" : "translate-x-full lg:translate-x-0 hidden lg:flex lg:w-80"
        )}>
          {activeCapsule ? (
              /* ── Capsule Panel ── */
              <motion.div
                  {...(reducedMotion
                          ? { initial: false, animate: { x: 0, opacity: 1 } }
                          : { initial: { x: '100%', opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: '100%', opacity: 0 }, transition: { type: 'spring', damping: 25, stiffness: 200 } }
                  )}
                  className="flex-1 flex flex-col h-full bg-white"
              >
                <div className="px-4 py-3 border-b border-[#E8E4E2]/60 flex items-center justify-between bg-[#F6F3F2]/50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#1C1B1B]">
                      {activeCapsule.artifact ? '代码组件' : '交互胶囊'}
                    </span>
                    <span className="text-[10px] text-[#716B67] bg-[#E8E4E2] px-1.5 py-0.5 rounded-full">
                      {activeCapsule.artifact ? activeCapsule.artifact.language : activeCapsule.uiKit?.uiType}
                    </span>
                  </div>
                  <button
                      onClick={() => setActiveCapsule(null)}
                      className="p-1.5 hover:bg-[#eeece9] rounded-lg transition-colors"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-white">
                  {activeCapsule.artifact ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F6F3F2]">
                        <h3 className="text-[15px] font-bold text-[#1C1B1B]">{activeCapsule.artifact.title}</h3>
                        <CopyCodeButton code={activeCapsule.artifact.content} />
                      </div>
                      <div className="flex-1 bg-[#0d0d0d] overflow-auto">
                        <CodeBlock 
                          language={activeCapsule.artifact.language} 
                          value={activeCapsule.artifact.content} 
                          minimal={true}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <UIRenderer
                          uiKit={activeCapsule.uiKit}
                          onAction={(actionId, payload) => {
                            if (actionId === 'approve_request') {
                              sendMessage({ content: `APPROVE:${(payload as any).requestId}`, role: 'user' });
                            } else if (actionId === 'reject_request') {
                              sendMessage({ content: `REJECT:${(payload as any).requestId}`, role: 'user' });
                            } else if (actionId === 'create_zentao_task') {
                              const d = payload as any;
                              sendMessage({ content: `Create ZenTao task for ${d.bugId}: assignee=${d.assignee}`, role: 'user' });
                            } else if (actionId === 'open_bug_detail') {
                              console.log('[Capsule] Open bug detail:', (payload as any).id);
                            } else if (actionId === 'view_logs') {
                              console.log('[Capsule] View pipeline logs:', (payload as any).pipelineId);
                            } else if (actionId === 'retry_pipeline') {
                              sendMessage({ content: `Retry pipeline ${(payload as any).pipelineId}`, role: 'user' });
                            }
                          }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
          ) : previewAttachment ? (
              /* ── File Preview Overrides Aside (Claude/Deepseek style) ── */
              <motion.div
                  {...(reducedMotion
                          ? { initial: false, animate: { x: 0, opacity: 1 } }
                          : { initial: { x: '100%', opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: '100%', opacity: 0 }, transition: { type: 'spring', damping: 25, stiffness: 200 } }
                  )}
                  className="flex-1 flex flex-col h-full bg-white"
              >
                <div className="p-4 border-b border-[#E8E4E2]/60 flex items-center justify-between bg-[#F6F3F2]/50">
                  <div className="flex items-center gap-3">
                    {previewAttachment.contentType.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-[#EC5B14]" /> : <FileText className="w-4 h-4 text-[#EC5B14]" />}
                    <span className="font-bold text-[12px] text-[#1C1B1B] truncate max-w-[150px]">{previewAttachment.name}</span>
                  </div>
                  <button onClick={() => setPreviewAttachment(null)} className="p-1.5 hover:bg-[#eeece9] rounded-lg transition-colors"><CloseIcon className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {previewAttachment.contentType.startsWith('image/') ? (
                      <div className="p-4 flex items-center justify-center"><img src={previewAttachment.url} alt={previewAttachment.name} className="max-w-full rounded-xl border border-[#E8E4E2]/60" /></div>
                  ) : (
                      <div className="p-4">
                        <div className="prose prose-slate prose-xs max-w-none text-[13px]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents() as any}>
                            {(() => {
                              try {
                                if (previewAttachment.url.startsWith('data:')) {
                                  const b64 = previewAttachment.url.split(',')[1];
                                  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                                  return new TextDecoder('utf-8').decode(bytes);
                                }
                                return previewAttachment.url;
                              } catch { return '无法解码文件内容'; }
                            })()}
                          </ReactMarkdown>
                        </div>
                      </div>
                  )}
                </div>
              </motion.div>
          ) : (
              <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
                <ActiveContextPanel 
                  onAction={(action) => {
                    onFormSubmit({ content: action, role: 'user' });
                  }}
                />
                <div className="border-t border-[#E8E4E2]/60 bg-[#F6F3F2]/30">
                  <IntegrationsPanel
                    t={t}
                    activeDisplayName={activeDisplayName}
                    totalUsage={totalUsage}
                  />
                </div>
              </div>
          )}
        </aside>
      </div>
  );
}
