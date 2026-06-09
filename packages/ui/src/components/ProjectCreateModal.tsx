import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (name: string) => void;
}

export function ProjectCreateModal({ isOpen, onClose, onCreated }: ProjectCreateModalProps) {
  const [newProjectName, setNewProjectName] = useState('');

  const handleQuickCreate = async () => {
    const name = newProjectName.trim();
    if (!name) {
      onClose();
      return;
    }
    try {
      let finalDescription = '';

      if ((window as any).api?.createLocalProject) {
        // Desktop native FS creation
        const res = await (window as any).api.createLocalProject(name);
        if (res.success && res.path) {
          finalDescription = `(path:${res.path})`;
        } else {
          alert('本地文件夹创建失败: ' + res.error);
        }
      } else {
        // Fallback or daemon API
        const rpcRes = await api.post<any>('/api/user/node/create-local-project', {
          projectName: name,
          category: 'Engineering'
        });
        if (rpcRes.success && rpcRes.path) {
          finalDescription = `(path:${rpcRes.path})`;
        }
      }

      // 2. 存入云端数据库同步状态
      const res = await api.post<any>('/api/knowledge-projects', {
        name,
        category: 'Engineering',
        description: finalDescription
      });

      if (res.success) {
        onCreated?.(name);
      }
    } catch (err) {
      console.error('Failed to quick create project:', err);
    }
    setNewProjectName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] sm:rounded-[16px] gap-0 p-6 z-[99999]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1C1B1B]">Create New Project</DialogTitle>
          <DialogDescription className="pt-2 text-sm text-[#716B67]">
            Enter a name for your new local project workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6 mb-4">
          <input
            autoFocus
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickCreate();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="e.g. my-awesome-project"
            className="w-full bg-[#F6F3F2] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#EC5B14]/20 outline-none font-medium text-sm"
          />
        </div>
        <DialogFooter className="flex sm:justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#E8E4E2] text-sm font-bold text-[#716B67] hover:bg-[#F1EFEB] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleQuickCreate}
            className="px-4 py-2 rounded-lg bg-[#1C1B1B] text-sm font-bold text-white hover:bg-[#1C1B1B]/80 transition-all"
          >
            Create
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
