import React, { useMemo } from 'react';
import { Code2, GitPullRequest, Maximize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useShiki } from '../lib/shiki';
import { CopyCodeButton } from './chat/MarkdownConfig';

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
  onExtract?: (data: { title: string; content: string; language: string }) => void;
}

/**
 * Advanced Diff Viewer component powered by Shiki.
 */
export function DiffViewer({
  fileName,
  language = 'typescript',
  draft = true,
  diff,
  onApply,
  onExtract,
}: DiffViewerProps) {
  const { highlighter, isReady } = useShiki();

  const shikiHtmlLines = useMemo(() => {
    if (!isReady || !highlighter) return diff.map(l => ({ ...l, html: l.content }));
    
    return diff.map(line => {
      try {
        // Highlight each line individually to maintain control over row rendering
        const html = highlighter.codeToHtml(line.content, {
          lang: language,
          theme: 'github-dark'
        });
        // Extract content inside <pre><code>...</code></pre>
        const match = /<code[^>]*>([\s\S]*)<\/code>/.exec(html);
        return { ...line, html: match ? match[1] : line.content };
      } catch (e) {
        return { ...line, html: line.content };
      }
    });
  }, [isReady, highlighter, diff, language]);

  return (
    <div className="bg-[#0d0d0d] rounded-[24px] overflow-hidden mt-6 mb-8 w-full border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.4)] not-prose">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1b1e]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-white/5 text-slate-400">
            <Code2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-slate-200">{fileName}</span>
            <span className="text-[13px] text-slate-500 font-medium">(Suggested Fix)</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {draft && (
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
              Draft
            </span>
          )}
          {onExtract && (
            <button
              onClick={() => onExtract({ title: fileName, content: diff.map(l => (l.type === 'addition' ? '+' : l.type === 'deletion' ? '-' : ' ') + l.content).join('\n'), language: 'diff' })}
              className="p-1.5 rounded-md transition-all duration-200 hover:bg-white/10 text-slate-400 hover:text-slate-200"
              title="Open in sidebar"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Diff Content */}
      <div className="py-4 font-mono text-[13px] leading-[1.6] overflow-x-auto overflow-y-hidden">
        <table className="w-full border-separate border-spacing-0">
          <tbody>
            {shikiHtmlLines.map((line, idx) => {
              const isAddition = line.type === 'addition';
              const isDeletion = line.type === 'deletion';
              
              return (
                <tr 
                  key={idx}
                  className={cn(
                    "group relative",
                    isAddition && "bg-emerald-500/10",
                    isDeletion && "bg-rose-500/10 text-rose-200/60"
                  )}
                >
                  {/* Line Number */}
                  <td className="w-12 text-right pr-4 py-0.5 text-slate-600 select-none opacity-50 tabular-nums">
                    {line.lineNumber}
                  </td>
                  
                  {/* Diff Indicator Bar */}
                  <td className="relative w-[4px] p-0 min-w-[4px]">
                    {(isAddition || isDeletion) && (
                      <div className={cn(
                        "absolute inset-y-0 left-0 w-full",
                        isAddition ? "bg-emerald-500" : "bg-rose-500/60"
                      )} />
                    )}
                  </td>
                  
                  {/* Code Content */}
                  <td className={cn(
                    "pl-4 pr-6 py-0.5 whitespace-pre",
                    isAddition && "text-emerald-50/90 font-medium",
                    isDeletion && "text-rose-200/50 line-through decoration-rose-500/30",
                    !isAddition && !isDeletion && "text-slate-300"
                  )}>
                    <span 
                      className="inline-block"
                      dangerouslySetInnerHTML={{ 
                        __html: (isAddition ? '+ ' : isDeletion ? '- ' : '  ') + line.html 
                      }} 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer / Apply Button */}
      {onApply && (
        <div className="px-6 py-8 flex justify-center items-center bg-gradient-to-t from-black/20 to-transparent border-t border-white/5">
          <button
            onClick={onApply}
            className="group relative bg-[#EC5B14] hover:bg-[#ff6a1a] text-white font-bold text-[15px] px-10 py-3.5 rounded-[20px] shadow-[0_12px_32px_rgba(236,91,20,0.35)] hover:shadow-[0_16px_40px_rgba(236,91,20,0.45)] active:scale-[0.97] transition-all duration-300 flex items-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <GitPullRequest className="w-4 h-4 mr-1" />
            Apply Fix to GitLab
          </button>
        </div>
      )}
    </div>
  );
}
