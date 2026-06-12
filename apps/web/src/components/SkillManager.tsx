import React, { useState, useEffect } from 'react';
import { api } from '../lib/api-client';
import { Plus, Save, Trash2, Cpu, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { SkillSandbox } from './SkillSandbox';

export function SkillManager({ token }: { token?: string | null }) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<any[]>([]);
  const [activeSkill, setActiveSkill] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const res = await api.get<any>('/api/skills');
      if (res.data) setSkills(res.data);
    } catch (err) {
      console.error('Failed to fetch skills', err);
    }
  };

  const handleCreate = () => {
    setActiveSkill({
      name: 'New Skill',
      description: '',
      trigger_keywords: [],
      body: '# Context\n\nYou are an expert in...',
      scope: 'team',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!activeSkill) return;
    try {
      if (activeSkill.id) {
        // Update
        await api.put(`/api/skills/${activeSkill.id}`, activeSkill);
      } else {
        // Create
        await api.post('/api/skills', activeSkill);
      }
      await fetchSkills();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save skill', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this skill?')) return;
    try {
      await api.delete(`/api/skills/${id}`);
      if (activeSkill?.id === id) {
        setActiveSkill(null);
        setIsEditing(false);
      }
      await fetchSkills();
    } catch (err) {
      console.error('Failed to delete skill', err);
    }
  };

  return (
    <div className="flex w-full h-full bg-[#fcf9f8] font-sans">
      {/* Left Sidebar: List of Skills */}
      <div className="w-64 border-r border-[#E8E4E2] bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-[#E8E4E2] flex items-center justify-between">
          <h2 className="font-bold text-[#1C1B1B] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#EC5B14]" />
            Skill Studio
          </h2>
          <button 
            onClick={handleCreate}
            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {skills.map(s => (
            <div 
              key={s.id}
              onClick={() => { setActiveSkill(s); setIsEditing(true); }}
              className={cn(
                "p-2 rounded-lg cursor-pointer text-sm font-medium transition-colors group flex items-center justify-between",
                activeSkill?.id === s.id ? "bg-[#EC5B14]/10 text-[#EC5B14]" : "text-[#716B67] hover:bg-slate-100"
              )}
            >
              <span className="truncate">{s.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area: Editor + Sandbox */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        {isEditing && activeSkill ? (
          <>
            {/* Editor */}
            <div className="flex-1 flex flex-col p-6 overflow-y-auto border-r border-[#E8E4E2]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[#1C1B1B]">Edit Skill</h3>
                <button 
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-[#EC5B14] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#d04a0d] transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#716B67] mb-1">Name</label>
                  <input 
                    type="text" 
                    value={activeSkill.name}
                    onChange={e => setActiveSkill({...activeSkill, name: e.target.value})}
                    className="w-full border border-[#E8E4E2] rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#716B67] mb-1">Description (L1 Metadata)</label>
                  <textarea 
                    value={activeSkill.description}
                    onChange={e => setActiveSkill({...activeSkill, description: e.target.value})}
                    className="w-full border border-[#E8E4E2] rounded-lg p-2 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#716B67] mb-1">Trigger Keywords (comma separated)</label>
                  <input 
                    type="text" 
                    value={(activeSkill.trigger_keywords || []).join(', ')}
                    onChange={e => setActiveSkill({...activeSkill, trigger_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    className="w-full border border-[#E8E4E2] rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30"
                  />
                </div>
                <div className="flex-1 flex flex-col min-h-[300px]">
                  <label className="block text-xs font-bold text-[#716B67] mb-1">Body (Markdown Prompt)</label>
                  <textarea 
                    value={activeSkill.body}
                    onChange={e => setActiveSkill({...activeSkill, body: e.target.value})}
                    className="flex-1 w-full border border-[#E8E4E2] rounded-lg p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30 bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Sandbox Panel */}
            <div className="w-[400px] shrink-0 bg-[#F6F3F2] flex flex-col">
              <SkillSandbox activeSkill={activeSkill} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
            <Cpu className="w-12 h-12 opacity-20" />
            <p>Select a skill or create a new one to start editing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
