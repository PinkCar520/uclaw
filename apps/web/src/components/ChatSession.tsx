import React, { useEffect, useRef, useState } from 'react';

// 提升到模块级：避免在 ChatSession 每次渲染时重新定义，导致 React 视其为全新组件而重挂载
// 重挂载会清除 setInterval，造成 BrailleSpinner 在流式传输期间频繁闪烁
const BrailleSpinner = () => {
  const [pattern, setPattern] = useState('⠋');
  useEffect(() => {
    const patterns = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const interval = setInterval(() => {
      setPattern(patterns[i]);
      i = (i + 1) % patterns.length;
    }, 80);
    return () => clearInterval(interval);
  }, []);
  return <span className="font-mono text-[#716B67] mr-1">{pattern}</span>;
};
import { useChat } from '@ai-sdk/react';
import {
  ArrowDown, Sparkles, Copy, RotateCcw, Check,
  Plus, FileText, X as CloseIcon, Image as ImageIcon,
  ChevronDown, Paperclip, ArrowRight, ArrowUp, Terminal, Cpu, Database, BadgeCheck, Globe, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { useSkillCatalog } from '../lib/useSkillCatalog';
import { UIRenderer } from './UIRenderer';
import { BugCard } from './BugCard';
import { PipelineCard } from './PipelineCard';
import { TaskPlan } from './TaskPlan';
import { ApprovalCard } from './ApprovalCard';
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
  const initializedRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  const titleGeneratedRef = useRef(false);

  // Custom Hook: globally fetches & caches dynamic skill names
  const { getLocalizedName } = useSkillCatalog();
  const navigate = useNavigate();
  const location = useLocation();

  // 同步 ref，确保异步回调中总能拿到最新值
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // 重置标题生成标志（切换到不同会话时）
  useEffect(() => {
    titleGeneratedRef.current = false;
    initializedRef.current = false;
  }, [sessionId]);

  // 处理带有 autoSubmit 状态的跳转，将发送行为顺延到导航完成后进行
  useEffect(() => {
    if (sessionId && location.state?.autoSubmit) {
      // 抹除路由 state 防止刷新重复发送
      navigate(location.pathname, { replace: true, state: {} });
      // 延迟到下一帧确保 Vercel SDK 完成新 ID 的挂载和重置
      setTimeout(() => {
        onFormSubmit();
      }, 0);
    }
  }, [sessionId, location.state, navigate]);

  const [localInput, setLocalInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; contentType: string; url: string } | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isKnowledgeMode, setIsKnowledgeMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocalThinking, setIsLocalThinking] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<any>(null);

  // Poll for approval requests
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/approvals/${sessionId}`);
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          setPendingApproval(data.data[0]); // Show first pending request
        }
      } catch (err) {
        // Ignore errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleApprovalResponse = async (status: 'approved' | 'denied') => {
    if (!pendingApproval) return;
    try {
      await fetch(`/api/chat/approvals/${pendingApproval.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setPendingApproval(null);
    } catch (err) {
      console.error('Approval response failed:', err);
    }
  };

  useEffect(() => {
    if (sessionId !== sessionIdRef.current) {
      sessionIdRef.current = sessionId;
    }
  }, [sessionId]);

  const { messages, sendMessage, status, reload, setMessages, stop } = (useChat as any)({
    id: sessionId ?? 'new',  // 回归正常 React 状态设计
    initialMessages: initialMessages, // 确保卸载重载时直接初始化为历史消息！
    api: '/api/chat',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: {
      modelId: selectedModelId,
      search: isSearchMode,
      knowledge: isKnowledgeMode,
      sessionId: sessionId,  // 核心：告知 Gateway 将消息写入哪个会话
    },
    onFinish: async (_message: any) => {
      // Server-First: 服务端已在 onFinish 中持久化消息
      // 前端只需刷新侧边栏列表以显示最新标题/消息数
      const sid = sessionIdRef.current;
      if (sid) {
        await onStreamFinished(sid);
      }
    }
  });

  useEffect(() => {
    if ((!initializedRef.current || messages.length === 0) && initialMessages.length > 0) {
      initializedRef.current = true;
      setMessages(initialMessages);
      // 如果加载的是历史记录，标记为已生成标题，防止重复总结
      titleGeneratedRef.current = true;
    }
  }, [initialMessages, messages.length, setMessages]);

  const isLoading = status === 'streaming' || status === 'submitting';

  // Reset local thinking when assistant message arrives
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setIsLocalThinking(false);
    }
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Sparkles, color: 'text-slate-400' };

  // Scroll to bottom effect
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // TextArea Resize
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
    }
  }, [localInput]);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const copyToClipboard = (m: any) => {
    const text = Array.isArray(m.parts)
      ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
      : m.content || '';
    navigator.clipboard.writeText(text);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const uploadFile = async (file: File): Promise<{ name: string; contentType: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) throw new Error(`Failed to upload file: ${res.statusText}`);
    const data = await res.json();
    return { name: file.name, contentType: file.type || 'application/octet-stream', url: data.url };
  };

  const handleRegenerate = async (msgId: string) => {
    if (isLoading) return;

    // 找到当前点击的消息索引
    const idx = messages.findIndex((m: any) => m.id === msgId);
    if (idx === -1) return;

    // 向上寻找最近的一条用户消息
    let userMsgIdx = -1;
    for (let i = idx; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsgIdx = i;
        break;
      }
    }

    if (userMsgIdx === -1) return;

    const userMsg = messages[userMsgIdx];

    // 回滚消息列表：保留到该条用户消息之前
    const newMessages = messages.slice(0, userMsgIdx);
    setMessages(newMessages);

    // 重新发送该消息
    try {
      await sendMessage({
        content: userMsg.content,
        role: 'user',
        experimental_attachments: userMsg.experimental_attachments
      } as any);
    } catch (err) {
      console.error('Regenerate failed:', err);
    }
  };

  const onFormSubmit = async (e?: any) => {
    if (e) e.preventDefault();
    if ((!localInput.trim() && selectedFiles.length === 0) || isLoading) return;

    // 若还没有 sessionId，先在服务端创建一个（Server-First：先有会话，再有消息）
    let activeSessionId = sessionIdRef.current;
    if (!activeSessionId) {
      setIsLocalThinking(true);
      const newId = await createSession();
      if (!newId) {
        setIsLocalThinking(false);
        console.error('[ChatSession] Failed to create session');
        return;
      }
      activeSessionId = newId;
      sessionIdRef.current = newId;

      // 正常的 React Router 导航
      navigate(`/chat/${newId}`, { state: { autoSubmit: true } });
      return; // 终止当前提交，等待路由跳转完成并在新的生命周期发起消息流
    }

    setIsLocalThinking(true);
    const val = localInput;
    setLocalInput('');
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);

    try {
      const attachments = filesToUpload.length > 0 ? await Promise.all(filesToUpload.map(uploadFile)) : undefined;
      const userMessage = { content: val, role: 'user', experimental_attachments: attachments };
      await sendMessage(userMessage as any, {
        body: {
          modelId: selectedModelId,
          search: isSearchMode,
          knowledge: isKnowledgeMode,
          sessionId: activeSessionId,
        }
      });
    } catch (err) {
      console.error(err);
      setIsLocalThinking(false);
      setLocalInput(val);
      setSelectedFiles(filesToUpload);
    }
  };
  // BrailleSpinner 已提升到模块顶层，避免组件重新挂载导致 spinner 闪烁

  const getFriendlyToolName = (part: any) => {
    // 安全提取底层对象，应对 AI SDK 各版本嵌套结构
    const inner = part.toolInvocation || part.invocation || part;
    const rawToolName = inner.toolName || part.toolName || part.type?.replace('tool-', '') || 'unknown';

    let args = inner.args || part.args;
    // 如果是字符串序列化，做一层解析
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch (e) { }
    }

    // 优先显示具体技能名称，其次显示翻译名称
    if (rawToolName === 'activate_skill') {
      let skillName = args?.skill_name || args?.skillName || args?.name || args?.skill;

      // 添加硬回退，解决在 streaming 最初期拿不到 args 的问题
      if (!skillName && inner.state !== 'result' && !part.result) {
        skillName = 'write-prd';
      }

      if (skillName) {
        return getLocalizedName(skillName, skillName);
      }
    }

    // 使用统一的 i18n 工具名称映射（消除硬编码）
    const translated = t(`tools.${rawToolName}`);
    if (translated && translated !== `tools.${rawToolName}`) {
      // 对于 runLocalCommand，追加具体子命令
      if (rawToolName === 'runLocalCommand' && args?.command) {
        const cmdNames: Record<string, string> = {
          'ls': t('chat.tool_status.names.ls'),
          'git_status': t('chat.tool_status.names.git_status'),
          'git_add': t('chat.tool_status.names.git_add'),
          'git_commit': t('chat.tool_status.names.git_commit'),
          'npm_build': t('chat.tool_status.names.npm_build'),
          'read_file': t('chat.tool_status.names.read_file'),
        };
        const cmdName = cmdNames[args.command] || args.command;
        return `${translated} → ${cmdName}`;
      }
      return translated;
    }

    // Fallback: title-case the raw name
    return rawToolName.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // 自定义比较函数：只在工具数量、完成状态或结果内容变化时才允许重渲
  // 流式传输期间父组件频繁刷新，但 tools 数组的「重要状态」未变，不应重渲 ToolGroupTimeline
  const toolGroupAreEqual = (prev: { tools: any[] }, next: { tools: any[] }) => {
    if (prev.tools.length !== next.tools.length) return false;
    for (let i = 0; i < prev.tools.length; i++) {
      const p = prev.tools[i];
      const n = next.tools[i];
      const prevDone = !!(p.output || p.result);
      const nextDone = !!(n.output || n.result);
      if (prevDone !== nextDone) return false;
      if (nextDone && JSON.stringify(p.result ?? p.output) !== JSON.stringify(n.result ?? n.output)) return false;
    }
    return true;
  };

  const ToolGroupTimeline = React.memo(({ tools }: { tools: any[] }) => {
    const isRunning = tools.some((t: any) => !(t.output || t.result));
    const [isManuallyClosed, setIsManuallyClosed] = useState(false);
    const isOpen = isRunning || !isManuallyClosed;

    return (
      <div className="my-3 overflow-hidden">
        <button
          onClick={() => !isRunning && setIsManuallyClosed(!isManuallyClosed)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 transition-colors group",
            isRunning ? "cursor-default" : "hover:bg-[#F6F3F2]/80 cursor-pointer"
          )}
        >
          <div className="flex items-center gap-3 text-[#716B67] text-[13px] font-bold">
            {isRunning ? <BrailleSpinner /> : <Check className="w-4 h-4 text-green-500 shrink-0" />}
            <span className="truncate max-w-[200px] sm:max-w-xs text-[#1C1B1B]">{t('chat.thinking', 'Thinking...')}</span>
            <span className="text-[11px] font-medium text-[#716B67]/70 bg-[#F6F3F2] px-2 py-0.5 rounded-full hidden sm:inline-block">
              {tools.length} {t('chat.tools.calls_count', 'steps')}
            </span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-[#716B67] transition-transform group-hover:text-[#1C1B1B]", isOpen ? "rotate-180" : "")} />
        </button>

        {/* 修复：移除 AnimatePresence 以减少流式更新时的 DOM 抖动 */}
        {isOpen && (
          <div className="overflow-hidden transition-all duration-300">
            <div className="px-4 pb-4 pt-4 bg-white flex flex-col gap-0 border-t border-[#E8E4E2]/40 relative">
              {/* 垂直时间轴轨道 */}
              <div className="absolute left-[29px] top-6 bottom-8 w-px bg-[#E8E4E2]/80 z-0"></div>

              {tools.map((part: any) => {
                const isCompleted = !!(part.output || part.result);
                // 修复：确保 key 稳定，优先使用 toolCallId
                const stableKey = part.toolCallId || part.toolName || Math.random().toString(36).slice(2);
                return (
                  <div key={stableKey} className="relative flex gap-4 pb-2 last:pb-0 z-10 w-full group/timeline">
                    <div className="relative z-10 w-[30px] flex justify-center pt-3.5 shrink-0">
                      <div className={cn("w-[10px] h-[10px] rounded-full ring-4 ring-white z-10 transition-colors", isCompleted ? "bg-[#E8E4E2]" : "bg-[#EC5B14] shadow-[0_0_8px_rgba(236,91,20,0.4)]")}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {renderToolInvocation(part)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }, toolGroupAreEqual);

  const renderToolInvocation = (part: any) => {
    const rawToolName = part.toolName || part.type?.replace('tool-', '') || 'unknown';
    const args = part.args || part.invocation?.args;

    const toolDisplayName = getFriendlyToolName(part);
    const isCompleted = !!(part.output || part.result);
    const isSkillActivation = rawToolName === 'activate_skill';
    const result = part.result || part.output;

    const handleToolClick = () => {
      if (isSkillActivation && isCompleted && result?.skill_content) {
        try {
          // 将技能内容转换为 Base64 预览（利用现有的 previewAttachment）
          const content = result.skill_content;
          const fileName = `${args?.skill_name || 'Skill'}.md`;
          const b64 = btoa(unescape(encodeURIComponent(content)));
          setPreviewAttachment({
            name: fileName,
            contentType: 'text/markdown',
            url: `data:text/markdown;base64,${b64}`
          });
        } catch (err) {
          console.error('Failed to preview skill:', err);
        }
      }
    };

    return (
      <div key={part.toolCallId} className="flex flex-col gap-2 my-2">
        <div
          onClick={handleToolClick}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all w-fit group/invocation",
            isCompleted
              ? "bg-[#F6F3F2]/40 border-[#E8E4E2]/40 text-[#716B67] opacity-80"
              : "bg-[#EC5B14]/5 border-[#EC5B14]/15 text-[#EC5B14] shadow-sm shadow-[#EC5B14]/5",
            isSkillActivation && isCompleted && "cursor-pointer hover:bg-[#F6F3F2]/60 hover:border-[#EC5B14]/30 hover:opacity-100"
          )}
        >
          {isCompleted ? (
            <Check className="w-4 h-4 text-green-500 shrink-0" />
          ) : (
            <div className="flex items-center justify-center w-4 h-4 shrink-0">
              <Cpu className="w-3 h-3 animate-pulse" />
            </div>
          )}

          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="text-[11px] font-bold tracking-tight truncate">
              {isCompleted
                ? t('chat.tool_status.completed', { name: toolDisplayName })
                : t('chat.tool_status.executing', { name: toolDisplayName })}
            </span>
          </div>

          {!isCompleted && (
            <div className="ml-1.5 flex gap-0.5">
              <span className="w-0.5 h-0.5 rounded-full bg-[#EC5B14] animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-0.5 h-0.5 rounded-full bg-[#EC5B14] animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-0.5 h-0.5 rounded-full bg-[#EC5B14] animate-bounce"></span>
            </div>
          )}

          {isSkillActivation && isCompleted && (
            <ArrowRight className="w-2.5 h-2.5 ml-1 opacity-0 group-hover/invocation:opacity-100 transition-opacity translate-x-[-4px] group-hover/invocation:translate-x-0" />
          )}
        </div>

        {/* If we have the result, render the specific UI for it */}
        {isCompleted && renderToolResult(part)}
      </div>
    );
  };

  const renderToolResult = (part: any) => {
    const result = part.output || part.result;
    const toolName = part.toolName || part.type?.replace('tool-', '') || '';

    // ── Gen 2: 优先检测 UI Protocol (ui 字段) ──
    if (result?.ui) {
      return (
        <UIRenderer
          key={part.toolCallId}
          uiKit={result.ui}
          onAction={(actionId, payload) => {
            if (actionId === 'approve_request') {
              sendMessage({ content: `APPROVE:${(payload as any).requestId}`, role: 'user' });
            } else if (actionId === 'reject_request') {
              sendMessage({ content: `REJECT:${(payload as any).requestId}`, role: 'user' });
            } else if (actionId === 'open_bug_detail') {
              // 可以在这里发送消息请求详情，或导航到其他页面
              console.log('[ChatSession] Open bug detail:', (payload as any).id);
            } else if (actionId === 'view_logs') {
              console.log('[ChatSession] View pipeline logs:', (payload as any).pipelineId);
            } else if (actionId === 'retry_pipeline') {
              sendMessage({ content: `Retry pipeline ${(payload as any).pipelineId}`, role: 'user' });
            }
          }}
        />
      );
    }

    // ── Gen 1: 向后兼容 — 无 ui 字段时回退到旧逻辑 ──
    if (toolName === 'getBugInfo' || toolName === 'tool-getBugInfo') {
      if (result) return <BugCard key={part.toolCallId} {...result} />;
    }
    if (toolName === 'searchBugs' || toolName === 'tool-searchBugs') {
      const bugs = Array.isArray(result) ? result : [];
      return (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mt-2" key={part.toolCallId}>
          {bugs.map((b: any) => <BugCard key={b.id} {...b} />)}
        </div>
      );
    }
    if (toolName === 'getPipelineStatus' || toolName === 'tool-getPipelineStatus') {
      if (result) return <PipelineCard key={part.toolCallId} {...result} />;
    }
    if (toolName === 'proposePlan' || toolName === 'tool-proposePlan') {
      if (result) return (
        <TaskPlan
          key={part.toolCallId}
          {...result}
          onConfirm={() => sendMessage({ content: 'Y', role: 'user' })}
          onCancel={() => sendMessage({ content: 'N', role: 'user' })}
        />
      );
    }
    if (toolName === 'runLocalCommand' || toolName === 'tool-runLocalCommand') {
      if (result?.status === 'Success') {
        return (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs mt-2 overflow-hidden" key={part.toolCallId}>
            <div className="flex items-center gap-2 mb-2 text-blue-600 font-semibold">
              <Terminal className="w-3 h-3 text-blue-600" />
              <span>{t('tools.runLocalCommand', 'Local Command')}: {result.command}</span>
            </div>
            <pre className="text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {JSON.stringify(result.result, null, 2)}
            </pre>
          </div>
        );
      }
    }

    // 检测审批状态（来自 wrapWithApproval）
    if (result?.status === 'pending_approval') {
      return (
        <ApprovalCard
          key={part.toolCallId}
          requestId={result.requestId}
          toolName={toolName}
          description={result.message || '此操作需要您的审批'}
          args={result.args}
          status="pending"
          onApprove={() => sendMessage({ content: `APPROVE:${result.requestId}`, role: 'user' })}
          onReject={() => sendMessage({ content: `REJECT:${result.requestId}`, role: 'user' })}
        />
      );
    }

    return null;
  };

  const beautifyModelName = (name: string) => {
    return name
      .split(/[-:_]/)
      .filter(word => !['it', '8bit', 'v3', 'v2', 'latest'].includes(word.toLowerCase()))
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const activeDisplayName = beautifyModelName(activeModel.name);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  return (
    <div
      className="flex-1 flex overflow-hidden h-full"
      onDragOver={handleDragOver}
    >
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white/40">
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                <div className="flex flex-col mt-4 md:mt-10 w-full min-w-0">
                  <div className="flex w-full min-w-0 flex-col items-start gap-4 overflow-hidden rounded-[24px] border border-transparent bg-[#f6f3f2] p-5 md:flex-row md:gap-6 md:p-8 mb-8">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] bg-white flex items-center justify-center shrink-0 shadow-sm text-[#EC5B14]">
                      <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="w-full min-w-0">
                      <h3 className="mb-2 break-words text-lg font-bold font-display text-[#1C1B1B] cursor-default md:text-xl">{t('chat.empty_state.title')}</h3>
                      <p className="max-w-xl break-words text-sm leading-relaxed text-[#716B67] md:text-base">
                        {t('chat.empty_state.desc')}
                      </p>
                      <div className="mt-6 grid w-full min-w-0 grid-cols-1 gap-3 md:gap-4 min-[420px]:grid-cols-2">
                        <div className="min-w-0 rounded-[12px] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.02)] md:px-5 md:py-4">
                          <p className="text-[10px] md:text-[11px] text-[#716B67] font-semibold mb-1">{t('chat.empty_state.improvement_label')}</p>
                          <p className="break-words text-xl font-bold font-display text-[#EC5B14] md:text-2xl">{t('chat.empty_state.improvement_value')}</p>
                        </div>
                        <div className="min-w-0 rounded-[12px] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.02)] md:px-5 md:py-4">
                          <p className="text-[10px] md:text-[11px] text-[#716B67] font-semibold mb-1">{t('chat.empty_state.success_label')}</p>
                          <p className="break-words text-xl font-bold font-display text-[#0066CC] md:text-2xl">{t('chat.empty_state.success_value')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {Array.from(new Map(messages.map((m: any) => [m.id || m.createdAt || Math.random(), m])).values())
                    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
                    .map((m: any, idx: number, arr: any[]) => {
                      const isLast = idx === arr.length - 1;
                      const isAssistant = m.role === 'assistant';
                      const isUser = m.role === 'user';
                      const isStreaming = isLast && isLoading && isAssistant;
                      const hasContent = m.content || (Array.isArray(m.parts) && m.parts.some((p: any) => p.text));

                      return (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={m.id || idx} className={cn("flex flex-col group", isUser ? "items-end" : "items-start w-full")}>
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
                                <div className="flex items-center py-2 animate-pulse">
                                  <BrailleSpinner />
                                  <span className="text-[12px] font-bold text-[#716B67] tracking-tight">
                                    {t('chat.thinking')}
                                  </span>
                                </div>
                              ) : Array.isArray(m.parts) ? (
                                <div className="flex flex-col gap-3">
                                  {(() => {
                                    const groupedParts = m.parts.reduce((acc: any[], part: any) => {
                                      const isTool = part.type === 'tool-invocation' || part.toolName || part.type?.startsWith('tool-');
                                      if (isTool) {
                                        if (acc.length > 0 && acc[acc.length - 1].type === 'tools') {
                                          acc[acc.length - 1].tools.push(part);
                                        } else {
                                          acc.push({ type: 'tools', tools: [part] });
                                        }
                                      } else {
                                        acc.push({ type: 'text', part });
                                      }
                                      return acc;
                                    }, []);

                                    return groupedParts.map((group: any, i: number) => (
                                      group.type === 'text' ? (
                                        <div key={i} className="prose prose-slate prose-sm max-w-none">
                                          {group.part.type === 'text' && (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                              {group.part.text}
                                            </ReactMarkdown>
                                          )}
                                        </div>
                                      ) : (
                                        <ToolGroupTimeline key={i} tools={group.tools} />
                                      )
                                    ));
                                  })()}
                                  {isStreaming && (
                                    <div className="flex items-center mt-2 opacity-60">
                                      <BrailleSpinner />
                                      <span className="text-[11px] text-[#716B67] font-bold tracking-tight">{t('chat.thinking')}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="prose prose-slate prose-sm max-w-none relative">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                                  {isStreaming && (
                                    <div className="flex items-center mt-2 opacity-60">
                                      <BrailleSpinner />
                                      <span className="text-[11px] text-[#716B67] font-bold tracking-tight">{t('chat.thinking')}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className={cn(
                            "flex items-center gap-3 mt-2 transition-opacity duration-300",
                            isUser ? "px-5 flex-row-reverse" : "px-12 flex-row",
                            (isAssistant && status === 'streaming' && m.id === arr[arr.length - 1]?.id) ? "opacity-0 pointer-events-none" : "opacity-100"
                          )}>
                            <div className="flex items-center gap-1 transition-opacity">
                              <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                  <button onClick={() => copyToClipboard(m)} className="p-1.5 hover:bg-[#F6F3F2] rounded-md text-[#716B67]">
                                    {copiedId === m.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">
                                  {copiedId === m.id ? t('common.copied') : t('common.copy')}
                                </TooltipContent>
                              </Tooltip>
                              {isAssistant && (
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => handleRegenerate(m.id)} className="p-1.5 hover:bg-[#F6F3F2] rounded-md text-[#716B67]">
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">
                                    {t('common.regenerate')}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                  {/* 当正在提交但 messages 列表还没更新出 assistant 回复时的“先行占位” */}
                  {(isLoading || isLocalThinking) && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full gap-4 items-start mb-8">
                      <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#EC5B14] to-[#FF8C42] flex items-center justify-center shadow-[0_4px_15px_rgba(236,91,20,0.3)] text-white shrink-0 mt-1">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col gap-2 py-3">
                        <div className="flex items-center animate-pulse">
                          <BrailleSpinner />
                          <span className="text-[12px] font-bold text-[#716B67] tracking-tight">
                            {t('chat.thinking')}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}

            </AnimatePresence>
          </div>
        </div>

        <div className="pt-2 pb-4 md:pb-8 px-4 md:px-8 bg-gradient-to-t from-[#FCF9F8] via-[#FCF9F8] to-transparent z-10 w-full mt-auto">
          <div className="max-w-[800px] mx-auto relative">
            <AnimatePresence>{showScrollButton && <motion.button initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }} onClick={scrollToBottom} className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 w-8 h-8 bg-white rounded-full shadow-lg border border-[#E8E4E2] flex items-center justify-center text-[#716B67] hover:text-[#EC5B14] hover:border-[#EC5B14]/30 transition-all active:scale-95"><ArrowDown className="w-4 h-4" /></motion.button>}</AnimatePresence>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-2 flex flex-col shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-[#1C1B1B]/5 transition-all focus-within:ring-[#EC5B14]/30 focus-within:shadow-[0_10px_40px_-10px_rgba(236,91,20,0.15)]">
              <AnimatePresence>
                {selectedFiles.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 px-4 py-2 border-b border-[#E8E4E2]/40 overflow-hidden">
                    {selectedFiles.map((file, idx) => (
                      <motion.div key={`${file.name}-${idx}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-2 bg-[#F6F3F2] px-3 py-1.5 rounded-xl border border-[#E8E4E2]/60 group transition-all hover:border-[#EC5B14]/30">
                        <FileText className="w-3.5 h-3.5 text-[#716B67]" /><span className="text-xs font-semibold text-[#1C1B1B] max-w-[120px] truncate">{file.name}</span>
                        <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white text-[#716B67] hover:text-red-500 transition-colors"><CloseIcon className="w-3 h-3" /></button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <textarea ref={textAreaRef} rows={1} value={localInput} onChange={(e) => setLocalInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isLoading) onFormSubmit(); } }} placeholder={t('chat.placeholder')} className="w-full bg-transparent border-none text-[#1C1B1B] focus:ring-0 text-sm py-4 px-4 resize-none min-h-[56px] max-h-[200px] placeholder:text-[#716B67]/70 focus:outline-none" />
              <div className="flex items-center justify-between px-2 sm:px-4 pb-2">
                <div className="flex items-center gap-0.5 sm:gap-1.5 overflow-hidden">
                  <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-[#716B67] hover:bg-[#eeece9] transition-all border border-transparent hover:border-[#E8E4E2]/40 shrink-0">
                        <activeModel.icon className={cn("w-4 h-4 shrink-0", activeModel.color)} />
                        <span className="text-[10px] sm:text-[11px] font-bold tracking-tight max-w-[60px] sm:max-w-none truncate">{activeDisplayName}</span>
                        <ChevronDown className={cn("w-3 h-3 transition-transform shrink-0", isModelDropdownOpen ? "rotate-180" : "")} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-60 border-[#E8E4E2] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-2xl p-1.5 backdrop-blur-xl bg-white/90">
                      <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase text-[#716B67] tracking-widest">{t('chat.available_models')}</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-[#E8E4E2]/40" />
                      <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                        {models.map((m) => {
                          const displayName = beautifyModelName(m.name);
                          return (
                            <DropdownMenuItem key={m.id} onClick={() => setSelectedModelId(m.id)} className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all mb-0.5 hover:bg-[#eeece9]">
                              <div className="flex items-center gap-3"><div className={cn("flex items-center justify-center w-8 h-8", m.color)}><m.icon className="w-5 h-5" /></div><div className="flex flex-col"><span className="text-[14px] font-bold text-[#1C1B1B]">{displayName}</span><span className="text-[11px] text-[#716B67] font-medium">{m.provider}</span></div></div>
                              {selectedModelId === m.id && <Check className="w-4 h-4 text-[#EC5B14] shrink-0" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="w-px h-4 bg-[#E8E4E2]/60 mx-1 shrink-0" />
                  <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.onchange = (e: any) => { if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]); }; input.click(); }} className="p-1.5 sm:p-2 rounded-lg text-[#716B67] hover:bg-[#eeece9] hover:text-[#1C1B1B] transition-all shrink-0"><Paperclip className="w-4 h-4 sm:w-5 sm:h-5" /></button>

                  <button
                    onClick={() => setIsSearchMode(!isSearchMode)}
                    className={cn(
                      "p-1.5 sm:p-2 rounded-lg transition-all transform active:scale-95 shrink-0",
                      isSearchMode
                        ? "text-[#EC5B14] bg-[#EC5B14]/5"
                        : "text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14]"
                    )}
                  >
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  <button
                    onClick={() => setIsKnowledgeMode(!isKnowledgeMode)}
                    className={cn(
                      "p-1.5 sm:p-2 rounded-lg transition-all transform active:scale-95 shrink-0",
                      isKnowledgeMode
                        ? "text-[#EC5B14] bg-[#EC5B14]/5"
                        : "text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#EC5B14]"
                    )}
                  >
                    <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
                <button onClick={() => isLoading ? stop() : onFormSubmit()} className={cn("w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center transition-all", isLoading ? "bg-[#1C1B1B] text-white" : ((!localInput.trim() && selectedFiles.length === 0) ? "bg-[#eeece9] text-[#716B67]/40 cursor-not-allowed" : "bg-[#EC5B14] text-white shadow-lg hover:scale-105 active:scale-95"))}>
                  {isLoading ? <Square className="w-4 h-4 fill-current" /> : <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      <ApprovalModal
        request={pendingApproval ? { id: pendingApproval.id, toolName: pendingApproval.toolName, args: pendingApproval.args } : null}
        onRespond={handleApprovalResponse}
        onClose={() => setPendingApproval(null)}
      />

      {/* Sidebar Right (Meta + Preview) */}
      <aside className={cn(
        "absolute lg:relative right-0 top-0 bottom-0 z-40 border-l border-[#E8E4E2] bg-[#fcf9f8] lg:bg-[#fcf9f8]/80 backdrop-blur-md flex-col h-full overflow-hidden transition-all duration-300",
        previewAttachment ? "translate-x-0 flex w-full lg:w-[450px]" : "translate-x-full lg:translate-x-0 hidden lg:flex lg:w-80"
      )}>
        {previewAttachment ? (
          /* ── File Preview Overrides Aside (Claude/Deepseek style) ── */
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
          /* ── Integrations Panel ── */
          <div className="p-6 flex flex-col gap-8 overflow-y-auto flex-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-sm text-[#1C1B1B]">{t('chat.integrations.active_title')}</h4>
                <button className="text-[11px] font-bold text-[#EC5B14] hover:underline">{t('chat.integrations.manage')}</button>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-[8px] bg-[#1C1B1B] flex items-center justify-center text-white font-bold text-xs">GL</div><div><p className="text-sm font-bold text-[#1C1B1B]">GitLab</p><p className="text-[11px] text-[#716B67]">2 {t('chat.integrations.pending_mrs')}</p></div></div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group cursor-pointer hover:ring-2 hover:ring-[#EC5B14]/20 transition-all">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-[8px] bg-[#0E1529] flex items-center justify-center text-red-500 font-bold text-xs"><Cpu className="w-4 h-4" /></div><div><p className="text-sm font-bold text-[#1C1B1B]">Jenkins</p><p className="text-[11px] text-[#716B67]">1 {t('chat.integrations.pipeline_running')}</p></div></div>
                  <div className="w-2 h-2 rounded-full bg-[#EC5B14]"></div>
                </div>
                <div className="p-4 bg-white/70 rounded-xl border border-[#E8E4E2]/60 flex items-center justify-between group flex-col items-start gap-2">
                  <div className="w-full flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-[8px] bg-blue-100 flex items-center justify-center text-blue-600"><Database className="w-4 h-4" /></div><div><p className="text-sm font-bold text-[#1C1B1B]">ZenTao</p><p className="text-[11px] text-[#716B67]">4 {t('chat.integrations.active_tasks')}</p></div></div><div className="w-2 h-2 rounded-full bg-green-500"></div></div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-extrabold text-[#716B67] uppercase tracking-widest mb-4">{t('chat.meta.title')}</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-xs text-[#716B67]">{t('chat.meta.model')}</span><span className="text-xs font-bold text-[#1C1B1B] flex items-center gap-1">{activeDisplayName} <BadgeCheck className="w-3 h-3 text-[#EC5B14]" /></span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#716B67]">{t('chat.meta.tokens')}</span><span className="text-xs font-mono font-bold text-[#1C1B1B]">1,402</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#716B67]">{t('chat.meta.review_mode')}</span><span className="bg-[#EC5B14]/10 text-[#EC5B14] px-2 py-0.5 rounded-full text-[10px] font-bold">{t('chat.meta.strict')}</span></div>
              </div>
            </div>
            <div className="mt-auto pointer-events-none opacity-40 grayscale">
              <div className="relative rounded-[16px] overflow-hidden aspect-square border border-[#E8E4E2]/50">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAr81NID_90Yy5CvYiCWyQuR_y9N_VafML_ttYyYtfSjf9jKr6XGdQbphqaCw1RNRV7cXKmhd7mCGXKD7zFngPrXo_X9rsn5SOJ_Zm33YJYNwgHgqAMynf0rzM6r8fHecJFgX3JfJUo09Gcb_tYo4uzHiM9j8dPiCGm-gia9TTdnFa3LGPxoKpBvdM0OACh_MqUpC0qNufnob3xIDqaVuMh5orjOJfsmCRQRTUQlwwnBkvCyMbhVztwLZqJMRJuxsJODFHj3ECVE40" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F6F3F2] to-transparent"></div>
                <div className="relative h-full p-5 flex flex-col justify-end"><p className="text-[10px] font-bold text-[#716B67] uppercase tracking-widest mb-1.5">{t('chat.weekly_insight.title')}</p><p className="text-sm font-bold text-[#1C1B1B] leading-snug">{t('chat.weekly_insight.content')}</p></div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
