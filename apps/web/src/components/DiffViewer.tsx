import { Code2, GitPullRequest, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DiffLine {
  lineNumber: number;
  type: 'context' | 'addition' | 'deletion';
  content: string;
}

export interface DiffViewerProps {
  fileName: string;
  language?: string;
  draft?: boolean;
  diff: DiffLine[];
  onApply?: () => void;
}

export function DiffViewer({
  fileName,
  language = 'ts',
  draft = true,
  diff,
  onApply,
}: DiffViewerProps) {
  return (
    <div className="bg-[#1C1B1B] rounded-[20px] overflow-hidden mt-4 max-w-[560px] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-[#716B67]" />
          <span className="text-[12px] font-mono text-[#716B67]">
            {fileName}
            {language && <span className="text-[#716B67]/60"> ({language})</span>}
          </span>
        </div>
        {draft && (
          <span className="text-[9px] font-bold text-[#716B67] uppercase tracking-[0.15em] bg-white/10 px-2.5 py-1 rounded-md">
            Draft
          </span>
        )}
      </div>

      {/* Diff Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] font-mono leading-[1.6]">
          <tbody>
            {diff.map((line, i) => (
              <tr
                key={i}
                className={cn(
                  line.type === 'deletion' && 'bg-[#F43F5E]/10',
                  line.type === 'addition' && 'bg-[#10B981]/10',
                  line.type === 'context' && 'hover:bg-white/5'
                )}
              >
                <td className="w-10 text-right pr-3 text-[#716B67]/50 select-none text-[11px]">
                  {line.lineNumber}
                </td>
                <td className="w-5 text-center select-none text-[11px] pr-2">
                  {line.type === 'deletion' && <span className="text-[#F43F5E]">−</span>}
                  {line.type === 'addition' && <span className="text-[#10B981]">+</span>}
                  {line.type === 'context' && <span className="text-transparent"> </span>}
                </td>
                <td className={cn(
                  'pr-4',
                  line.type === 'deletion' && 'text-[#F43F5E] line-through decoration-[#F43F5E]/50',
                  line.type === 'addition' && 'text-[#10B981]',
                  line.type === 'context' && 'text-[#716B67]'
                )}>
                  {line.content}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTA Button */}
      <div className="px-6 py-5 border-t border-white/10">
        <button
          onClick={onApply}
          className="w-full bg-gradient-to-br from-[#a33800] to-[#cc4900] text-white font-bold text-[14px] py-3.5 px-8 rounded-[16px] border-0 shadow-[0_8px_24px_rgba(163,56,0,0.35)] hover:shadow-[0_12px_32px_rgba(163,56,0,0.45)] hover:from-[#c24200] hover:to-[#e65200] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
        >
          <GitPullRequest className="w-4 h-4" />
          Apply Fix to GitLab
        </button>
      </div>
    </div>
  );
}
