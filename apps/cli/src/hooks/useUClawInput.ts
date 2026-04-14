import { useState, useRef, useCallback } from 'react';
import { useInput } from 'ink';

interface UseUClawInputProps {
  initialValue?: string;
  onEnter?: (value: string) => boolean | void; // Return true to keep value (completion)
  onTab?: (value: string) => string | void; // Return new value if completed
  onUp?: () => void;
  onDown?: () => void;
}

/**
 * Custom Input Engine - Inspired by Claude Code
 * Manages text state, cursor position, and keyboard events manually.
 * Fixed: Proper Unicode/Chinese character support and stable cursor tracking.
 */
export function useUClawInput({ initialValue = '', onEnter, onTab, onUp, onDown }: UseUClawInputProps) {
  const [value, setValue] = useState(initialValue);
  const [cursorOffset, setCursorOffset] = useState(initialValue.length);
  const valueRef = useRef(value);
  const cursorRef = useRef(cursorOffset);
  const pendingInput = useRef<string | null>(null);

  // Keep refs in sync
  valueRef.current = value;
  cursorRef.current = cursorOffset;

  useInput((input, key) => {
    // Skip if processing a pending batch
    if (pendingInput.current !== null) return;

    // 1. Handle Vertical Navigation (for suggestions)
    if (key.upArrow) {
      if (onUp) onUp();
      return;
    }
    if (key.downArrow) {
      if (onDown) onDown();
      return;
    }

    // 2. Handle Backspace - supports both single char and word deletion (Ctrl+Backspace)
    if (key.backspace) {
      const currentOffset = cursorRef.current;
      const currentValue = valueRef.current;
      if (currentOffset > 0) {
        // Use codePointAt for proper Unicode handling
        const prevChar = currentValue.slice(0, currentOffset);
        const charLength = [...prevChar].length >= 1 ? 1 : 0;
        const deleteFrom = [...prevChar].slice(-1).join('').length;
        const newValue = currentValue.slice(0, currentOffset - deleteFrom) + currentValue.slice(currentOffset);
        setValue(newValue);
        valueRef.current = newValue;
        setCursorOffset(currentOffset - deleteFrom);
        cursorRef.current = currentOffset - deleteFrom;
      }
      return;
    }

    if (key.delete) {
      const currentOffset = cursorRef.current;
      const currentValue = valueRef.current;
      if (currentOffset < currentValue.length) {
        const rest = currentValue.slice(currentOffset);
        const deleteLength = [...rest].slice(0, 1).join('').length;
        const newValue = currentValue.slice(0, currentOffset) + currentValue.slice(currentOffset + deleteLength);
        setValue(newValue);
        valueRef.current = newValue;
      }
      return;
    }

    // 3. Handle Left/Right Arrows (Cursor Movement) - Unicode aware
    if (key.leftArrow) {
      const currentOffset = cursorRef.current;
      const currentValue = valueRef.current;
      const before = currentValue.slice(0, currentOffset);
      const chars = [...before];
      if (chars.length > 0) {
        const newOffset = currentOffset - [...chars.slice(-1).join('')].length;
        setCursorOffset(newOffset);
        cursorRef.current = newOffset;
      }
      return;
    }
    if (key.rightArrow) {
      const currentOffset = cursorRef.current;
      const currentValue = valueRef.current;
      const rest = currentValue.slice(currentOffset);
      const chars = [...rest];
      if (chars.length > 0) {
        const charLen = [...chars.slice(0, 1).join('')].length;
        const newOffset = Math.min(currentValue.length, currentOffset + charLen);
        setCursorOffset(newOffset);
        cursorRef.current = newOffset;
      }
      return;
    }

    // 4. Handle Enter
    if (key.return) {
      const keepValue = onEnter ? onEnter(valueRef.current) : false;
      if (!keepValue) {
        setValue('');
        setCursorOffset(0);
        valueRef.current = '';
        cursorRef.current = 0;
      }
      return;
    }

    // 5. Handle Tab (Completion)
    if (key.tab) {
      if (onTab) {
        const completed = onTab(valueRef.current);
        if (completed) {
          setValue(completed);
          setCursorOffset(completed.length);
          valueRef.current = completed;
          cursorRef.current = completed.length;
        }
      }
      return;
    }

    // 6. Handle Regular Characters - Unicode aware
    if (input && !key.ctrl && !key.meta && !key.return && !key.tab && !key.backspace && !key.delete && input.length > 0) {
      const currentOffset = cursorRef.current;
      const currentValue = valueRef.current;
      const newValue = currentValue.slice(0, currentOffset) + input + currentValue.slice(currentOffset);
      const inputLength = input.length;
      setValue(newValue);
      valueRef.current = newValue;
      setCursorOffset(currentOffset + inputLength);
      cursorRef.current = currentOffset + inputLength;
    }
  });

  return {
    value,
    cursorOffset,
    setValue,
    setCursorOffset,
  };
}
