import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertCircle,
  Activity, RefreshCw, Globe, Terminal, Save, X, ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';

interface MCPServer {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  transport: string;
  command: string | null;
  args: any;
  env: any;
  status: string;
  lastCheck: string | null;
  enabled: boolean;
}

interface MCPServerFormData {
  name: string;
  description: string;
  category: string;
  transport: string;
  command: string;
  args: string;
  env: string;
  enabled: boolean;
}

const emptyForm: MCPServerFormData = {
  name: '',
  description: '',
  category: 'pm',
  transport: 'stdio',
  command: '',
  args: '[]',
  env: '{}',
  enabled: true,
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  online: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: 'Online',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  offline: {
    icon: <XCircle className="w-4 h-4" />,
    label: 'Offline',
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  degraded: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: 'Degraded',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  unknown: {
    icon: <Activity className="w-4 h-4" />,
    label: 'Unknown',
    color: 'text-gray-400',
    bg: 'bg-gray-50',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  pm: 'Project Management',
  cicd: 'CI/CD',
  vc: 'Version Control',
  communication: 'Communication',
  data_science: 'Data Science',
};

export function MCPServerManager({ token, hideHeader = false }: { token?: string | null; hideHeader?: boolean }) {
  const { t } = useTranslation();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MCPServerFormData>(emptyForm);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const [syncSpinKey, setSyncSpinKey] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState('openclaw-hub');
  const [importUrl, setImportUrl] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchServers();
  }, [token]);

  const fetchServers = async () => {
    try {
      const data = await api.get<any>('/api/mcp-servers');
      setServers(data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch MCP servers:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAllHealth = async () => {
    if (checkingHealth) return;
    setCheckingHealth(true);
    setSpinKey((k) => k + 1);
    try {
      const data = await api.post<any>('/api/mcp-servers/health/all');
      if (data.success) {
        await fetchServers();
        showToast('Health check completed', 'success');
      } else {
        showToast('Health check failed', 'error');
      }
    } catch (err: any) {
      console.error('Health check failed:', err.message);
      showToast('Health check failed', 'error');
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleSyncFromConfig = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncSpinKey((k) => k + 1);
    try {
      const data = await api.post<any>('/api/mcp-servers/sync');
      if (data.success) {
        await fetchServers();
        showToast(data.data?.message || 'Sync completed', 'success');
      } else {
        showToast('Sync failed', 'error');
      }
    } catch (err: any) {
      console.error('Sync failed:', err.message);
      showToast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleImportSkill = async () => {
    try {
      const payload: any = { source: importSource };
      if (importSource === 'openclaw-hub') {
        payload.skillId = importUrl;
      } else if (importSource === 'git') {
        payload.url = importUrl;
      } else if (importSource === 'claude-code') {
        payload.skillPath = importUrl;
      }

      const data = await api.post<any>('/api/skills/import', payload);
      if (data.success) {
        showToast(data.data?.message || 'Import completed successfully', 'success');
        setShowImportModal(false);
        setImportUrl('');
      } else {
        showToast(data.error || 'Import failed', 'error');
      }
    } catch (err: any) {
      console.error('Import failed:', err.message);
      showToast('Import failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) return;
    try {
      await api.delete(`/api/mcp-servers/${id}`);
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error('Delete failed:', err.message);
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await api.put(`/api/mcp-servers/${id}`, { enabled });
      setServers((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    } catch (err: any) {
      console.error('Toggle failed:', err.message);
    }
  };

  const handleEdit = (server: MCPServer) => {
    setEditingId(server.id);
    setFormData({
      name: server.name,
      description: server.description || '',
      category: server.category || 'pm',
      transport: server.transport,
      command: server.command || '',
      args: JSON.stringify(server.args || [], null, 2),
      env: JSON.stringify(server.env || {}, null, 2),
      enabled: server.enabled,
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      ...formData,
      args: (() => { try { return JSON.parse(formData.args); } catch { return []; } })(),
      env: (() => { try { return JSON.parse(formData.env); } catch { return {}; } })(),
    };

    try {
      if (editingId) {
        const data = await api.put<any>(`/api/mcp-servers/${editingId}`, payload);
        setServers((prev) => prev.map((s) => (s.id === editingId ? data.data : s)));
      } else {
        const data = await api.post<any>('/api/mcp-servers', payload);
        setServers((prev) => [...prev, data.data]);
      }
      setShowForm(false);
    } catch (err: any) {
      console.error('Save failed:', err.message);
    }
  };

  const transportIcon = (transport: string) => {
    switch (transport) {
      case 'stdio': return <Terminal className="w-3.5 h-3.5" />;
      case 'sse': return <Globe className="w-3.5 h-3.5" />;
      default: return <Server className="w-3.5 h-3.5" />;
    }
  };

  if (loading) {
    return (
      <div className={cn("flex-1 overflow-y-auto bg-[#fcf9f8]", !hideHeader && "p-10")}>
        <div className="max-w-5xl mx-auto space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 rounded-2xl bg-[#F6F3F2] animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 overflow-y-auto bg-[#fcf9f8]", !hideHeader && "p-10")}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-3xl font-extrabold text-[#1C1B1B]">
                MCP Server <span className="text-[#EC5B14]">Management</span>
              </h2>
              <p className="text-[#716B67] mt-1">
                Manage and monitor your MCP server connections
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCheckAllHealth}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8E4E2] text-sm font-medium text-[#716B67] hover:text-[#1C1B1B] hover:border-[#EC5B14]/30 transition-all"
              >
                <motion.div
                  key={spinKey}
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                >
                  <RefreshCw className="w-4 h-4" />
                </motion.div>
                Check All
              </button>
              <button
                onClick={handleSyncFromConfig}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8E4E2] text-sm font-medium text-[#716B67] hover:text-[#1C1B1B] hover:border-[#EC5B14]/30 transition-all"
              >
                <motion.div
                  key={syncSpinKey}
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                >
                  <RefreshCw className="w-4 h-4" />
                </motion.div>
                Sync from Config
              </button>
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EC5B14] text-white text-sm font-bold hover:bg-[#d44f0e] transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Server
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8E4E2] text-sm font-medium text-[#716B67] hover:text-[#1C1B1B] hover:border-[#EC5B14]/30 transition-all"
              >
                <Globe className="w-4 h-4" />
                Import Skill
              </button>
            </div>
          </div>
        )}

        {hideHeader && (
          <div className="flex items-center justify-end gap-2 mb-6">
            <button
              onClick={handleCheckAllHealth}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8E4E2] text-xs font-bold text-[#716B67] hover:text-[#1C1B1B] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check All
            </button>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EC5B14] text-white text-xs font-bold hover:bg-[#d44f0e] transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Server
            </button>
          </div>
        )}

        {/* Server List */}
        <div className="space-y-3">
          <AnimatePresence>
            {servers.map((server) => {
              const statusCfg = STATUS_CONFIG[server.status] || STATUS_CONFIG.unknown;
              return (
                <motion.div
                  key={server.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "p-5 rounded-2xl border transition-all",
                    server.enabled
                      ? "bg-white border-[#E8E4E2]/60 hover:shadow-md"
                      : "bg-[#F6F3F2]/60 border-transparent opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2.5 rounded-xl", statusCfg.bg, statusCfg.color)}>
                        {statusCfg.icon}
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-[#1C1B1B]">{server.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-[#716B67] flex items-center gap-1">
                            {transportIcon(server.transport)}
                            {server.transport}
                          </span>
                          {server.category && (
                            <span className="text-xs text-[#A8A4A1] uppercase tracking-wider font-bold">
                              {CATEGORY_LABELS[server.category] || server.category}
                            </span>
                          )}
                          {server.command && (
                            <span className="text-xs text-[#A8A4A1] font-mono truncate max-w-[200px]">
                              {server.command}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status badge */}
                      <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold", statusCfg.bg, statusCfg.color)}>
                        {statusCfg.label}
                      </span>

                      {/* Enabled toggle */}
                      <button
                        onClick={() => handleToggleEnabled(server.id, !server.enabled)}
                        className={cn(
                          "relative w-10 h-5 rounded-full transition-colors",
                          server.enabled ? "bg-[#EC5B14]" : "bg-[#E8E4E2]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                          server.enabled ? "left-[22px]" : "left-0.5"
                        )} />
                      </button>

                      {/* Actions */}
                      <button
                        onClick={() => handleEdit(server)}
                        className="p-1.5 rounded-lg text-[#716B67] hover:bg-[#F6F3F2] hover:text-[#1C1B1B] transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(server.id)}
                        className="p-1.5 rounded-lg text-[#716B67] hover:bg-[#FEF2F2] hover:text-[#EF4444] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {server.description && (
                    <p className="text-sm text-[#716B67] mt-3 ml-[52px]">{server.description}</p>
                  )}
                  {server.lastCheck && (
                    <p className="text-xs text-[#A8A4A1] mt-1 ml-[52px]">
                      Last checked: {new Date(server.lastCheck).toLocaleString()}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {servers.length === 0 && (
            <div className="text-center py-16 text-[#716B67]">
              <Server className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No MCP servers configured</p>
              <p className="text-sm mt-1">Click "Add Server" or "Sync from Config" to get started</p>
            </div>
          )}
        </div>

        {/* Form Modal */}
        <AnimatePresence>
          {showForm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowForm(false)}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              >
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg pointer-events-auto max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-[#E8E4E2]">
                    <h3 className="font-display font-bold text-xl text-[#1C1B1B]">
                      {editingId ? 'Edit MCP Server' : 'Add MCP Server'}
                    </h3>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1C1B1B] mb-1">Name *</label>
                      <input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none"
                        placeholder="e.g., ZenTao Bug Management"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1C1B1B] mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none resize-none"
                        rows={2}
                        placeholder="Server description..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1C1B1B] mb-1">Category</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none bg-white"
                        >
                          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1C1B1B] mb-1">Transport</label>
                        <select
                          value={formData.transport}
                          onChange={(e) => setFormData({ ...formData, transport: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none bg-white"
                        >
                          <option value="stdio">stdio</option>
                          <option value="sse">sse</option>
                          <option value="http">http</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1C1B1B] mb-1">Command</label>
                      <input
                        value={formData.command}
                        onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm font-mono focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none"
                        placeholder="node"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1C1B1B] mb-1">Args (JSON)</label>
                      <textarea
                        value={formData.args}
                        onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm font-mono focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none resize-none"
                        rows={2}
                        placeholder='["../../../agent/mcp/mcp-zentao/dist/server.js"]'
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1C1B1B] mb-1">Env (JSON)</label>
                      <textarea
                        value={formData.env}
                        onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm font-mono focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none resize-none"
                        rows={3}
                        placeholder='{"ZENTAO_BASE_URL": "${ZENTAO_BASE_URL}"}'
                      />
                    </div>
                  </div>

                  <div className="p-6 border-t border-[#E8E4E2] flex justify-end gap-3">
                    <button
                      onClick={() => setShowForm(false)}
                      className="px-6 py-2 rounded-xl border border-[#E8E4E2] text-sm font-medium text-[#716B67] hover:bg-[#F6F3F2] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[#EC5B14] text-white text-sm font-bold hover:bg-[#d44f0e] transition-all"
                    >
                      <Save className="w-4 h-4" />
                      {editingId ? 'Update' : 'Create'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Import Skill Modal */}
        <AnimatePresence>
          {showImportModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowImportModal(false)}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              >
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto">
                  <div className="p-6 border-b border-[#E8E4E2]">
                    <h3 className="font-display font-bold text-xl text-[#1C1B1B]">
                      Import Skill
                    </h3>
                    <p className="text-sm text-[#716B67] mt-1">Import skills from external sources</p>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1C1B1B] mb-1">Source</label>
                      <select
                        value={importSource}
                        onChange={(e) => setImportSource(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none bg-white"
                      >
                        <option value="openclaw-hub">OpenClaw Hub</option>
                        <option value="claude-code">Claude Code Skill</option>
                        <option value="git">Git Repository</option>
                        <option value="local">Local File</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1C1B1B] mb-1">
                        {importSource === 'git' ? 'Repository URL' : importSource === 'local' ? 'SKILL.md Content' : importSource === 'openclaw-hub' ? 'Skill ID' : 'Local Path'}
                      </label>
                      {importSource === 'local' ? (
                        <textarea
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm font-mono focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none resize-none"
                          rows={4}
                          placeholder='---&#10;name: my-skill&#10;description: "My custom skill"&#10;---&#10;&#10;# Instructions...'
                        />
                      ) : (
                        <input
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-[#E8E4E2] text-sm focus:ring-2 focus:ring-[#EC5B14]/20 focus:border-[#EC5B14] outline-none"
                          placeholder={importSource === 'openclaw-hub' ? 'e.g., fix-bug' : importSource === 'git' ? 'https://github.com/user/skill-repo' : '/path/to/skill'}
                        />
                      )}
                    </div>
                  </div>

                  <div className="p-6 border-t border-[#E8E4E2] flex justify-end gap-3">
                    <button
                      onClick={() => setShowImportModal(false)}
                      className="px-6 py-2 rounded-xl border border-[#E8E4E2] text-sm font-medium text-[#716B67] hover:bg-[#F6F3F2] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImportSkill}
                      className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[#EC5B14] text-white text-sm font-bold hover:bg-[#d44f0e] transition-all"
                    >
                      <Globe className="w-4 h-4" />
                      Import
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={cn(
                "fixed top-6 right-6 z-[100] px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 text-sm font-medium",
                toast.type === 'success'
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              )}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
