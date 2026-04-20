import { useChat } from '@ai-sdk/react';
import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { authFetch } from './api-client';

interface UseChatSessionProps {
  sessionId: string | null;
  initialMessages: any[];
  token: string | null;
  selectedModelId: string;
  isSearchMode: boolean;
  isKnowledgeMode: boolean;
  onStreamFinished: (id: string) => Promise<void>;
}

export function useChatSession({
  sessionId,
  initialMessages,
  token,
  selectedModelId,
  isSearchMode,
  isKnowledgeMode,
  onStreamFinished
}: UseChatSessionProps) {
  const initializedRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  const titleGeneratedRef = useRef(false);
  const [isStopped, setIsStopped] = useState(false);

  // ── Tree State ──
  const [fullTree, setFullTree] = useState<any[]>([]); // 存储所有拉取到的原始消息
  const [currentLeafId, setCurrentLeafId] = useState<string | null>(null);

  // Sync ref to ensure async callbacks always have the latest value
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Reset flags when switching sessions
  useEffect(() => {
    titleGeneratedRef.current = false;
    initializedRef.current = false;
    setFullTree([]);
    setCurrentLeafId(null);
  }, [sessionId]);

  // 1. 根据 fullTree 和 currentLeafId 计算当前活跃路径的线性消息列表
  const activeMessages = useMemo(() => {
    if (fullTree.length === 0) return [];
    
    // 如果没有指定叶子节点，默认取最后一条
    let targetId = currentLeafId;
    if (!targetId) {
      // 找到时间最晚的消息作为默认叶子
      const sorted = [...fullTree].sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      targetId = sorted[0]?.id;
    }

    if (!targetId) return [];

    const path: any[] = [];
    const nodeMap = new Map(fullTree.map(m => [m.id, m]));
    
    let curr: any = nodeMap.get(targetId);
    while (curr) {
      path.unshift(curr);
      curr = curr.parentId ? nodeMap.get(curr.parentId) : null;
    }

    return path;
  }, [fullTree, currentLeafId]);

  const { messages, sendMessage, status, setMessages, stop, error, data } = (useChat as any)({
    id: sessionId ?? 'new',
    initialMessages: [], // 我们通过 setMessages 手动控制渲染列表
    api: '/api/chat',
    fetch: authFetch,
    body: {
      modelId: selectedModelId,
      search: isSearchMode,
      knowledge: isKnowledgeMode,
      sessionId: sessionId,
    },
    onFinish: async ({ message }: any) => {
      const sid = sessionIdRef.current;
      if (sid) {
        await onStreamFinished(sid);
        // 清空 SDK 内部的增量消息列表，因为此时它们已经通过 initialMessages -> fullTree -> activeMessages 同步到了 UI
        setMessages([]); 
      }
    }
  });

  // 当 SDK 的 messages 发生变化（流式过程中），同步更新到 UI 列表
  // 这里的策略是：在流式过程中，为了避免历史消息重复或 ID 冲突导致的闪烁，
  // 我们在有增量消息时，优先展示增量消息（因为 SDK 的 messages 通常包含了当前对话上下文）
  // 或者，如果 SDK messages 只是当前这一轮，则合并。
  // 为了彻底解决闪烁：
  // 1. 在 streaming/submitting 期间，合并展示。
  // 2. 在 idle 且 messages 还有值时，说明正在等待/进行服务端刷新，此时继续展示合并列表。
  // 3. 但由于 ID 可能不同，我们需要在 ChatSession.tsx 中更稳健地去重，或者在这里去重。
  const displayMessages = useMemo(() => {
    // 1. 流式过程中，直接合并展示，此时 messages ID 是 chat-xxx 临时 ID，与历史不冲突
    if (status === 'streaming' || status === 'submitting') {
      return [...activeMessages, ...messages];
    }

    // 2. 传输结束但 messages 还没来得及清空（等待 refresh 完成的瞬间）
    if (messages.length > 0) {
      // 此时 activeMessages 可能已经通过 refresh 拿到了最新数据。
      // 我们过滤掉已经在 activeMessages 中存在的流式消息（通过内容匹配）以防重复
      const filtered = messages.filter((m: any) => {
        return !activeMessages.some(am => 
          am.role === m.role && am.content === m.content && m.content.length > 0
        );
      });
      return [...activeMessages, ...filtered];
    }

    // 3. 闲置状态，使用树路径
    return activeMessages;
  }, [status, messages, activeMessages]);

  const isLoading = status === 'streaming' || status === 'submitting';

  // Reset stopped state only when new streaming starts
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    if (prevIsLoadingRef.current === false && isLoading) {
      setIsStopped(false);
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  // Sync initialMessages to fullTree
  useEffect(() => {
    if (initialMessages.length > 0) {
      setFullTree(initialMessages);
      
      const sorted = [...initialMessages].sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      const latestMessage = sorted[0];

      if (!initializedRef.current || !currentLeafId) {
        initializedRef.current = true;
        titleGeneratedRef.current = true;
        if (latestMessage) {
            setCurrentLeafId(latestMessage.id);
        }
      } else {
        // 如果 initialMessages 发生了实质性更新（通常是流式结束后的 refresh），
        // 且当前 leaf 就在这堆消息中，尝试跟随到最新的叶子
        if (latestMessage && latestMessage.id !== currentLeafId) {
           setCurrentLeafId(latestMessage.id);
        }
      }
    }
  }, [initialMessages]);

  const totalUsage = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    for (const msg of displayMessages) {
      const u = (msg as any).usage;
      if (u) {
        inputTokens += u.inputTokens ?? u.promptTokens ?? u.prompt_tokens ?? 0;
        outputTokens += u.outputTokens ?? u.completionTokens ?? u.completion_tokens ?? 0;
      }
    }
    return { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens };
  }, [displayMessages]);

  const handleStop = () => {
    setIsStopped(true);
    stop();
  };

  // 🛡️ 加固版发送函数：确保带上最新的 parentId
  const safeSendMessage = useCallback(async (message: any, options: any = {}) => {
    const activeToken = localStorage.getItem('uclaw_auth_token');
    
    // 发送消息时，明确告知后端当前所在的父节点 ID
    // 如果是编辑，options.body 中通常会有专门的处理；如果是新消息，取当前叶子 ID
    const parentId = options.body?.parentId || currentLeafId;

    return sendMessage(message, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${activeToken}`
      },
      body: {
        ...options.body,
        modelId: selectedModelId,
        search: isSearchMode,
        knowledge: isKnowledgeMode,
        sessionId: sessionId,
        parentId,
      }
    });
  }, [sendMessage, selectedModelId, isSearchMode, isKnowledgeMode, sessionId, currentLeafId]);

  // 切换分支
  const switchBranch = useCallback((nodeId: string) => {
    // 找到该节点下的最深叶子节点
    const findDeepestLeaf = (id: string): string => {
      const children = fullTree.filter(m => m.parentId === id);
      if (children.length === 0) return id;
      // 简单策略：总是取第一个子分支的最深叶子，或按时间取
      const sorted = children.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      return findDeepestLeaf(sorted[0].id);
    };

    const leafId = findDeepestLeaf(nodeId);
    setCurrentLeafId(leafId);
  }, [fullTree]);

  return {
    messages: displayMessages,
    fullTree,
    setFullTree,
    sendMessage: safeSendMessage,
    status,
    setMessages,
    stop,
    error,
    isLoading,
    isStopped,
    setIsStopped,
    totalUsage,
    handleStop,
    sessionIdRef,
    titleGeneratedRef,
    data,
    switchBranch,
    currentLeafId,
    setCurrentLeafId
  };
}
