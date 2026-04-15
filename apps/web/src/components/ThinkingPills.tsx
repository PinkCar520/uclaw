import { Search, Users, Sparkles, FileText, Database, Shield, Printer, GitBranch } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '../lib/utils';
import type { ThinkingStep } from '../lib/chat-utils';

export interface ThinkingPillsProps {
  steps: ThinkingStep[];
  variant?: 'pills' | 'compact';
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  search: Search,
  users: Users,
  sparkles: Sparkles,
  file: FileText,
  database: Database,
  shield: Shield,
  printer: Printer,
  git: GitBranch,
};

function getIconForLabel(label: string): React.ComponentType<{ className?: string }> | null {
  const lower = label.toLowerCase();
  if (lower.includes('check') || lower.includes('analyz') || lower.includes('read')) return Search;
  if (lower.includes('fetch') || lower.includes('member') || lower.includes('avail')) return Users;
  if (lower.includes('optim') || lower.includes('alloc')) return Sparkles;
  if (lower.includes('policy') || lower.includes('rule')) return FileText;
  if (lower.includes('verify') || lower.includes('balance') || lower.includes('record')) return Database;
  if (lower.includes('security') || lower.includes('oauth') || lower.includes('token')) return Shield;
  if (lower.includes('print') || lower.includes('printer')) return Printer;
  if (lower.includes('git') || lower.includes('compar')) return GitBranch;
  if (lower.includes('locat') || lower.includes('locating')) return Search;
  return null;
}

export function ThinkingPills({ steps, variant = 'pills' }: ThinkingPillsProps) {
  const activeSteps = useMemo(() => {
    // 只显示 done 和 active 的步骤
    return steps.filter(s => s.status !== 'pending');
  }, [steps]);

  if (activeSteps.length === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {activeSteps.map((step, i) => {
          const Icon = step.icon ? iconMap[step.icon] : getIconForLabel(step.label);
          return (
            <span
              key={i}
              className={cn(
                'thinking-pill',
                step.status === 'active' ? 'thinking-pill--active' : 'thinking-pill--done'
              )}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {step.label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {activeSteps.map((step, i) => {
        const Icon = step.icon ? iconMap[step.icon] : getIconForLabel(step.label);
        return (
          <span
            key={i}
            className={cn(
              'thinking-pill',
              step.status === 'active' ? 'thinking-pill--active' : 'thinking-pill--done'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {step.label}
          </span>
        );
      })}
    </div>
  );
}
