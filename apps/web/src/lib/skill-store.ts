import { create } from 'zustand';
import { api } from './api-client';

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  trigger_keywords: string[];
}

interface SkillStore {
  catalog: SkillMeta[];
  activeSkills: SkillMeta[];
  pickerOpen: boolean;
  pickerQuery: string;

  openPicker: () => void;
  closePicker: () => void;
  setPickerQuery: (query: string) => void;
  selectSkill: (skill: SkillMeta) => void;
  removeSkill: (id: string) => void;
  clearActiveSkills: () => void;
  refreshCatalog: () => Promise<void>;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  catalog: [
    { id: 'mock-1', name: 'Code Review', description: '自动审查代码质量，给出改进建议', trigger_keywords: ['code', 'review', '代码'] },
    { id: 'mock-2', name: 'Document Writer', description: '根据需求生成技术文档', trigger_keywords: ['doc', 'write', '文档'] },
    { id: 'mock-3', name: 'SQL Generator', description: '自然语言转 SQL 查询语句', trigger_keywords: ['sql', 'query', '查询'] },
    { id: 'mock-4', name: 'Bug Analyzer', description: '分析错误日志，定位 Bug 根因', trigger_keywords: ['bug', 'error', '错误'] },
    { id: 'mock-5', name: 'Test Generator', description: '自动生成单元测试用例', trigger_keywords: ['test', 'unit', '测试'] },
  ],
  activeSkills: [],
  pickerOpen: false,
  pickerQuery: '',

  openPicker: () => set({ pickerOpen: true, pickerQuery: '' }),
  closePicker: () => set({ pickerOpen: false }),
  setPickerQuery: (query: string) => set({ pickerQuery: query }),

  selectSkill: (skill: SkillMeta) => set((state) => {
    // Prevent duplicates
    if (state.activeSkills.find(s => s.id === skill.id)) {
      return { pickerOpen: false };
    }
    return {
      activeSkills: [...state.activeSkills, skill],
      pickerOpen: false
    };
  }),

  removeSkill: (id: string) => set((state) => ({
    activeSkills: state.activeSkills.filter(s => s.id !== id)
  })),

  clearActiveSkills: () => set({ activeSkills: [] }),

  refreshCatalog: async () => {
    try {
      // In a real app, you might want to hit a /catalog endpoint to just get L1 metadata.
      // Here we assume /api/skills returns the list.
      const res = await api.get<any>('/api/skills');
      if (res.data) {
        set({ catalog: res.data });
      }
    } catch (err) {
      console.error('Failed to fetch skill catalog', err);
    }
  }
}));
