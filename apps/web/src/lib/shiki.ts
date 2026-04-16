import { createHighlighter, type Highlighter } from 'shiki';
import { useState, useEffect } from 'react';

let globalHighlighter: Highlighter | null = null;
let initializationPromise: Promise<Highlighter> | null = null;

/**
 * Initialize the global Shiki highlighter instance.
 */
export async function getHighlighter(): Promise<Highlighter> {
  if (globalHighlighter) return globalHighlighter;
  if (initializationPromise) return initializationPromise;

  initializationPromise = createHighlighter({
    themes: ['github-dark'],
    langs: [
      'typescript', 'javascript', 'tsx', 'jsx', 
      'python', 'bash', 'sql', 'json', 'yaml', 
      'markdown', 'css', 'html', 'diff', 'go', 'rust'
    ],
  }).then(h => {
    globalHighlighter = h;
    return h;
  });

  return initializationPromise;
}

export function useShiki() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(globalHighlighter);
  const [isReady, setIsReady] = useState(!!globalHighlighter);

  useEffect(() => {
    if (!globalHighlighter) {
      getHighlighter().then(h => {
        setHighlighter(h);
        setIsReady(true);
      });
    }
  }, []);

  const highlight = (code: string, lang: string = 'text') => {
    if (!highlighter) return null;
    
    const supportedLangs = highlighter.getLoadedLanguages();
    const finalLang = supportedLangs.includes(lang as any) ? lang : 'text';

    try {
      return highlighter.codeToHtml(code, {
        lang: finalLang,
        theme: 'github-dark',
      });
    } catch (err) {
      console.error('[Shiki] Highlight error:', err);
      return null;
    }
  };

  return { highlighter, isReady, highlight };
}
