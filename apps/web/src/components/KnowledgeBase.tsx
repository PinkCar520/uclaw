import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, Cloud, UploadCloud, ArrowRight,
  FileText, Table as TableIcon, Webhook,
  Sparkles, Trash2, RefreshCw, Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';

export function KnowledgeBase() {
  const { t } = useTranslation();
  
  // Logic State
  const [documents, setDocuments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ activeSources: 124, totalChunks: 0, dataIndexedMb: '4.2' });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [docsRes, statsRes] = await Promise.all([
        api.get<any>('/api/rag/documents'),
        api.get<any>('/api/rag/stats')
      ]);
      if (docsRes.success) setDocuments(docsRes.data);
      if (statsRes.success) {
        setStats({
          activeSources: statsRes.data.activeSources || 0,
          dataIndexedMb: statsRes.data.dataIndexedMb || '0.00'
        });
      }
    } catch (err) {
      console.error('Failed to fetch RAG data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post<any>('/api/upload/rag', formData);
      if (res.success) {
        await fetchData();
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + (err as any).message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

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

  return (
    <div className="flex-1 overflow-y-auto bg-[#FCF9F8] font-sans text-[#1C1B1B] p-10 relative pb-32">
      <div className="max-w-7xl mx-auto space-y-12 w-full">
        
        {/* Hero / Header Section */}
        <section className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-display font-extrabold tracking-tight text-[#1C1B1B] mb-2">{t('knowledge_base.title')}</h2>
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
                <h3 className="text-3xl font-display font-bold">{stats.activeSources}</h3>
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
                    <p className="font-bold text-[#EC5B14]">Indexing...</p>
                </div>
            )}
            <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                onChange={handleFileUpload}
                accept=".txt,.md,.json,.js,.ts,.py"
            />
            <div className="w-16 h-16 rounded-full bg-[#F6F3F2] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <UploadCloud className="text-[#EC5B14] w-8 h-8" />
            </div>
            <h4 className="text-xl font-display font-bold mb-2">{t('knowledge_base.ingest.title')}</h4>
            <p className="text-[#716B67] text-center max-w-sm mb-6">{t('knowledge_base.ingest.desc')}</p>
            <button className="bg-[#1C1B1B] text-white px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md hover:bg-[#1C1B1B]/80 transition-colors">{t('knowledge_base.ingest.button')}</button>
          </div>
        </section>

        {/* Recent Projects Section (RESTORED) */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-display font-bold tracking-tight">{t('knowledge_base.projects.title')}</h3>
            <button className="text-[#EC5B14] font-semibold text-sm flex items-center gap-1 hover:underline">
              {t('knowledge_base.projects.view_all')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Project Card 1 */}
            <div className="bg-white rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-transparent hover:border-[#E8E4E2] overflow-hidden group transition-all">
              <div className="h-32 bg-[#F6F3F2] relative overflow-hidden">
                <img 
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 mix-blend-multiply" 
                  src="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800" 
                  alt="Legal Review" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent"></div>
              </div>
              <div className="p-6 pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-0.5 bg-[#EC5B14]/10 text-[#EC5B14] text-[10px] font-bold uppercase tracking-widest rounded-md">{t('knowledge_base.projects.tags.legal')}</span>
                  <span className="text-[10px] text-[#716B67] font-medium">{t('knowledge_base.projects.updated', { time: '2h' })}</span>
                </div>
                <h4 className="text-lg font-display font-bold mb-1">Q3 Legal Review</h4>
                <p className="text-[#716B67] text-sm mb-4 line-clamp-2">Quarterly audit of all internal contracts and compliance documentation.</p>
                <div className="flex -space-x-2">
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="user" />
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jack" alt="user" />
                  <div className="w-6 h-6 rounded-full bg-[#1C1B1B] text-white border-2 border-white flex items-center justify-center text-[8px] font-bold">+4</div>
                </div>
              </div>
            </div>

            {/* Project Card 2 */}
            <div className="bg-white rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-transparent hover:border-[#E8E4E2] overflow-hidden group transition-all">
              <div className="h-32 bg-[#F6F3F2] relative overflow-hidden">
                <img 
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 mix-blend-multiply" 
                  src="https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&q=80&w=800" 
                  alt="Supply Chain" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent"></div>
              </div>
              <div className="p-6 pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-md">{t('knowledge_base.projects.tags.operations')}</span>
                  <span className="text-[10px] text-[#716B67] font-medium">{t('knowledge_base.projects.updated', { time: '5h' })}</span>
                </div>
                <h4 className="text-lg font-display font-bold mb-1">Supply Chain v4</h4>
                <p className="text-[#716B67] text-sm mb-4 line-clamp-2">Optimization analysis for global logistics and warehouse management.</p>
                <div className="flex -space-x-2">
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="user" />
                  <div className="w-6 h-6 rounded-full bg-[#1C1B1B] text-white border-2 border-white flex items-center justify-center text-[8px] font-bold">+2</div>
                </div>
              </div>
            </div>

            {/* Project Card 3 */}
            <div className="bg-white rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-transparent hover:border-[#E8E4E2] overflow-hidden group transition-all">
              <div className="h-32 bg-[#F6F3F2] relative overflow-hidden">
                <img 
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 mix-blend-multiply" 
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=800" 
                  alt="Policy Training" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent"></div>
              </div>
              <div className="p-6 pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest rounded-md">{t('knowledge_base.projects.tags.hr')}</span>
                  <span className="text-[10px] text-[#716B67] font-medium">{t('knowledge_base.projects.updated_1d')}</span>
                </div>
                <h4 className="text-lg font-display font-bold mb-1">Policy Training</h4>
                <p className="text-[#716B67] text-sm mb-4 line-clamp-2">Updated internal employee conduct guidelines and automated training modules.</p>
                <div className="flex -space-x-2">
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="user" />
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alice" alt="user" />
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Robert" alt="user" />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Knowledge Assets Table & Sidebar Segment (RESTORED) */}
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
                    <th className="pb-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6F3F2]">
                  
                  {documents.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#716B67] italic font-medium uppercase tracking-tight">
                        {t('knowledge_base.assets.status.empty') || 'No documents indexed yet.'}
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
                            doc.status === 'indexed' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        )}>
                            {doc.status === 'indexed' ? t('knowledge_base.assets.status.indexed') : t('knowledge_base.assets.status.syncing')}
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

          {/* AI Insights Sidebar (RESTORED) */}
          <div className="space-y-6">
            
            <div className="bg-gradient-to-br from-[#cc4900] to-[#EC5B14] p-6 rounded-[16px] text-white shadow-lg shadow-[#EC5B14]/20 relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <h4 className="text-lg font-display font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#ffb599]" />
                {t('knowledge_base.sidebar.insight_title')}
              </h4>
              <p className="text-sm text-white/90 leading-relaxed mb-6 font-medium">
                {t('knowledge_base.sidebar.insight_desc')}
              </p>
              <button className="text-[11px] uppercase tracking-widest font-black bg-white text-[#cc4900] px-4 py-2 rounded-lg hover:bg-[#F6F3F2] shadow-sm transition-colors w-full">
                {t('knowledge_base.sidebar.clean_button')}
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <h4 className="text-[11px] font-bold text-[#716B67] uppercase tracking-widest mb-4">{t('knowledge_base.sidebar.suggested')}</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 bg-[#ffdbce] text-[#783112] rounded-full text-[11px] font-bold cursor-pointer hover:bg-[#EC5B14] hover:text-white transition-colors">{t('knowledge_base.sidebar.chips.tax')}</span>
                <span className="px-3 py-1.5 bg-[#ffdbce] text-[#783112] rounded-full text-[11px] font-bold cursor-pointer hover:bg-[#EC5B14] hover:text-white transition-colors">{t('knowledge_base.sidebar.chips.hr')}</span>
                <span className="px-3 py-1.5 bg-[#ffdbce] text-[#783112] rounded-full text-[11px] font-bold cursor-pointer hover:bg-[#EC5B14] hover:text-white transition-colors">{t('knowledge_base.sidebar.chips.gdpr')}</span>
              </div>
            </div>

          </div>

        </section>

      </div>
    </div>
  );
}
