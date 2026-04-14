import React from 'react';
import { Box, Text } from 'ink';

interface ToolCallDisplayProps {
  toolCalls: Array<{ name: string; args: any }>;
  toolResults: Array<{ name: string; result: any }>;
}

// Tool icon mapping
const TOOL_ICONS: Record<string, string> = {
  bash: '⌨',
  file_read: '▤',
  file_write: '✎',
  file_edit: '✎',
  grep: '⌕',
  glob: '▤',
};

function formatArgs(args: any): string {
  if (typeof args === 'string') return args.slice(0, 60);
  const str = JSON.stringify(args);
  if (str.length <= 60) return str;
  // Show key-value pairs compactly
  const entries = Object.entries(args);
  const compact = entries.map(([k, v]) => {
    const vs = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}=${vs.length > 30 ? vs.slice(0, 30) + '…' : vs}`;
  }).join(', ');
  return compact.length > 60 ? compact.slice(0, 60) + '…' : compact;
}

function formatResult(result: any): string {
  if (typeof result === 'string') return result.slice(0, 80);
  if (result?.error) return `✗ ${result.error}`;
  if (result?.data) {
    const str = JSON.stringify(result.data);
    return str.length > 80 ? str.slice(0, 80) + '…' : str;
  }
  const str = JSON.stringify(result);
  return str.length > 80 ? str.slice(0, 80) + '…' : str;
}

export function ToolCallDisplay({ toolCalls, toolResults }: ToolCallDisplayProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {toolCalls.map((tc, i) => {
        const icon = TOOL_ICONS[tc.name] || '⚙';
        const result = toolResults[i];
        const isDone = !!result;

        return (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Box>
              <Text bold color={isDone ? 'green' : 'yellow'}>
                {`${icon} ${tc.name}`}
              </Text>
              <Text>
                {` ${formatArgs(tc.args)}`}
              </Text>
              {isDone && (
                <Text bold color="green">{' ✓'}</Text>
              )}
            </Box>
            {result && (
              <Box marginLeft={2}>
                <Text color="cyan">
                  {`↳ ${formatResult(result.result)}`}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

