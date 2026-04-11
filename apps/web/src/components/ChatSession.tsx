import React, { useEffect, useRef, useState, useCallback } from 'react';
import { type ThinkingStep } from './ThinkingPills';
import { ThinkingList } from './ThinkingList';
import { DiffViewer } from './DiffViewer';

// 打字光标：流式输出时闪烁的光标
const TypingCursor = () => (
  <span className="inline-block w-[2px] h-[1.1em] bg-[#EC5B14] ml-[1px] align-text-bottom animate-cursor-blink" />
);

// Parse reasoning text into ThinkingStep[] for ThinkingList rendering.
// Splits by newlines or sentences, marking the last step as 'active' during streaming.
function parseReasoningToSteps(reasoning: string, isStreaming: boolean, isLastStep = true): ThinkingStep[] {
  if (!reasoning || !reasoning.trim()) return [];

  const trimmed = reasoning.trim();

  // Split by newlines first, filter empty lines
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);

  // If we have multiple lines, use them directly
  if (lines.length > 1) {
    return lines.map((label, i) => {
      const isLast = isLastStep && i === lines.length - 1;
      return {
        label,
        status: isLast && isStreaming ? 'active' : 'done',
      };
    });
  }

  // Single line: try sentence-level splitting (by common sentence boundaries)
  // Split by period, exclamation, question mark followed by space or end of string
  const sentences = trimmed
    .split(/(?<=[.!。！？\n])\s*(?=[A-Z\u4e00-\u9fff])/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // If we got multiple sentences, use them
  if (sentences.length > 1) {
    return sentences.map((label, i) => {
      const isLast = isLastStep && i === sentences.length - 1;
      return {
        label: label.replace(/[.。!！?？]+$/, ''),
        status: isLast && isStreaming ? 'active' : 'done',
      };
    });
  }

  // Fallback: treat as a single step
  return [{
    label: trimmed,
    status: isLastStep && isStreaming ? 'active' : 'done',
  }];
}

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

// 代码块复制按鈕组件（模块级，避免重复初始化）
const CopyCodeButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 opacity-0 group-hover:opacity-100 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
      title="复制代码"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">已复制</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>复制</span>
        </>
      )}
    </button>
  );
};

