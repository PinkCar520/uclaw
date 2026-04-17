import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Shield, Plus, Trash2, Save, RotateCcw, Check,
  CheckCircle2, XCircle, AlertCircle, Unlock,
  Settings2, Info, Play, Ban, HelpCircle, Eye
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api-client';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type PermissionAction = 'allow' | 'deny' | 'ask';
type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

interface PermissionRule {
  action: PermissionAction;
  pattern: string;
  comment?: string;
}

interface PermissionSettings {
  mode: PermissionMode;
  maxMcpOutputTokens: number;
  rules: PermissionRule[];
  allow: string[];
  deny: string[];
  ask: string[];
}

const DEFAULT_SETTINGS: PermissionSettings = {
  mode: 'default',
  maxMcpOutputTokens: 25000,
  rules: [],
  allow: [],
  deny: [],
  ask: [],
};

const ACTION_COLORS: Record<PermissionAction, { bg: string; text: string; icon: React.ReactNode }> = {
  allow: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  deny: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    icon: <Ban className="w-3.5 h-3.5" />,
  },
  ask: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export function PermissionManager({ token }: { token?: string | null }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PermissionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<number | null>(null);
  const [newRule, setNewRule] = useState<PermissionRule>({ action: 'ask', pattern: '', comment: '' });
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [testTool, setTestTool] = useState('');
  const [testResult, setTestResult] = useState<PermissionAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<any>('/api/permissions/settings');
      setSettings({
        mode: data.mode || 'default',
        maxMcpOutputTokens: data.maxMcpOutputTokens || 25000,
        rules: data.rules || [],
        allow: data.allow || [],
        deny: data.deny || [],
        ask: data.ask || [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/permissions/settings', settings);
      await fetchSettings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const testEvaluate = async () => {
    if (!testTool.trim()) return;
    try {
      const data = await api.get<any>(`/api/permissions/evaluate?toolName=${encodeURIComponent(testTool)}`);
      setTestResult(data.action);
    } catch {
      setTestResult(null);
    }
  };

  const addRule = () => {
    if (!newRule.pattern.trim()) return;
    setSettings({ ...settings, rules: [...settings.rules, { ...newRule }] });
    setNewRule({ action: 'ask', pattern: '', comment: '' });
    setShowNewRuleForm(false);
  };

  const removeRule = (index: number) => {
    setSettings({ ...settings, rules: settings.rules.filter((_, i) => i !== index) });
  };

  const updateRule = (index: number, updates: Partial<PermissionRule>) => {
    setSettings({
      ...settings,
      rules: settings.rules.map((r, i) => (i === index ? { ...r, ...updates } : r)),
    });
  };

  const addPatternToCategory = (category: 'allow' | 'deny' | 'ask', pattern: string) => {
    if (!pattern.trim()) return;
    setSettings({ ...settings, [category]: [...(settings[category] as string[]), pattern] });
  };

  const removePatternFromCategory = (category: 'allow' | 'deny' | 'ask', index: number) => {
    setSettings({
      ...settings,
      [category]: (settings[category] as string[]).filter((_, i) => i !== index),
    });
  };

  // Mode config (localized)
  const MODE_CONFIG: Record<PermissionMode, { label: string; icon: React.ReactNode; color: string; description: string }> = {
    default: {
      label: t('permissions.mode.default'),
      icon: <HelpCircle className="w-4 h-4" />,
      color: 'text-blue-600',
      description: t('permissions.mode.default_desc'),
    },
    acceptEdits: {
      label: t('permissions.mode.acceptEdits'),
      icon: <Unlock className="w-4 h-4" />,
      color: 'text-green-600',
      description: t('permissions.mode.acceptEdits_desc'),
    },
    plan: {
      label: t('permissions.mode.plan'),
      icon: <Eye className="w-4 h-4" />,
      color: 'text-amber-600',
      description: t('permissions.mode.plan_desc'),
    },
    bypassPermissions: {
      label: t('permissions.mode.bypass'),
      icon: <Play className="w-4 h-4" />,
      color: 'text-purple-600',
      description: t('permissions.mode.bypass_desc'),
    },
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#716B67]">{t('permissions.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-[#1C1B1B] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#EC5B14]" />
            {t('permissions.title')}
          </h3>
          <p className="text-[#716B67] text-sm mt-1">
            {t('permissions.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSettings}
            className="px-3 py-2 text-sm font-semibold text-[#716B67] bg-white border border-[#E8E4E2]/50 rounded-xl hover:bg-[#F6F3F2] transition-all"
            title={t('permissions.refresh')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold text-white bg-[#EC5B14] rounded-xl hover:bg-[#D84E0F] transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? t('permissions.saving') : t('permissions.save')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Mode Selection */}
      <section className="bg-white border border-[#E8E4E2]/50 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-4 h-4 text-[#EC5B14]" />
          <h4 className="font-bold text-[#1C1B1B]">{t('permissions.mode.title')}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(['default', 'acceptEdits', 'plan', 'bypassPermissions'] as PermissionMode[]).map((mode) => {
            const config = MODE_CONFIG[mode];
            const isActive = settings.mode === mode;
            return (
              <button
                key={mode}
                onClick={() => setSettings({ ...settings, mode })}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all',
                  isActive
                    ? 'border-[#EC5B14] bg-[#FFF5F0] shadow-sm'
                    : 'border-[#E8E4E2]/50 bg-white hover:border-[#EC5B14]/30'
                )}
              >
                <div className={cn('flex items-center gap-2 mb-1', config.color)}>
                  {config.icon}
                  <span className="font-bold text-sm">{config.label}</span>
                </div>
                <p className="text-xs text-[#716B67]">{config.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Max MCP Output Tokens */}
      <section className="bg-white border border-[#E8E4E2]/50 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-[#EC5B14]" />
          <h4 className="font-bold text-[#1C1B1B]">{t('permissions.token_limit.title')}</h4>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={settings.maxMcpOutputTokens}
            onChange={(e) => setSettings({ ...settings, maxMcpOutputTokens: Number(e.target.value) })}
            className="w-32 px-3 py-2 border border-[#E8E4E2]/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EC5B14]/30"
          />
          <span className="text-xs text-[#716B67]">
            {t('permissions.token_limit.hint')}
          </span>
        </div>
      </section>

      {/* Category Patterns (allow/deny/ask shorthand) */}
      <section className="bg-white border border-[#E8E4E2]/50 rounded-2xl p-6 space-y-4">
        <h4 className="font-bold text-[#1C1B1B]">{t('permissions.patterns.title')}</h4>
        <p className="text-xs text-[#716B67]">{t('permissions.patterns.hint')}</p>

        {(['allow', 'deny', 'ask'] as const).map((category) => (
          <CategoryPatternList
            key={category}
            category={category}
            patterns={settings[category] as string[]}
            onAdd={(p) => addPatternToCategory(category, p)}
            onRemove={(i) => removePatternFromCategory(category, i)}
          />
        ))}
      </section>

      {/* Detailed Rules */}
      <section className="bg-white border border-[#E8E4E2]/50 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-[#1C1B1B]">{t('permissions.rules.title')}</h4>
            <p className="text-xs text-[#716B67]">{t('permissions.rules.hint')}</p>
          </div>
          <button
            onClick={() => setShowNewRuleForm(true)}
            className="px-3 py-1.5 text-sm font-semibold text-[#EC5B14] border border-[#EC5B14]/30 rounded-lg hover:bg-[#FFF5F0] transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('permissions.rules.add')}
          </button>
        </div>

        {showNewRuleForm && (
          <div className="flex gap-2 items-end p-4 bg-[#F6F3F2] rounded-xl">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-[#716B67]">{t('permissions.rules.action')}</label>
              <select
                value={newRule.action}
                onChange={(e) => setNewRule({ ...newRule, action: e.target.value as PermissionAction })}
                className="w-full px-3 py-2 border border-[#E8E4E2]/50 rounded-lg text-sm"
              >
                <option value="allow">{t('permissions.actions.allow')}</option>
                <option value="deny">{t('permissions.actions.deny')}</option>
                <option value="ask">{t('permissions.actions.ask')}</option>
              </select>
            </div>
            <div className="flex-[2] space-y-1">
              <label className="text-xs font-semibold text-[#716B67]">{t('permissions.rules.pattern')}</label>
              <input
                value={newRule.pattern}
                onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                placeholder={t('permissions.rules.pattern_placeholder')}
                className="w-full px-3 py-2 border border-[#E8E4E2]/50 rounded-lg text-sm font-mono"
              />
            </div>
            <div className="flex-[2] space-y-1">
              <label className="text-xs font-semibold text-[#716B67]">{t('permissions.rules.comment')}</label>
              <input
                value={newRule.comment || ''}
                onChange={(e) => setNewRule({ ...newRule, comment: e.target.value })}
                placeholder={t('permissions.rules.comment_placeholder')}
                className="w-full px-3 py-2 border border-[#E8E4E2]/50 rounded-lg text-sm"
              />
            </div>
            <button onClick={addRule} className="px-3 py-2 bg-[#EC5B14] text-white rounded-lg text-sm font-bold">
              {t('permissions.actions.allow')}
            </button>
            <button onClick={() => setShowNewRuleForm(false)} className="px-3 py-2 text-[#716B67] text-sm">
              {t('permissions.rules.cancel')}
            </button>
          </div>
        )}

        {settings.rules.length === 0 && !showNewRuleForm && (
          <div className="text-center py-8 text-[#716B67] text-sm">{t('permissions.rules.empty')}</div>
        )}

        <div className="space-y-2">
          {settings.rules.map((rule, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-[#F6F3F2] rounded-xl">
              {editingRule === index ? (
                <>
                  <select
                    value={rule.action}
                    onChange={(e) => updateRule(index, { action: e.target.value as PermissionAction })}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="allow">{t('permissions.actions.allow')}</option>
                    <option value="deny">{t('permissions.actions.deny')}</option>
                    <option value="ask">{t('permissions.actions.ask')}</option>
                  </select>
                  <input
                    value={rule.pattern}
                    onChange={(e) => updateRule(index, { pattern: e.target.value })}
                    className="flex-1 px-2 py-1 border rounded text-sm font-mono"
                  />
                  <button
                    onClick={() => setEditingRule(null)}
                    className="px-2 py-1 bg-green-600 text-white rounded text-xs font-bold flex items-center justify-center"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  <span className={cn('px-2 py-1 rounded text-xs font-bold flex items-center gap-1', ACTION_COLORS[rule.action].bg, ACTION_COLORS[rule.action].text)}>
                    {ACTION_COLORS[rule.action].icon}
                    {t(`permissions.actions.${rule.action}`).toUpperCase()}
                  </span>
                  <code className="flex-1 text-sm font-mono text-[#1C1B1B]">{rule.pattern}</code>
                  {rule.comment && <span className="text-xs text-[#716B67] max-w-[200px] truncate">{rule.comment}</span>}
                  <button onClick={() => setEditingRule(index)} className="text-[#716B67] hover:text-[#EC5B14]">
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeRule(index)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Test Tool Evaluation */}
      <section className="bg-white border border-[#E8E4E2]/50 rounded-2xl p-6 space-y-4">
        <h4 className="font-bold text-[#1C1B1B] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#EC5B14]" />
          {t('permissions.test.title')}
        </h4>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-semibold text-[#716B67]">{t('permissions.test.label')}</label>
            <input
              value={testTool}
              onChange={(e) => { setTestTool(e.target.value); setTestResult(null); }}
              onKeyDown={(e) => e.key === 'Enter' && testEvaluate()}
              placeholder={t('permissions.test.placeholder')}
              className="w-full px-3 py-2 border border-[#E8E4E2]/50 rounded-lg text-sm font-mono"
            />
          </div>
          <button
            onClick={testEvaluate}
            className="px-4 py-2 bg-[#EC5B14] text-white rounded-lg text-sm font-bold hover:bg-[#D84E0F] transition-all"
          >
            {t('permissions.test.evaluate')}
          </button>
        </div>

        {testResult && (
          <div className={cn(
            'p-4 rounded-xl flex items-center gap-3',
            testResult === 'allow' && 'bg-green-50 text-green-700',
            testResult === 'deny' && 'bg-red-50 text-red-700',
            testResult === 'ask' && 'bg-amber-50 text-amber-700',
          )}>
            {testResult === 'allow' && <CheckCircle2 className="w-5 h-5" />}
            {testResult === 'deny' && <XCircle className="w-5 h-5" />}
            {testResult === 'ask' && <AlertCircle className="w-5 h-5" />}
            <span className="font-bold">
              {t('permissions.test.result', { tool: testTool, action: t(`permissions.actions.${testResult}`).toUpperCase() })}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-Component: Category Pattern List
// ──────────────────────────────────────────────

function CategoryPatternList({
  category,
  patterns,
  onAdd,
  onRemove,
}: {
  category: 'allow' | 'deny' | 'ask';
  patterns: string[];
  onAdd: (pattern: string) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const config = ACTION_COLORS[category];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn('px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1', config.bg, config.text)}>
          {config.icon}
          {t(`permissions.actions.${category}`).toUpperCase()}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              onAdd(input.trim());
              setInput('');
            }
          }}
          placeholder={t('permissions.patterns.placeholder')}
          className="flex-1 px-3 py-2 border border-[#E8E4E2]/50 rounded-lg text-sm font-mono"
        />
        <button
          onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput(''); } }}
          className="px-3 py-2 text-sm font-bold text-[#EC5B14] border border-[#EC5B14]/30 rounded-lg hover:bg-[#FFF5F0]"
        >
          {t('permissions.patterns.add')}
        </button>
      </div>
      {patterns.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {patterns.map((p, i) => (
            <span
              key={i}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5',
                config.bg, config.text
              )}
            >
              {p}
              <button onClick={() => onRemove(i)} className="hover:opacity-70">
                <XCircle className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
