import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from './api-client';

export interface PendingAttachment {
  id: string;
  file?: File;
  name: string;
  contentType: string;
  url?: string;
  isUploading: boolean;
}

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
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [ghostText, setGhostText] = useState<string>('');
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!localInput.trim() || localInput.endsWith(' ')) {
      setGhostText('');
      return;
    }

    const handler = setTimeout(async () => {
      setIsPredicting(true);
      try {
        const res = await api.post<any>('/api/chat/autocomplete', { prefix: localInput });
        if (res && res.completion) {
          setGhostText(res.completion);
        } else {
          setGhostText('');
        }
      } catch (e) {
        setGhostText('');
      } finally {
        setIsPredicting(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [localInput]);

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

  const addFiles = useCallback((files: File[]) => {
    const newAtts = files.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      name: f.name,
      contentType: f.type || 'application/octet-stream',
      isUploading: true
    }));
    
    setAttachments(prev => [...prev, ...newAtts]);

    newAtts.forEach(async (att) => {
      try {
        const result = await uploadFile(att.file);
        setAttachments(prev => prev.map(p => 
          p.id === att.id ? { ...p, isUploading: false, url: result.url } : p
        ));
      } catch (err) {
        console.error('Upload failed for', att.name, err);
        setAttachments(prev => prev.filter(p => p.id !== att.id));
      }
    });
  }, [uploadFile]);

  const removeFile = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const onFormSubmit = useCallback(async (e?: any) => {
    if (e) e.preventDefault();
    if (attachments.some(a => a.isUploading)) return;
    if ((!localInput.trim() && attachments.length === 0) || isLoading) return;

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
    const filesToUpload = [...attachments];
    setAttachments([]);

    try {
      const activeToken = token || localStorage.getItem('uclaw_auth_token');
      const preparedAttachments = filesToUpload.length > 0 ? filesToUpload.map(a => ({
        name: a.name,
        contentType: a.contentType,
        url: a.url!
      })) : undefined;
      
      const userMessage = { content: val, role: 'user', experimental_attachments: preparedAttachments };
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
      setAttachments(filesToUpload);
    }
  }, [
    localInput, 
    attachments, 
    isLoading, 
    sessionIdRef, 
    setIsLocalThinking, 
    createSession, 
    navigate, 
    userScrolledUpRef, 
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
    attachments,
    addFiles,
    removeFile,
    textAreaRef,
    onFormSubmit,
    uploadFile,
    ghostText,
    setGhostText,
    isPredicting
  };
}
