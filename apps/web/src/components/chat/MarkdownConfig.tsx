import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Component for copying code blocks to clipboard.
 */
export const CopyCodeButton = ({ code }: { code: string }) => {
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
      className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 opacity-0 group-hover:opacity-100 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
      title="复制代码"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">已复制</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>复制</span>
        </>
      )}
    </button>
  );
};

/**
 * Custom components for ReactMarkdown.
 */
export const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const lang = /language-(\w+)/.exec(className || '')?.[1];
    const codeStr = String(children).replace(/\n$/, '');
    if (inline) {
      return (
        <code className="bg-[#F0EDE9] text-[#EC5B14] px-1.5 py-0.5 rounded text-[0.85em] font-mono" {...props}>
          {children}
        </code>
      );
    }
    return (
      <div className="relative group my-3 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[#1E1E1E]">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
            {lang || 'code'}
          </span>
        </div>
        <div className="relative">
          {lang ? (
            <SyntaxHighlighter
              language={lang}
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: '16px', fontSize: '13px', lineHeight: '1.6' }}
              showLineNumbers={codeStr.split('\n').length > 3}
              wrapLines={true}
            >
              {codeStr}
            </SyntaxHighlighter>
          ) : (
            <pre className="overflow-x-auto bg-[#282828] px-4 py-4 text-[13px] leading-relaxed m-0">
              <code className={`font-mono text-[#E8E8E8] ${className || ''}`} {...props}>
                {children}
              </code>
            </pre>
          )}
          <CopyCodeButton code={codeStr} />
        </div>
      </div>
    );
  },
};
