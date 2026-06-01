import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderRoot, Search, ArrowUpDown, Plus,
  Sparkles, X, Loader2, ArrowRight, Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
import { useWorkspace } from '../contexts/WorkspaceContext';

export function Projects() {
  const { t } = useTranslation();
  const { setActiveProjectId } = useWorkspace();

  // State
  const [projects, setProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'assets'>('newest');
  const [isLoading, setIsLoading] = useState(true);

  // New Project Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', category: 'Engineering', description: '' });
  const [isCreating, setIsCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any>('/api/knowledge-projects');
      if (res.success) {
        setProjects(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const [isPickingPath, setIsPickingPath] = useState(false);

  const handlePickLocalPath = async () => {
    setIsPickingPath(true);
    try {
      // 发起 RPC 请求，要求本地助手打开文件夹选择器
      const res = await api.post<any>('/api/user/node/open-folder-picker');
      if (res.success && res.path) {
        setNewProject({ ...newProject, description: `${newProject.description} (path:${res.path})` });
      }
    } catch (err) {
      console.error('Failed to trigger local picker:', err);
      // 如果助手未连接，给出友好提示
      alert('无法调起本地助手。请确保 UClaw 本地助手（Daemon）已启动并处于登录状态。');
    } finally {
      setIsPickingPath(false);
    }
  };

  const [createLocalFolder, setCreateLocalFolder] = useState(true);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      let finalDescription = newProject.description;

      // 1. 如果勾选了“创建本地文件夹”，先通过 RPC 通知助手执行本地 mkdir
      if (createLocalFolder) {
        try {
          const rpcRes = await api.post<any>('/api/user/node/create-local-project', {
            projectName: newProject.name,
            category: newProject.category
          });
          if (rpcRes.success && rpcRes.path) {
            finalDescription += ` (path:${rpcRes.path})`;
          }
        } catch (rpcErr) {
          console.warn('Local folder creation failed, falling back to cloud-only:', rpcErr);
          // 如果助手没开，可以选择报错或者继续
        }
      }

      // 2. 将包含本地路径的项目元数据存入云端数据库
      const res = await api.post<any>('/api/knowledge-projects', {
        ...newProject,
        description: finalDescription
      });

      if (res.success) {
        setIsModalOpen(false);
        setNewProject({ name: '', category: 'Engineering', description: '' });
        await fetchProjects();
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('创建项目失败，请检查网络或本地助手连接。');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredProjects = projects
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b._count?.documents || 0) - (a._count?.documents || 0);
    });

  return (
    <div className="flex-1 overflow-y-auto bg-[#FCF9F8] font-sans text-[#1C1B1B] p-10 relative pb-32">
      <div className="max-w-7xl mx-auto space-y-10 w-full">

        {/* Header Section */}
        <section className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-3xl font-display font-extrabold tracking-tight text-[#1C1B1B]">{t('projects.title')}</h2>
              <p className="text-[#716B67] font-medium">{t('projects.subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B67]" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('projects.search_placeholder')}
                className="w-full bg-white border border-[#E8E4E2] rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#EC5B14]/10 transition-all"
              />
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortBy(sortBy === 'newest' ? 'assets' : 'newest')}
              className="p-2 bg-white border border-[#E8E4E2] rounded-lg text-[#716B67] hover:text-[#1C1B1B] transition-colors"
              title={sortBy === 'newest' ? t('projects.sort.newest') : t('projects.sort.assets')}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* Create Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#1C1B1B] text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-md hover:bg-[#1C1B1B]/80 transition-all"
            >
              <Plus className="w-4 h-4" />
              {t('projects.new_button')}
            </button>
          </div>
        </section>

        {/* Projects Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4">
          {isLoading ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#EC5B14] animate-spin mb-2" />
              <p className="text-[#716B67] font-medium">{t('common.syncing')}</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-[#E8E4E2]">
              <div className="w-16 h-16 bg-[#F6F3F2] rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderRoot className="text-[#A8A4A1] w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-1">{t('projects.empty')}</h3>
              <p className="text-[#716B67] mb-6">{t('projects.empty_desc')}</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-[#EC5B14] font-bold text-sm flex items-center gap-1 mx-auto hover:underline"
              >
                {t('projects.create_first')} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            filteredProjects.map((project) => (
              <motion.div
                layoutId={project.id}
                key={project.id}
                className="bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-transparent hover:border-[#EC5B14]/30 hover:shadow-[0_10px_30px_rgba(236,91,20,0.05)] transition-all overflow-hidden group cursor-pointer relative"
              >
                {/* Delete Button Overlay */}
                <div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`确定要删除项目 "${project.name}" 吗？此操作不可恢复。`)) {
                        try {
                          await api.delete(`/api/knowledge-projects/${project.id}`);
                          await fetchProjects();
                        } catch (err) {
                          console.error('Delete failed:', err);
                          alert('删除失败');
                        }
                      }
                    }}
                    className="bg-white shadow-xl text-red-500 p-2 rounded-xl border border-red-50 hover:bg-red-50 transition-all active:scale-95"
                    title="删除项目"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col h-full" onClick={() => setActiveProjectId(project.id)}>
                  <img
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 mix-blend-multiply"
                    src={project.iconUrl || "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800"}
                    alt={project.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent"></div>
                </div>
                <div className="p-6 pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-0.5 bg-[#EC5B14]/10 text-[#EC5B14] text-[10px] font-bold uppercase tracking-widest rounded-md">{project.category}</span>
                    <span className="text-[10px] text-[#716B67] font-medium">{new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-lg font-display font-bold mb-1 group-hover:text-[#EC5B14] transition-colors">{project.name}</h4>
                  <p className="text-[#716B67] text-sm mb-4 line-clamp-2 min-h-[40px]">{project.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-[#F6F3F2]">
                    <div className="flex -space-x-2">
                      <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${project.id}`} alt="user" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-[#1C1B1B]">{project._count?.documents || 0}</span>
                      <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-tighter">{t('projects.stats.assets')}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </section>

      </div>

      {/* New Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#1C1B1B]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-display font-bold">{t('projects.create_modal.title')}</h3>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#F6F3F2] rounded-full">
                    <X className="w-5 h-5 text-[#716B67]" />
                  </button>
                </div>

                <form onSubmit={handleCreateProject} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#716B67] mb-2">{t('projects.create_modal.name_label')}</label>
                    <input
                      required
                      value={newProject.name}
                      onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder={t('projects.create_modal.name_placeholder')}
                      className="w-full bg-[#F6F3F2] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#EC5B14]/20 outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#716B67] mb-2">{t('projects.create_modal.category_label')}</label>
                    <select
                      value={newProject.category}
                      onChange={e => setNewProject({ ...newProject, category: e.target.value })}
                      className="w-full bg-[#F6F3F2] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#EC5B14]/20 outline-none font-medium appearance-none"
                    >
                      <option value="Finance">💰 财务与审计项目</option>
                      <option value="HR">👥 人事与招聘项目</option>
                      <option value="Legal">⚖️ 法务与合规项目</option>
                      <option value="Engineering">💻 研发与工程项目</option>
                      <option value="Operations">📊 业务运营项目</option>
                    </select>
                  </div>

                  <div className="bg-[#F6F3F2]/50 p-4 rounded-2xl border border-[#E8E4E2]/50">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#716B67]">数据存放位置 (私有化保护)</label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={createLocalFolder} 
                          onChange={(e) => setCreateLocalFolder(e.target.checked)}
                          className="w-4 h-4 rounded border-[#E8E4E2] text-[#EC5B14] focus:ring-[#EC5B14]/20"
                        />
                        <span className="text-[11px] font-bold text-[#1C1B1B] group-hover:text-[#EC5B14] transition-colors">同步在本地创建</span>
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <div className={cn(
                        "flex-1 bg-white rounded-xl px-4 py-3 text-sm text-[#716B67] truncate font-medium border border-[#E8E4E2]",
                        createLocalFolder && "bg-slate-50 text-slate-400 italic"
                      )}>
                        {createLocalFolder 
                          ? `自动在本地创建: ~/Documents/UClaw/${newProject.name || '项目名'}` 
                          : (newProject.description.includes('path:') ? newProject.description.split('path:')[1] : '点击选择本地工作文件夹...')}
                      </div>
                      {!createLocalFolder && (
                        <button 
                          type="button"
                          onClick={handlePickLocalPath}
                          disabled={isPickingPath}
                          className="bg-white border border-[#E8E4E2] px-4 rounded-xl text-xs font-bold hover:bg-[#F6F3F2] transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                          {isPickingPath ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          浏览
                        </button>
                      )}
                    </div>
                    <p className="mt-3 text-[10px] text-[#A8A4A1] font-medium leading-relaxed">
                      💡 {createLocalFolder 
                        ? '勾选后，UClaw 本地助手将为您准备好干净的工位。' 
                        : '选择已有文件夹，助手将自动索引该文件夹下的业务文件。'} 原始资料仅保存在您的本地电脑。
                    </p>
                  </div>

                  <button
                    disabled={isCreating}
                    type="submit"
                    className="w-full bg-[#EC5B14] text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-[#EC5B14]/20 hover:bg-[#cc4900] transition-all flex items-center justify-center gap-2"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {t('projects.create_modal.submit')}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
