import React, { useState, useMemo } from 'react';
import { Maximize2, Code2 } from 'lucide-react';
import { useShiki } from '../../lib/shiki';
import { cn } from '../../lib/utils';

/**
 * Lightweight copy button
 */
export const CopyCodeButton = React.memo(({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all duration-200 hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/10"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">Copied</span>
        </>
      ) : (
        <>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Copy</span>
        </>
      )}
    </button>
  );
});

interface CodeBlockProps {
  language?: string;
  value: string;
  onExtract?: (data: { title: string; content: string; language: string }) => void;
  minimal?: boolean; 
}

/**
 * Premium Shiki Code Block.
 * Styled to match the card aesthetic from the design mockup.
 */
export const CodeBlock = React.memo(({ language, value, onExtract, minimal = false }: CodeBlockProps) => {
  const rawCode = value.replace(/\n$/, '');
  const { highlight } = useShiki();

  const { displayCode, filename } = useMemo(() => {
    const lines = rawCode.split('\n');
    const firstLine = lines[0] || '';
    const filenameRegex = /^(?:\/\/|#|--|\/\*)\s*(?:filename:?|filepath:?)\s*([^\s\*]+)/i;
    const match = firstLine.match(filenameRegex);
    if (match && match[1]) {
      return { filename: match[1], displayCode: lines.slice(1).join('\n') };
    }
    return { filename: null, displayCode: rawCode };
  }, [rawCode]);

  const shikiHtml = useMemo(() => highlight(displayCode, language), [highlight, displayCode, language]);

  return (
    <div className={cn(
      "relative group font-mono selection:bg-orange-500/30 not-prose",
      minimal ? "h-full w-full" : "my-8 rounded-[24px] overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
    )}>
      {/* Absolute Header - Card Style */}
      {!minimal && (
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#1a1b1e] border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded bg-white/5 text-slate-500">
              <Code2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[13px] font-semibold text-slate-300 select-none shrink-0 tracking-wide">
                {filename || (language === 'text' ? 'snippet' : language || 'code')}
              </span>
              {filename && language && (
                <span className="text-[11px] font-medium text-slate-600 lowercase bg-white/5 px-1.5 py-0.5 rounded">
                  {language}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExtract && (
              <button
                onClick={() => onExtract({ title: filename || 'Code snippet', content: displayCode, language: language || 'text' })}
                className="p-1.5 rounded-lg transition-all duration-200 hover:bg-white/[0.08] text-slate-500 hover:text-slate-300"
                title="Open in sidebar"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
            <CopyCodeButton code={displayCode} />
          </div>
        </div>
      )}

      {/* Shiki Render Output */}
      <div className={cn(
        "shiki-container bg-[#0d0d0d]",
        !minimal && "min-h-[60px]"
      )}>
        {shikiHtml ? (
          <div 
            className="[&>pre]:!m-0 [&>pre]:!p-6 [&>pre]:!bg-transparent [&>pre]:text-[13.5px] [&>pre]:leading-relaxed overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: shikiHtml }} 
          />
        ) : (
          <pre className="p-6 text-[13.5px] leading-relaxed text-slate-500 whitespace-pre opacity-50 font-mono">
            {displayCode}
          </pre>
        )}
      </div>
    </div>
  );
});

/**
 * Custom components for ReactMarkdown.
 */
export const MarkdownComponents = (onExtract?: any) => ({
  pre({ children }: any) {
    return <>{children}</>;
  },
  code({ node, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : undefined;
    const codeStr = String(children);

    if (!lang && !codeStr.includes('\n')) {
      return (
        <code className="bg-[#F0EDE9] text-[#EC5B14] px-1.5 py-0.5 rounded text-[0.85em] font-mono" {...props}>
          {children}
        </code>
      );
    }
    return <CodeBlock language={lang} value={codeStr} onExtract={onExtract} />;
  },
});
