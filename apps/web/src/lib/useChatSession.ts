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

  // Sync ref to ensure async callbacks always have the latest value
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Reset flags when switching sessions
  useEffect(() => {
    titleGeneratedRef.current = false;
    initializedRef.current = false;
  }, [sessionId]);

  const { messages, sendMessage, status, setMessages, stop, error, data } = (useChat as any)({
    id: sessionId ?? 'new',
    initialMessages: initialMessages,
    api: '/api/chat',
    fetch: authFetch,
    body: {
      modelId: selectedModelId,
      search: isSearchMode,
      knowledge: isKnowledgeMode,
      sessionId: sessionId,
    },
    onFinish: async ({ message }: any) => {
      const metadata = message?.metadata;
      const usage = metadata?.usage;

      if (usage) {
        setMessages((prev: any[]) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              usage: {
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
                totalTokens: usage.totalTokens ?? 0,
              },
            };
          }
          return updated;
        });
      }

      const sid = sessionIdRef.current;
      if (sid) {
        await onStreamFinished(sid);
      }
    }
  });

  const isLoading = status === 'streaming' || status === 'submitting';

  // Reset stopped state only when new streaming starts
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    if (prevIsLoadingRef.current === false && isLoading) {
      setIsStopped(false);
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  // Initial messages loading
  useEffect(() => {
    if ((!initializedRef.current || messages.length === 0) && initialMessages.length > 0) {
      initializedRef.current = true;
      setMessages(initialMessages);
      titleGeneratedRef.current = true;
    }
  }, [initialMessages, messages.length, setMessages]);

  const totalUsage = useMemo(() => {
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
const handleStop = () => {
  setIsStopped(true);
  stop();
};

// 🛡️ 加固版发送函数：确保每次调用都带上最新的 Token 和 Body 配置
const safeSendMessage = useCallback(async (message: any, options: any = {}) => {
  const activeToken = localStorage.getItem('uclaw_auth_token');
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
    }
  });
}, [sendMessage, selectedModelId, isSearchMode, isKnowledgeMode, sessionId]);

return {
  messages,
  sendMessage: safeSendMessage, // 导出加固后的版本
  status,
...
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
    data
  };
}
