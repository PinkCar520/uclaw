import React, { useState, useCallback, useEffect } from 'react';
import { render, Box, Text, useInput, useApp, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import type { ModelMessage } from 'ai';
import type { CliConfig, LoadedSkill, ModelProvider, ToolContext } from '../types.js';
import { createModelRouter } from '../llm/model-router.js';
import { buildSystemPrompt, runChatLoop } from '../llm/chat.js';
import { getTools } from '../tools/index.js';
import { loadSkillsFromDir } from '../skills/loader.js';
import { McpClientManager } from '../mcp/client.js';
import { StatusBar } from './status-bar.js';
import { MessageList } from './message-list.js';
import { ToolCallDisplay } from './tool-call-display.js';
import { MessageInput } from './message-input.js';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface InkAppProps {
  userId: string;
  workspace: string;
  cliConfig: CliConfig;
  skills: LoadedSkill[];
  toolContext: ToolContext;
  tools: Record<string, any>;
  modelRouter: ReturnType<typeof createModelRouter>;
  mcpManager: McpClientManager;
  mcpTools: Array<{ name: string; description: string }>;
  systemPrompt: string;
}

import { resolveApiKey, removeCredentials, getAutoUserId, saveCredentials } from '../utils/auth.js';
import { runAuthMenu } from './auth.js';
import { CONFIG } from '../utils/config.js';

/**
 * Main Ink App component
 */
export function InkApp(props: InkAppProps) {
  const { exit } = useApp();

  const [userId, setUserId] = useState(props.userId);
  const [messages, setMessages] = useState<ModelMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isWaitingInput, setIsWaitingInput] = useState(true);
  const [currentToolCalls, setCurrentToolCalls] = useState<Array<{ name: string; args: any }>>([]);
  const [currentToolResults, setCurrentToolResults] = useState<Array<{ name: string; result: any }>>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [commandType, setCommandType] = useState<'help' | 'model' | 'skills' | 'tools' | 'mcp' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');

  const models = props.modelRouter.listModels();

  useEffect(() => {
    const resolved = props.modelRouter.resolveModel();
    setSelectedModel(resolved.id);
  }, []);

  const handleSubmit = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    setCommandOutput(null);
    setCommandType(null);
    setError(null);
    setStreamingText('');

    if (trimmed.startsWith('/')) {
      handleCommand(trimmed);
      return;
    }

    const userMsg: ModelMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setIsWaitingInput(false);

    try {
      const model = props.modelRouter.getModel(selectedModel);
      const allMessages = [...messages, userMsg];

      const result = await runChatLoop(allMessages, {
        model,
        systemPrompt: props.systemPrompt,
        tools: props.tools,
        onText: (text: string) => {
          setStreamingText(prev => prev + text);
        },
        onToolCall: (toolName: string, args: any) => {
          setCurrentToolCalls(prev => [...prev, { name: toolName, args }]);
        },
        onToolResult: (toolName: string, toolResult: any) => {
          setCurrentToolResults(prev => [...prev, { name: toolName, result: toolResult }]);
        },
      });

      setMessages(prev => [...prev, { role: 'assistant', content: result.text }]);
      setStreamingText('');
      setCurrentToolCalls([]);
      setCurrentToolResults([]);
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred');
      setStreamingText('');
      setCurrentToolCalls([]);
      setCurrentToolResults([]);
    } finally {
      setIsThinking(false);
      setIsWaitingInput(true);
    }
  }, [isThinking, messages, selectedModel, props]);

  const handleCommand = useCallback(async (cmd: string) => {
    const parts = cmd.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (command) {
      case 'help':
        setCommandOutput(
          '▤ Available Commands:\n' +
          '  /help              - Show this help\n' +
          '  /login             - Authenticate with Gateway\n' +
          '  /logout            - Remove local credentials\n' +
          '  /whoami            - Show current identity\n' +
          '  /clear             - Clear conversation history\n' +
          '  /model [name]      - Switch model\n' +
          '  /skills            - List available skills\n' +
          '  /tools             - List available tools\n' +
          '  /mcp               - List MCP tools\n' +
          '  /exit, /quit       - Exit REPL',
        );
        setCommandType('help');
        break;

      case 'login':
        setIsWaitingInput(false);
        try {
          const { action } = await runAuthMenu();
          if (action === 'browser' || action === 'headless') {
            setCommandOutput(`\nRedirecting to ${action} login flow... (Follow CLI prompt if any)`);
          } else if (action === 'apiKey') {
            setCommandOutput('\nPlease provide your API Key in the prompt above.');
          }
          // Note: Full OAuth flow might need to trigger outside of the pure Ink loop 
          // but we can at least show the menu.
          setCommandOutput('Authentication started. (Feature is bridging from CLI)');
        } catch (err: any) {
          setError(`Login failed: ${err.message}`);
        }
        setIsWaitingInput(true);
        break;

      case 'logout':
        const removed = await removeCredentials();
        if (removed) {
          setCommandOutput('✓ Successfully logged out. Credentials removed.');
          setUserId('guest');
        } else {
          setCommandOutput('! Already logged out.');
        }
        break;

      case 'whoami':
        const key = await resolveApiKey();
        if (!key) {
          setCommandOutput('Status: Not Logged In');
        } else {
          const id = await getAutoUserId();
          setCommandOutput(`Status: Logged In\nIdentity: ${id}`);
        }
        break;

      case 'clear':
        setMessages([]);
        setCommandOutput('Conversation cleared');
        setCommandType('help');
        break;

      case 'model':
        if (args) {
          const exists = models.some(m => m.id === args);
          if (exists) {
            setSelectedModel(args);
            setCommandOutput(`✓ Selected model: ${args}`);
          } else {
            setCommandOutput(`✗ Model not found: ${args}`);
            setCommandType('error');
          }
        } else {
          const modelList = models.map(m => `  ${m.id} (${m.provider})`).join('\n');
          setCommandOutput(`▸ Available Models:\n${modelList}`);
        }
        setCommandType('model');
        break;

      case 'skills':
        if (props.skills.length === 0) {
          setCommandOutput('No skills loaded');
        } else {
          const skillList = props.skills.map(s => `  ${s.manifest.name} - ${s.manifest.description}`).join('\n');
          setCommandOutput(`◎ Available Skills:\n${skillList}`);
        }
        setCommandType('skills');
        break;

      case 'tools':
        setCommandOutput(
          '⚙ Available Tools:\n' +
          '  bash              - Execute shell commands\n' +
          '  file_read         - Read file contents\n' +
          '  file_write        - Create/overwrite files\n' +
          '  file_edit         - Edit specific text in files\n' +
          '  grep              - Search file contents with regex\n' +
          '  glob              - Match file paths with glob patterns',
        );
        setCommandType('tools');
        break;

      case 'mcp':
        if (props.mcpTools.length === 0) {
          setCommandOutput('No MCP tools available');
        } else {
          const toolList = props.mcpTools.map(t => `  ${t.name} - ${t.description}`).join('\n');
          setCommandOutput(`▨ MCP Tools:\n${toolList}`);
        }
        setCommandType('mcp');
        break;

      case 'exit':
      case 'quit':
        exit();
        break;

      default:
        setCommandOutput(`Unknown command: /${command}. Type /help for available commands.`);
        setCommandType('error');
    }
  }, [models, props.skills, props.mcpTools, exit]);

  useInput((input, key) => {
    if (input === 'd' && key.ctrl) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      <StatusBar
        userId={userId}
        workspace={props.workspace}
        model={selectedModel}
        skills={props.skills}
      />

      <MessageList
        messages={messages}
        streamingText={streamingText}
        isThinking={isThinking}
        toolCalls={currentToolCalls}
        toolResults={currentToolResults}
        commandOutput={commandOutput}
        commandType={commandType}
        error={error}
      />

      <MessageInput
        isWaiting={isWaitingInput}
        isThinking={isThinking}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}

/**
 * Initialize and render the Ink app
 */
export async function runInkApp(options: { userId: string; workspace: string }) {
  const cliConfig: CliConfig = {
    defaultAiProvider: process.env.DEFAULT_AI_PROVIDER,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL,
    deepseekModel: process.env.DEEPSEEK_MODEL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
    dashscopeBaseUrl: process.env.DASHSCOPE_BASE_URL,
    dashscopeModel: process.env.DASHSCOPE_MODEL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    openaiModel: process.env.OPENAI_MODEL,
    localApiKey: process.env.LOCAL_API_KEY,
    localBaseUrl: process.env.LOCAL_BASE_URL,
    localModel: process.env.LOCAL_MODEL,
    userId: options.userId,
    workspacePath: options.workspace,
  };

  const modelRouter = createModelRouter(cliConfig);

  const skillsDir = findSkillsDir(options.workspace);
  const skills: LoadedSkill[] = [];
  if (skillsDir) {
    try {
      const loaded = loadSkillsFromDir(skillsDir);
      skills.push(...loaded);
    } catch { /* skip */ }
  }

  const mcpManager = new McpClientManager(cliConfig);
  let mcpTools: Array<{ name: string; description: string }> = [];
  try {
    await mcpManager.loadConfig();
    await mcpManager.connectAll();
    mcpTools = await mcpManager.getAllTools();
  } catch { /* skip */ }

  const toolContext: ToolContext = {
    cwd: options.workspace,
    userId: options.userId,
    sessionId: Math.random().toString(36).substring(2, 15),
  };

  const coreTools = getTools(toolContext);
  const tools: Record<string, any> = {};
  for (const [name, toolDef] of Object.entries(coreTools)) {
    const tool = toolDef as any;
    tools[name] = {
      description: tool.description,
      parameters: tool.inputSchema,
      execute: async (args: any) => tool.execute(args, toolContext),
    };
  }

  const systemPrompt = buildSystemPrompt(options.userId, skills, options.workspace);

  const { waitUntilExit } = render(
    <InkApp
      userId={options.userId}
      workspace={options.workspace}
      cliConfig={cliConfig}
      skills={skills}
      toolContext={toolContext}
      tools={tools}
      modelRouter={modelRouter}
      mcpManager={mcpManager}
      mcpTools={mcpTools}
      systemPrompt={systemPrompt}
    />,
    { exitOnCtrlC: true },
  );

  await waitUntilExit();
  await mcpManager.disconnectAll();
  process.exit(0);
}

function findSkillsDir(startDir: string): string | null {
  const candidates = ['agent/skills', '.claude/skills', '.ocean/skills'];
  let current = startDir;
  while (true) {
    for (const candidate of candidates) {
      const dir = path.join(current, candidate);
      if (fs.existsSync(dir)) return dir;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
