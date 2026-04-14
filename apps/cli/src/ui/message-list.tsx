import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { ModelMessage } from 'ai';
import { ToolCallDisplay } from './tool-call-display.js';

// Spinner animation frames for "thinking" state
const SPINNERS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Blinking cursor for typing animation
const CURSOR = '▊';

interface MessageListProps {
  messages: ModelMessage[];
  streamingText: string;
  isThinking: boolean;
  toolCalls: Array<{ name: string; args: any }>;
  toolResults: Array<{ name: string; result: any }>;
  commandOutput: string | null;
  commandType: 'help' | 'model' | 'skills' | 'tools' | 'mcp' | 'error' | null;
  error: string | null;
}

export function MessageList({
  messages,
  streamingText,
  isThinking,
  toolCalls,
  toolResults,
  commandOutput,
  commandType,
  error,
}: MessageListProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Spinner animation
  useEffect(() => {
    if (!isThinking) return;
    const interval = setInterval(() => {
      setSpinnerFrame(prev => (prev + 1) % SPINNERS.length);
    }, 80);
    return () => clearInterval(interval);
  }, [isThinking]);

  // Cursor blink animation
  useEffect(() => {
    if (!streamingText && !isThinking) return;
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, [streamingText, isThinking]);

  const maxMessages = Math.min(messages.length, 20);
  const displayMessages = messages.slice(-maxMessages);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Previous messages */}
      {displayMessages.map((msg, i) => {
        if (msg.role === 'user') {
          return (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Box>
                <Text bold color="green">
                  {'❯ '}
                </Text>
                <Text bold>
                  {msg.content as string}
                </Text>
              </Box>
            </Box>
          );
        }

        if (msg.role === 'assistant') {
          const content = typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join('')
              : '';

          return (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text bold color="cyan">{'▸ '}</Text>
              <Text wrap="wrap">{content}</Text>
            </Box>
          );
        }

        return null;
      })}

      {/* Active tool calls */}
      {toolCalls.length > 0 && (
        <ToolCallDisplay toolCalls={toolCalls} toolResults={toolResults} />
      )}

      {/* Streaming text with typing cursor */}
      {streamingText && (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text bold color="cyan">{'▸ '}</Text>
            <Text wrap="wrap">
              {streamingText}
            </Text>
            <Text bold color="cyan">{cursorVisible ? CURSOR : ' '}</Text>
          </Box>
        </Box>
      )}

      {/* Thinking indicator with spinner */}
      {isThinking && !streamingText && toolCalls.length === 0 && (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {`${SPINNERS[spinnerFrame]} Thinking...`}
          </Text>
        </Box>
      )}

      {/* Command output */}
      {commandOutput && (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text bold
              color={
                commandType === 'error'
                  ? 'yellow'
                  : commandType === 'help'
                    ? 'white'
                    : 'green'
              }
            >
              {commandOutput}
            </Text>
          </Box>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="red">{`✗ ${error}`}</Text>
        </Box>
      )}
    </Box>
  );
}

