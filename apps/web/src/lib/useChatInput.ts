import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from './api-client';

interface UseChatInputProps {
  sendMessage: (message: any, options?: any) => Promise<void>;
  createSession: () => Promise<string | null>;
  token: string | null;
  selectedModelId: string;
  isSearchMode: boolean;
  isKnowledgeMode: boolean;
  navigate: (path: string, options?: any) => void;
  sessionIdRef: React.MutableRefObject<string | null>;
  setIsLocalThinking: (val: boolean) => void;
  userScrolledUpRef: React.MutableRefObject<boolean>;
  isLoading: boolean;
}

export function useChatInput({
  sendMessage,
  createSession,
  token,
  selectedModelId,
  isSearchMode,
  isKnowledgeMode,
  navigate,
  sessionIdRef,
  setIsLocalThinking,
  userScrolledUpRef,
  isLoading
}: UseChatInputProps) {
  const [localInput, setLocalInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const uploadFile = useCallback(async (file: File): Promise<{ name: string; contentType: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const data = await api.post<any>('/api/upload', formData);
    return { 
      name: file.name, 
      contentType: file.type || 'application/octet-stream', 
      url: data.url 
    };
  }, []);

  const onFormSubmit = useCallback(async (e?: any) => {
    if (e) e.preventDefault();
    if ((!localInput.trim() && selectedFiles.length === 0) || isLoading) return;

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
      navigate(`/chat/${newId}`, { state: { autoSubmit: true } });
      return;
    }

    setIsLocalThinking(true);
    userScrolledUpRef.current = false;
    const val = localInput;
    setLocalInput('');
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);

    try {
      const activeToken = token || localStorage.getItem('uclaw_auth_token');
      const attachments = filesToUpload.length > 0 ? await Promise.all(filesToUpload.map(uploadFile)) : undefined;
      const userMessage = { content: val, role: 'user', experimental_attachments: attachments };
      await sendMessage(userMessage as any, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        },
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
  }, [
    localInput, 
    selectedFiles, 
    isLoading, 
    sessionIdRef, 
    setIsLocalThinking, 
    createSession, 
    navigate, 
    userScrolledUpRef, 
    uploadFile, 
    sendMessage, 
    selectedModelId, 
    isSearchMode, 
    isKnowledgeMode
  ]);

  // Handle auto-resize
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
    }
  }, [localInput]);

  return {
    localInput,
    setLocalInput,
    selectedFiles,
    setSelectedFiles,
    textAreaRef,
    onFormSubmit,
    uploadFile
  };
}