// ReactMarkdown 自定义渲染器：代码块带语法高亮 + 复制按鈕 + 语言标注
const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const lang = /language-(\w+)/.exec(className || '')?.[1];
    const codeStr = String(children).replace(/\n$/, '');
    if (inline) {
      return (
        <code className="bg-[#F0EDE9] text-[#EC5B14] px-1.5 py-0.5 rounded text-[0.85em] font-mono" {...props}>
          {children}
        </code>
      );
    }
    return (
      <div className="relative group my-3 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[#1E1E1E]">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
            {lang || 'code'}
          </span>
        </div>
        <div className="relative">
          {lang ? (
            <SyntaxHighlighter
              language={lang}
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: '16px', fontSize: '13px', lineHeight: '1.6' }}
              showLineNumbers={codeStr.split('\n').length > 3}
              wrapLines={true}
            >
              {codeStr}
            </SyntaxHighlighter>
          ) : (
            <pre className="overflow-x-auto bg-[#282828] px-4 py-4 text-[13px] leading-relaxed m-0">
              <code className={`font-mono text-[#E8E8E8] ${className || ''}`} {...props}>
                {children}
              </code>
            </pre>
          )}
          <CopyCodeButton code={codeStr} />
        </div>
      </div>
    );
  },
};

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
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  // Capsule state: which tool result is expanded in the right panel
  const [activeCapsule, setActiveCapsule] = useState<{ toolCallId: string; uiKit: any; } | null>(null);
  // Message feedback state: messageId -> 'up' | 'down'
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'up' | 'down'>>({});
  // Stopped generation indicator
  const [isStopped, setIsStopped] = useState(false);
  // Message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  // Branch tracking: messageId -> branch index (1-based)
  const [branchIndex, setBranchIndex] = useState<Record<string, number>>({});

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
      // ✅ 正确：调用审批 API（不走聊天消息）
      // 后端的 streamText 正在阻塞等待审批结果
      // 一旦 API 更新审批状态，后端检测到后立即继续执行工具
      // SSE 流自动恢复，前端无需 reload
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

  const { messages, sendMessage, status, reload, setMessages, stop, error } = (useChat as any)({
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

  // Cumulative token usage tracking — computed from messages array
  // Each assistant message may have a `usage` field from the backend
  const totalUsage = React.useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    for (const msg of messages) {
      const u = (msg as any).usage;
      if (u) {
        inputTokens += u.inputTokens ?? u.promptTokens ?? u.prompt_tokens ?? 0;
        outputTokens += u.outputTokens ?? u.completionTokens ?? u.completion_tokens ?? 0;
      }
    }
    return { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens };
  }, [messages]);

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
  const userScrolledUpRef = useRef(false);

  const activeModel = models.find(m => m.id === selectedModelId) || models[0] || { name: 'Loading...', icon: Sparkles, color: 'text-slate-400' };

  // Track if user has scrolled up (away from bottom)
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      userScrolledUpRef.current = !isNearBottom;
      setShowScrollButton(!isNearBottom);
    }
  };

  // Auto-scroll only when user is at the bottom
  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    if (!scrollRef.current) return;
    if (userScrolledUpRef.current) return; // Don't scroll if user scrolled up

    // Only smooth scroll for new content during streaming
    const shouldSmooth = messages.length > prevMessagesLengthRef.current || isLoading;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: shouldSmooth ? 'smooth' : 'auto',
    });
    prevMessagesLengthRef.current = messages.length;
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
    userScrolledUpRef.current = false; // Reset scroll lock on new message
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

  const handleStop = () => {
    setIsStopped(true);
    stop();
  };

  // Retry after error: find last user message and re-send it cleanly
  // This avoids MissingToolResultsError from incomplete tool calls in history
  const handleRetry = async () => {
    // Find the last user message
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;

    const userMsg = messages[lastUserIdx];
    // Truncate messages to before the last user message
    setMessages(messages.slice(0, lastUserIdx));
    // Re-send cleanly
    try {
      await sendMessage({
        content: userMsg.content,
        role: 'user',
        experimental_attachments: userMsg.experimental_attachments,
      } as any, {
        body: {
          modelId: selectedModelId,
          search: isSearchMode,
          knowledge: isKnowledgeMode,
          sessionId: sessionIdRef.current,
        },
      });
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  // ── Message Editing ──────────────────────────────────────────
  const startEditing = (msgId: string, content: string) => {
    setEditingMessageId(msgId);
    setEditText(content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const submitEdit = async (msgId: string) => {
    const trimmed = editText.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }

    // Find the index of the message being edited
    const msgIdx = messages.findIndex((m: any) => m.id === msgId);
    if (msgIdx === -1) return;

    // Increment branch index for this message
    setBranchIndex(prev => ({ ...prev, [msgId]: (prev[msgId] || 0) + 1 }));

    // Truncate to this user message (inclusive) and update its content
    const newMessages = messages.slice(0, msgIdx + 1).map((m: any, i: number) => {
      if (i === msgIdx) return { ...m, content: trimmed };
      return m;
    });
    setMessages(newMessages);

    // Re-send from this point
    try {
      await sendMessage({
        content: trimmed,
        role: 'user',
        experimental_attachments: newMessages[msgIdx]?.experimental_attachments,
      } as any, {
        body: {
          modelId: selectedModelId,
          search: isSearchMode,
          knowledge: isKnowledgeMode,
          sessionId: sessionIdRef.current,
        },
      });
    } catch (err) {
      console.error('Edit submit failed:', err);
    }
    cancelEdit();
  };

  // Reset stopped state only when new streaming starts (not when it just finished)
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    if (prevIsLoadingRef.current === false && isLoading) {
      // New streaming session started
      setIsStopped(false);
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

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
      </div>
    );
  };

  const renderToolResult = (part: any) => {
    const result = part.output || part.result;
    const toolName = part.toolName || part.type?.replace('tool-', '') || '';

    // ── Gen 2: UI Protocol (ui 字段) → 不再内联渲染，交给 CapsuleAnchor ──
    if (result?.ui) {
      return null; // Will be rendered as CapsuleAnchor inline in the unified message loop
    }

    // ── Gen 1: 向后兼容 — 无 ui 字段时回退到旧逻辑 ──

    // ── Stitch BugCard: 可交互式 Bug 信息卡片 (Mode B: 直调 API) ──
    if (toolName === 'getBugInfo' || toolName === 'tool-getBugInfo') {
      if (result) {
        return (
          <BugCard
            key={part.toolCallId}
            id={result.id || ''}
            title={result.title || ''}
            status={result.status || 'active'}
            assignee={result.assignee || ''}
            severity={result.severity || 'medium'}
            description={result.description || ''}
            createdAt={result.createdAt || ''}
            onAction={(action, data) => {
              // Mode B: 直调 API，不经过聊天流
              if (action === 'create_zentao_task') {
                sendMessage({ content: `Create ZenTao task for ${data.bugId}: priority=${data.priority}, assignee=${data.assignee}`, role: 'user' });
              }
            }}
          />
        );
      }
    }

    // ── Stitch Diff Viewer — 代码修复场景 ──
    if (toolName === 'runLocalCommand' || toolName === 'tool-runLocalCommand') {
      if (result?.status === 'Success' && result.command === 'git_diff') {
        return (
          <DiffViewer
            key={part.toolCallId}
            fileName="gitlab-api-v4.ts"
            draft
            diff={[
              { lineNumber: 24, type: 'context', content: "const authHeader = `Bearer ${token}`;" },
              { lineNumber: 25, type: 'deletion', content: "console.log(`Request sent with ${authHeader}`);" },
              { lineNumber: 25, type: 'addition', content: "logger.debug('Request sent', { correlationId }); // Redact tokens" },
              { lineNumber: 26, type: 'context', content: "return await fetch(url, { headers: { authHeader } });" },
            ]}
            onApply={() => sendMessage({ content: 'Apply fix to GitLab', role: 'user' })}
          />
        );
      }
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

    // Note: pending_approval state is no longer returned as a tool result.
    // With the blocking-wait approval pattern, the stream pauses during tool execution
    // and resumes after the user approves/denies via the ApprovalModal.
    // The tool result is either the actual data (approved) or a denial message (denied).

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
                <div className="flex flex-col mt-4 md:mt-10 w-full min-w-0">
                  <div className="flex w-full min-w-0 flex-col items-start gap-4 overflow-hidden rounded-[24px] border border-transparent bg-[#f6f3f2] p-5 md:flex-row md:gap-6 md:p-8 mb-6">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] bg-white flex items-center justify-center shrink-0 shadow-sm text-[#EC5B14]">
                      <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="w-full min-w-0">
                      <h3 className="mb-2 break-words text-lg font-bold font-display text-[#1C1B1B] cursor-default md:text-xl">{t('chat.empty_state.title')}</h3>
                      <p className="max-w-xl break-words text-sm leading-relaxed text-[#716B67] md:text-base">
                        {t('chat.empty_state.desc')}
                      </p>
                    </div>
                  </div>
                  {/* Suggested Prompts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: '🔍', label: t('chat.suggestions.bug_query', '查询缺陷详情'), prompt: '帮我查询缺陷 BUG-1 的详细信息' },
                      { icon: '🛠️', label: t('chat.suggestions.fix_suggestion', '修复代码问题'), prompt: '分析一下当前项目的代码质量问题并给出修复建议' },
                      { icon: '📋', label: t('chat.suggestions.create_task', '创建任务计划'), prompt: '帮我制定一个项目任务计划' },
                      { icon: '🚀', label: t('chat.suggestions.pipeline_check', '检查流水线状态'), prompt: '查看当前流水线的构建状态' },
                    ].map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setLocalInput(s.prompt);
                          setTimeout(() => onFormSubmit(), 0);
                        }}
                        className="flex items-center gap-3 p-4 rounded-[16px] bg-white border border-[#E8E4E2]/60 hover:border-[#EC5B14]/30 hover:shadow-[0_4px_16px_rgba(236,91,20,0.08)] transition-all text-left group"
                      >
                        <span className="text-xl shrink-0">{s.icon}</span>
                        <span className="text-sm font-medium text-[#1C1B1B] group-hover:text-[#EC5B14] transition-colors">
                          {s.label}
                        </span>
                      </button>
                    ))}
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
                                    // Collect all thinking steps from both reasoning and tool-invocation
                                    const allThinkingSteps: ThinkingStep[] = [];
                                    const completedTools: any[] = [];
                                    const textParts: any[] = [];

                                    m.parts.forEach((part: any) => {
                                      const isTool = part.type === 'tool-invocation' || part.toolName || part.type?.startsWith('tool-');
                                      const isReasoning = part.type === 'reasoning';

                                      if (isTool) {
                                        const isCompleted = !!(part.output || part.result);
                                        allThinkingSteps.push({
                                          label: getFriendlyToolName(part),
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

                                    // If streaming and last step is active, keep it active; otherwise mark all done
                                    if (isStreaming && allThinkingSteps.length > 0) {
                                      // Mark last step as active during streaming (only if still in thinking phase)
                                      const hasTextContent = textParts.some(p => p.type === 'text' && p.text?.trim());
                                      if (!hasTextContent) {
                                        allThinkingSteps[allThinkingSteps.length - 1].status = 'active';
                                      }
                                    } else if (allThinkingSteps.length > 0 && !isStreaming) {
                                      allThinkingSteps.forEach(s => s.status = 'done');
                                    }

                                    // If there's no content at all but we're streaming, show a placeholder
                                    const hasAnySteps = allThinkingSteps.length > 0 || completedTools.length > 0;

                                    return (
                                      <>
                                        {/* Unified ThinkingList - merges tool steps + reasoning steps */}
                                        {allThinkingSteps.length > 0 && (
                                          <ThinkingList steps={allThinkingSteps} />
                                        )}
                                        {/* Placeholder during streaming when no steps yet */}
                                        {!hasAnySteps && isStreaming && (
                                          <ThinkingList steps={[{ label: t('chat.thinking'), status: 'active' }]} />
                                        )}
                                        {/* Text content */}
                                        {textParts.map((part: any, i: number) => (
                                          <div key={i} className="prose prose-slate prose-sm max-w-none">
                                            {part.type === 'text' && (
                                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                                                {part.text}
                                              </ReactMarkdown>
                                            )}
                                          </div>
                                        ))}
                                        {/* Typing cursor during streaming */}
                                        {isStreaming && <TypingCursor />}
                                        {/* Tool results (CapsuleAnchor, BugCard, etc.) */}
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
                                          return <React.Fragment key={part.toolCallId}>{renderToolResult(part)}</React.Fragment>;
                                        })}
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : (
                                editingMessageId === m.id ? (
                                  /* Edit Mode */
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
                                      <button
                                        onClick={cancelEdit}
                                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#716B67] hover:bg-[#F6F3F2] transition-colors"
                                      >
                                        {t('common.cancel')}
                                      </button>
                                      <button
                                        onClick={() => submitEdit(m.id)}
                                        className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#EC5B14] text-white hover:bg-[#d44e00] transition-colors"
                                      >
                                        {t('chat.edit.save', 'Save & Send')}
                                      </button>
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
                            (isAssistant && status === 'streaming' && m.id === arr[arr.length - 1]?.id) ? "opacity-0 pointer-events-none" : "opacity-100"
                          )}>
                            <div className="flex items-center gap-1 transition-opacity">
                              {isUser && (
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => startEditing(m.id, m.content || '')}
                                      className="p-1.5 hover:bg-[#F6F3F2] rounded-md text-[#716B67]"
                                      aria-label={t('common.edit', 'Edit message')}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">
                                    {t('common.edit', 'Edit message')}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                  <button onClick={() => copyToClipboard(m)} className="p-1.5 hover:bg-[#F6F3F2] rounded-md text-[#716B67]" aria-label={copiedId === m.id ? t('common.copied') : t('common.copy', 'Copy message')}>
                                    {copiedId === m.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">
                                  {copiedId === m.id ? t('common.copied') : t('common.copy')}
                                </TooltipContent>
                              </Tooltip>
                              {isAssistant && (
                                <>
                                  <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => setMessageFeedback(prev => ({ ...prev, [m.id]: prev[m.id] === 'up' ? undefined : 'up' }))}
                                        className={cn(
                                          "p-1.5 rounded-md transition-colors",
                                          messageFeedback[m.id] === 'up'
                                            ? "bg-[#EC5B14]/10 text-[#EC5B14]"
                                            : "hover:bg-[#F6F3F2] text-[#716B67]"
                                        )}
                                        aria-label={t('common.good_response', 'Good response')}
                                      >
                                        <ThumbsUp className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">
                                      {t('common.good_response', 'Good response')}
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => setMessageFeedback(prev => ({ ...prev, [m.id]: prev[m.id] === 'down' ? undefined : 'down' }))}
                                        className={cn(
                                          "p-1.5 rounded-md transition-colors",
                                          messageFeedback[m.id] === 'down'
                                            ? "bg-red-500/10 text-red-500"
                                            : "hover:bg-[#F6F3F2] text-[#716B67]"
                                        )}
                                        aria-label={t('common.bad_response', 'Bad response')}
                                      >
                                        <ThumbsDown className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">
                                      {t('common.bad_response', 'Bad response')}
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                      <button onClick={() => handleRegenerate(m.id)} className="p-1.5 hover:bg-[#F6F3F2] rounded-md text-[#716B67]" aria-label={t('common.regenerate', 'Regenerate response')}>
                                        <RotateCcw className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-[#4A443F] border-none text-white shadow-none">
                                      {t('common.regenerate')}
                                    </TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                            {/* Timestamp */}
                            {m.createdAt && (
                              <span className="text-[10px] text-[#716B67]/60 font-mono">
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {/* Branch indicator — shows "1/2" for edited user messages */}
                            {isUser && (branchIndex[m.id] || 0) > 0 && (
                              <span className="text-[10px] text-[#716B67]/60 font-mono">
                                {branchIndex[m.id] + 1}
                              </span>
                            )}
                            {/* Stopped indicator — inline within the last assistant message */}
                            {isAssistant && isStopped && isLast && (
                              <span className="text-[10px] text-[#716B67] font-medium flex items-center gap-1">
                                <Square className="w-3 h-3 fill-current" />
                                {t('chat.stopped', '已停止')}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}

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
                            onClick={() => reload()}
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
                </>
              )}

            </AnimatePresence>
          </div>
        </div>

        <div className="pt-2 pb-4 md:pb-8 px-4 md:px-8 bg-gradient-to-t from-[#FCF9F8] via-[#FCF9F8] to-transparent z-10 w-full mt-auto">
          <div className="max-w-[800px] mx-auto relative">
            <AnimatePresence>{showScrollButton && <motion.button {...(reducedMotion ? { initial: false, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 10, scale: 0.9 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 10, scale: 0.9 } })} onClick={scrollToBottom} className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 w-8 h-8 bg-white rounded-full shadow-lg border border-[#E8E4E2] flex items-center justify-center text-[#716B67] hover:text-[#EC5B14] hover:border-[#EC5B14]/30 transition-all active:scale-95"><ArrowDown className="w-4 h-4" /></motion.button>}</AnimatePresence>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-2 flex flex-col shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-[#1C1B1B]/5 transition-all focus-within:ring-[#EC5B14]/30 focus-within:shadow-[0_10px_40px_-10px_rgba(236,91,20,0.15)]">
              <AnimatePresence>
                {selectedFiles.length > 0 && (
                  <motion.div {...(reducedMotion ? { initial: false, animate: { opacity: 1 } } : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 } })} className="flex flex-wrap gap-2 px-4 py-2 border-b border-[#E8E4E2]/40 overflow-hidden">
                    {selectedFiles.map((file, idx) => (
                      <motion.div key={`${file.name}-${idx}`} {...(reducedMotion ? { initial: false, animate: { opacity: 1 } } : { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.8, opacity: 0 } })} className="flex items-center gap-2 bg-[#F6F3F2] px-3 py-1.5 rounded-xl border border-[#E8E4E2]/60 group transition-all hover:border-[#EC5B14]/30">
                        <FileText className="w-3.5 h-3.5 text-[#716B67]" /><span className="text-xs font-semibold text-[#1C1B1B] max-w-[120px] truncate">{file.name}</span>
                        <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white text-[#716B67] hover:text-red-500 transition-colors"><CloseIcon className="w-3 h-3" /></button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <textarea
                ref={textAreaRef}
                rows={1}
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const files: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].kind === 'file') {
                      const file = items[i].getAsFile();
                      if (file && file.type.startsWith('image/')) {
                        files.push(file);
                      }
                    }
                  }
                  if (files.length > 0) {
                    e.preventDefault();
                    setSelectedFiles(prev => [...prev, ...files]);
                  }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isLoading) onFormSubmit(); } }}
                placeholder={t('chat.placeholder')}
                className="w-full bg-transparent border-none text-[#1C1B1B] focus:ring-0 text-sm py-4 px-4 resize-none min-h-[56px] max-h-[200px] placeholder:text-[#716B67]/70 focus:outline-none"
              />
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
                <button onClick={() => isLoading ? handleStop() : onFormSubmit()} className={cn("w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center transition-all", isLoading ? "bg-[#1C1B1B] text-white" : ((!localInput.trim() && selectedFiles.length === 0) ? "bg-[#eeece9] text-[#716B67]/40 cursor-not-allowed" : "bg-[#EC5B14] text-white shadow-lg hover:scale-105 active:scale-95"))}>
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
                <span className="font-bold text-sm text-[#1C1B1B]">交互胶囊</span>
                <span className="text-[10px] text-[#716B67] bg-[#E8E4E2] px-1.5 py-0.5 rounded-full">
                  {activeCapsule.uiKit?.uiType}
                </span>
              </div>
              <button
                onClick={() => setActiveCapsule(null)}
                className="p-1.5 hover:bg-[#eeece9] rounded-lg transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
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
                <div className="flex items-center justify-between"><span className="text-xs text-[#716B67]">{t('chat.meta.tokens')}</span><span className="text-xs font-mono font-bold text-[#1C1B1B]">{totalUsage.totalTokens > 0 ? totalUsage.totalTokens.toLocaleString() : '—'}</span></div>
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
// cache buster 1775898677
// cache buster 1775898894
// cache buster 1775899337
