import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface MessageInputProps {
  isWaiting: boolean;
  isThinking: boolean;
  onSubmit: (input: string) => void;
}

export function MessageInput({ isWaiting, isThinking, onSubmit }: MessageInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = () => {
    if (inputValue.trim() && isWaiting) {
      onSubmit(inputValue);
      setInputValue('');
    }
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray">
          {'─'.repeat(60)}
        </Text>
      </Box>
      <Box>
        <Text bold color={isWaiting ? 'green' : 'gray'}>
          {'uclaw❯ '}
        </Text>
        <TextInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder={isThinking ? '⠋ Working...' : 'Type your query or /help'}
        />
      </Box>
    </Box>
  );
}

