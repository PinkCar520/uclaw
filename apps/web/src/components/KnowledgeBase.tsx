import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, Cloud, UploadCloud, ArrowRight,
  FileText, Sparkles, Trash2, RefreshCw, Loader2,
  ChevronLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';

interface KnowledgeBaseProps {
  projectId: string;
  onBack: () => void;
}

export function KnowledgeBase({ projectId, onBack }: KnowledgeBaseProps) {
  const { t } = useTranslation();
  
  // Logic State
  const [documents, setDocuments] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [stats, setStats] = useState<any>({ activeSources: 0, orphanedCount: 0, categories: [], dataIndexedMb: '0.0' });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 获取项目详情和该项目的文档
      const [docsRes, statsRes, projectsRes] = await Promise.all([
        api.get<any>(`/api/rag/documents?projectId=${projectId}`),
        api.get<any>('/api/rag/stats'),
        api.get<any>('/api/knowledge-projects')
      ]);
      
      if (docsRes.success) setDocuments(docsRes.data);
      if (projectsRes.success) {
        const currentProject = projectsRes.data.find((p: any) => p.id === projectId);
        setProject(currentProject);
      }
      if (statsRes.success) {
        setStats({
          activeSources: docsRes.data.length, // 只显示当前项目的资产数
          dataIndexedMb: statsRes.data.dataIndexedMb || '0.00'
        });
      }
    } catch (err) {
      console.error('Failed to fetch project data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);

    try {
      const res = await api.post<any>('/api/upload/rag', formData);
      if (res.success) {
        // Claude Experience: Immediate feedback and stop loader
        setIsUploading(false);
        await fetchData(); 
      } else {
        setIsUploading(false);
        alert(`Upload failed: ${res.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      setIsUploading(false);
      console.error('Upload failed:', err);
      alert(`Upload failed: ${err.message || 'Network error'}`);
    } finally {
      e.target.value = '';
    }
  };

  // Smart Polling: Only poll when there are documents in 'processing' status
  useEffect(() => {
    const hasProcessing = documents.some(doc => doc.status === 'processing');
    
    if (hasProcessing) {
      const interval = setInterval(() => {
        // Silently refresh project data and documents
        fetchData();
      }, 3000); // Poll every 3 seconds
      
      return () => clearInterval(interval);
    }
  }, [documents, fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await api.delete<any>(`/api/rag/documents/${id}`);
      if (res.success) {
        await fetchData();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (!project && isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FCF9F8]">
        <Loader2 className="w-8 h-8 text-[#EC5B14] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FCF9F8] font-sans text-[#1C1B1B] p-10 relative pb-32">
      <div className="max-w-7xl mx-auto space-y-12 w-full">
        
        {/* Breadcrumbs / Header Section */}
        <section className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="max-w-2xl">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-[#716B67] font-bold text-sm mb-4 hover:text-[#1C1B1B] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('knowledge_base.back_link')}
            </button>
            <div className="flex items-center gap-4 mb-2">
               <span className="px-2.5 py-0.5 bg-[#EC5B14]/10 text-[#EC5B14] text-[10px] font-bold uppercase tracking-widest rounded-md">{project?.category}</span>
               <h2 className="text-4xl font-display font-extrabold tracking-tight text-[#1C1B1B]">{project?.name}</h2>
            </div>
            <p className="text-[#716B67] text-lg">{t('knowledge_base.subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <button 
                onClick={fetchData}
                className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
                <RefreshCw className={cn("w-5 h-5 text-[#716B67]", isLoading && "animate-spin")} />
            </button>
            <div className="px-4 py-2 bg-[#ffdbce] text-[#783112] rounded-lg text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EC5B14] animate-pulse"></span>
              {t('knowledge_base.status.healthy')}
            </div>
          </div>
        </section>

        {/* Stats & Ingest Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Stats Column */}
          <div className="md:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#716B67] mb-1">{t('knowledge_base.stats.active_sources')}</p>
                <h3 className="text-3xl font-display font-bold">{documents.length}</h3>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#EC5B14]/10 flex items-center justify-center">
                <Database className="text-[#EC5B14] w-6 h-6" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#716B67] mb-1">{t('knowledge_base.stats.data_indexed')}</p>
                <h3 className="text-3xl font-display font-bold">{stats.dataIndexedMb} <span className="text-lg font-medium text-[#716B67]">{t('knowledge_base.stats.unit_mb')}</span></h3>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Cloud className="text-blue-600 w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Ingest Area */}
          <div className="md:col-span-8 bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-8 flex flex-col items-center justify-center border-2 border-dashed border-[#E8E4E2] hover:border-[#EC5B14]/40 group hover:bg-[#FCF9F8] transition-all cursor-pointer relative overflow-hidden">
            {isUploading && (
                <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-[#EC5B14] animate-spin mb-2" />
                    <p className="font-bold text-[#EC5B14]">{t('knowledge_base.ingest.indexing')}</p>
                </div>
            )}
            <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                onChange={handleFileUpload}
                accept=".txt,.md,.json,.csv,.js,.ts,.jsx,.tsx,.py,.yml,.yaml,.xml,.html,.htm,.log,.sql,.sh"
            />
            <div className="w-16 h-16 rounded-full bg-[#F6F3F2] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <UploadCloud className="text-[#EC5B14] w-8 h-8" />
            </div>
            <h4 className="text-xl font-display font-bold mb-2">{t('knowledge_base.ingest.title')}</h4>
            <p className="text-[#716B67] text-center max-w-sm mb-6">{t('knowledge_base.ingest.desc')}</p>
            <button className="bg-[#1C1B1B] text-white px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md hover:bg-[#1C1B1B]/80 transition-colors">{t('knowledge_base.ingest.button')}</button>
          </div>
        </section>

        {/* Knowledge Assets Table */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-8 overflow-hidden">
            <h3 className="text-2xl font-display font-bold mb-6">{t('knowledge_base.assets.title')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[#716B67] text-xs font-bold uppercase tracking-widest border-b border-[#E8E4E2]">
                    <th className="pb-4 font-bold">{t('knowledge_base.assets.table.name')}</th>
                    <th className="pb-4 font-bold">{t('knowledge_base.assets.table.type')}</th>
                    <th className="pb-4 font-bold">{t('knowledge_base.assets.table.last_synced')}</th>
                    <th className="pb-4 font-bold text-right">{t('knowledge_base.assets.table.status')}</th>
                    <th className="pb-4 font-bold text-right">{t('common.delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6F3F2]">
                  {documents.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#716B67] italic font-medium">
                        {t('knowledge_base.assets.status.empty')}
                      </td>
                    </tr>
                  )}
                  {documents.map((doc) => (
                    <tr key={doc.id} className="group hover:bg-[#FCF9F8] transition-colors cursor-default">
                      <td className="py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                           <FileText className="text-[#EC5B14] w-4 h-4" />
                        </div>
                        <span className="font-semibold text-sm">{doc.title}</span>
                      </td>
                      <td className="py-4 text-[#716B67] text-sm uppercase">{doc.title.split('.').pop()}</td>
                      <td className="py-4 text-[#716B67] text-sm">{new Date(doc.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 text-right">
                        <span className={cn(
                            "px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest",
                            doc.status === 'indexed' ? "bg-green-100 text-green-700" : 
                            doc.status === 'failed' ? "bg-red-100 text-red-700" : 
                            "bg-orange-100 text-orange-700"
                        )}>
                            {doc.status === 'indexed' ? t('knowledge_base.assets.status.indexed') : 
                             doc.status === 'failed' ? t('knowledge_base.assets.status.failed') : 
                             t('knowledge_base.assets.status.syncing')}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button 
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 text-[#716B67] hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar Insights */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#cc4900] to-[#EC5B14] p-6 rounded-[16px] text-white shadow-lg shadow-[#EC5B14]/20 relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <h4 className="text-lg font-display font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#ffb599]" />
                {t('knowledge_base.sidebar.insight_title')}
              </h4>
              <p className="text-sm text-white/90 leading-relaxed mb-6 font-medium">
                {documents.length > 0 
                  ? t('knowledge_base.sidebar.insight_organized')
                  : t('knowledge_base.assets.status.empty')}
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
