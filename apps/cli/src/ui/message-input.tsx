import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { useUClawInput } from '../hooks/useUClawInput.js';

interface MessageInputProps {
  isWaiting: boolean;
  isThinking: boolean;
  onSubmit: (input: string) => void;
}

const COMMANDS = [
  { name: '/help', desc: 'Show available commands' },
  { name: '/login', desc: 'Sign in to UClaw Gateway' },
  { name: '/logout', desc: 'Remove local credentials' },
  { name: '/whoami', desc: 'Show current identity' },
  { name: '/clear', desc: 'Clear conversation history' },
  { name: '/model', desc: 'Switch or list models' },
  { name: '/skills', desc: 'List active skills' },
  { name: '/tools', desc: 'List built-in tools' },
  { name: '/mcp', desc: 'List MCP servers' },
  { name: '/exit', desc: 'Quit the application' },
];

export function MessageInput({ isWaiting, isThinking, onSubmit }: MessageInputProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const MAX_VISIBLE = 5;

  // Real filtered suggestions logic
  const getMatches = (val: string) => {
    if (!val.startsWith('/') || val.includes(' ')) return [];
    const search = val.toLowerCase();
    return COMMANDS.filter(cmd => cmd.name.toLowerCase().startsWith(search));
  };

  const matches = useMemo(() => getMatches(''), [/* empty initial */]);
  // Use a ref-like helper to get current matches during interaction
  const currentMatches = getMatches;

  const updateScroll = (newIndex: number, totalMatches: number) => {
    setSelectedIndex(newIndex);
    
    // Sliding Window logic
    if (newIndex < startIndex) {
      setStartIndex(newIndex);
    } else if (newIndex >= startIndex + MAX_VISIBLE) {
      setStartIndex(newIndex - MAX_VISIBLE + 1);
    }
  };

  // 1. Core State & Logic using our Hook
  const { value, cursorOffset, setValue, setCursorOffset } = useUClawInput({
    onEnter: (val) => {
      const ms = currentMatches(val);
      if (ms.length > 0) {
        const selected = ms[selectedIndex] || ms[0];
        const completed = selected.name + ' ';
        setValue(completed);
        setCursorOffset(completed.length);
        return true; // Keep value - this was a completion, not a submission
      }

      if (val.trim() && isWaiting) {
        onSubmit(val);
      }
    },
    onTab: (val) => {
      const ms = currentMatches(val);
      if (ms.length > 0) {
        const selected = ms[selectedIndex] || ms[0];
        return selected.name + ' ';
      }
      return val;
    },
    onUp: () => {
      const ms = currentMatches(value);
      if (ms.length > 0) {
        const nextIndex = (selectedIndex > 0 ? selectedIndex - 1 : ms.length - 1);
        updateScroll(nextIndex, ms.length);
      }
    },
    onDown: () => {
      const ms = currentMatches(value);
      if (ms.length > 0) {
        const nextIndex = (selectedIndex < ms.length - 1 ? selectedIndex + 1 : 0);
        updateScroll(nextIndex, ms.length);
      }
    }
  });

  const activeMatches = useMemo(() => getMatches(value), [value]);

  // Reset selected index & scroll when search text changes
  useEffect(() => {
    setSelectedIndex(0);
    setStartIndex(0);
  }, [value]);

  // 2. Syntax Highlighting & Ghost Text Logic
  const renderedContent = useMemo(() => {
    const segments: React.ReactNode[] = [];
    const isCommand = value.startsWith('/');
    const firstSpace = value.indexOf(' ');
    const commandPart = firstSpace === -1 ? value : value.slice(0, firstSpace);

    // Placeholder logic - rendered only if value is empty
    if (!value && !isThinking) {
      segments.push(
        <Text key="cursor-empty" backgroundColor="cyan" color="black">
          {' '}
        </Text>
      );
      segments.push(
        <Text key="placeholder" dimColor>
          {' Type your query or /help'}
        </Text>
      );
      return segments;
    }

    if (!value && isThinking) {
      return <Text dimColor>⠋ Working...</Text>;
    }

    // Render logic for characters
    const fullText = value;
    for (let i = 0; i <= fullText.length; i++) {
      let char = fullText[i] || ' ';
      let color = (isCommand && i < commandPart.length) ? 'cyan' : 'white';

      const isCursor = i === cursorOffset;
      segments.push(
        <Text 
          key={i} 
          color={isCursor ? 'black' : color} 
          backgroundColor={isCursor ? 'cyan' : undefined}
        >
          {char}
        </Text>
      );
      if (i === fullText.length && !isCursor) break;
    }

    // Ghost Text Implementation - follow selected index
    if (isCommand && firstSpace === -1 && activeMatches[selectedIndex]) {
      const matchName = activeMatches[selectedIndex].name;
      if (matchName !== value) {
        segments.push(<Text key="ghost" color="gray" italic>{matchName.slice(value.length)}</Text>);
      }
    }

    return segments;
  }, [value, cursorOffset, isThinking, activeMatches, selectedIndex]);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="gray">{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>
      <Box>
        <Box marginRight={1}>
          <Text bold color={isWaiting ? 'green' : 'gray'}>{'› '}</Text>
        </Box>
        <Box>{renderedContent}</Box>
      </Box>

      {/* Suggestions List - Interactive & Scrolling */}
      {activeMatches.length > 0 && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          {activeMatches.slice(startIndex, startIndex + MAX_VISIBLE).map((cmd, relativeIndex) => {
            const absoluteIndex = startIndex + relativeIndex;
            const isSelected = absoluteIndex === selectedIndex;
            return (
              <Box key={cmd.name} backgroundColor={isSelected ? 'cyan' : undefined} paddingX={isSelected ? 1 : 0}>
                <Box width={22}>
                  <Text color={isSelected ? 'black' : 'gray'} bold={isSelected}>
                    {isSelected ? '› ' : '  '}
                    {cmd.name}
                  </Text>
                </Box>
                <Text color={isSelected ? 'black' : 'dimColor'}>{cmd.desc}</Text>
              </Box>
            );
          })}
          {activeMatches.length > MAX_VISIBLE && (
            <Box paddingLeft={1} marginTop={0}>
              <Text dimColor>
                {startIndex > 0 ? ' ↑ ' : '   '}
                Showing {startIndex + 1}-{Math.min(startIndex + MAX_VISIBLE, activeMatches.length)} of {activeMatches.length}
                {startIndex + MAX_VISIBLE < activeMatches.length ? ' ↓ ' : '   '}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
