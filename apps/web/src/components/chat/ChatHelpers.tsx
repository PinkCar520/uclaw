import React, { useState, useEffect } from 'react';

/**
 * Typing cursor shown during streaming response.
 */
export const TypingCursor = () => (
  <span className="inline-block w-[2px] h-[1.1em] bg-[#EC5B14] ml-[1px] align-text-bottom animate-cursor-blink" />
);

/**
 * Braille spinner for showing "thinking" or "loading" state.
 */
export const BrailleSpinner = () => {
  const [pattern, setPattern] = useState('⠋');
  useEffect(() => {
    const patterns = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const interval = setInterval(() => {
      setPattern(patterns[i]);
      i = (i + 1) % patterns.length;
    }, 80);
    return () => clearInterval(interval);
  }, []);
  return <span className="font-mono text-[#716B67] mr-1">{pattern}</span>;
};
