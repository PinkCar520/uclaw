/**
 * UClaw REPL - Entry point for interactive mode
 * Uses Ink UI for rich terminal experience
 */
import type { ModelMessage } from 'ai';
import type { CliConfig, LoadedSkill, ToolContext } from './types.js';
import { createModelRouter } from './llm/model-router.js';
import { buildSystemPrompt, runChatLoop } from './llm/chat.js';
import { getTools } from './tools/index.js';
import { loadSkillsFromDir } from './skills/loader.js';
import { McpClientManager } from './mcp/client.js';
import { runInkApp } from './ui/app.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import chalk from 'chalk';
import readline from 'node:readline';
import ora from 'ora';

interface ReplOptions {
  userId: string;
  workspace: string;
  singleQuery?: string;
}

/**
 * Run the interactive REPL
 * - Single query mode: legacy text-based approach
 * - Interactive mode: Ink UI if TTY, otherwise readline fallback
 */
export async function runRepl(options: ReplOptions) {
  // Single query mode - use simple text approach
  if (options.singleQuery) {
    await runSingleQuery(options);
    process.exit(0);
    return;
  }

  // Check if stdin is a TTY (interactive terminal)
  // Ink requires raw mode which only works with TTY
  if (process.stdin.isTTY) {
    // Use Ink UI for interactive terminal
    await runInkApp({
      userId: options.userId,
      workspace: options.workspace,
    });
  } else {
    // Fallback to readline for piped/non-TTY input
    await runReadlineRepl(options);
  }
}

/**
 * Run a single query without Ink UI (for scripting/CI)
 */
async function runSingleQuery(options: ReplOptions) {
  const query = options.singleQuery;
  if (!query) return;

  console.log(chalk.cyan(`[UClaw] Query: ${query}`));
  console.log(chalk.cyan(`[UClaw] User: ${options.userId}`));
  console.log(chalk.cyan(`[UClaw] Workspace: ${options.workspace}\n`));

  // Load config
  const cliConfig: CliConfig = {
    vllmBaseUrl: process.env.VLLM_API_BASE,
    vllmModelName: process.env.VLLM_MODEL_NAME,
    vllmApiKey: process.env.VLLM_API_KEY,
    dashscopeBaseUrl: process.env.DASHSCOPE_API_BASE,
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
    dashscopeDefaultModel: process.env.DASHSCOPE_DEFAULT_MODEL,
    dashscopeModelName: process.env.DASHSCOPE_MODEL_NAME,
    omlxBaseUrl: process.env.AI_GATEWAY_BASE_URL,
    omlxModel: process.env.AI_GATEWAY_MODEL,
    omlxApiKey: process.env.AI_GATEWAY_API_KEY,
    userId: options.userId,
    workspacePath: options.workspace,
  };

  const modelRouter = createModelRouter(cliConfig);

  // Load skills
  const skillsDir = findSkillsDir(options.workspace);
  const skills: LoadedSkill[] = [];
  if (skillsDir) {
    try {
      const loaded = loadSkillsFromDir(skillsDir);
      skills.push(...loaded);
    } catch { /* skip */ }
  }

  // Build tools
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
  const messages: ModelMessage[] = [{ role: 'user', content: query }];

  const spinner = ora(chalk.cyan('Thinking...')).start();

  try {
    const model = modelRouter.getModel();
    let streamedText = '';

    const result = await runChatLoop(messages, {
      model,
      systemPrompt,
      tools,
      onText: (text: string) => {
        if (streamedText.length === 0) spinner.stop();
        process.stdout.write(text);
        streamedText += text;
      },
    });

    if (streamedText.length > 0) process.stdout.write('\n');
  } catch (err: any) {
    spinner.stop();
    console.error(chalk.red(`\n✗ Error: ${err.message}`));
    if (process.env.DEBUG) console.error(err.stack);
  }
}

/**
 * Readline-based REPL (fallback for non-TTY environments)
 */
async function runReadlineRepl(options: ReplOptions) {
  // Load config
  const cliConfig: CliConfig = {
    vllmBaseUrl: process.env.VLLM_API_BASE,
    vllmModelName: process.env.VLLM_MODEL_NAME,
    vllmApiKey: process.env.VLLM_API_KEY,
    dashscopeBaseUrl: process.env.DASHSCOPE_API_BASE,
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
    dashscopeDefaultModel: process.env.DASHSCOPE_DEFAULT_MODEL,
    dashscopeModelName: process.env.DASHSCOPE_MODEL_NAME,
    omlxBaseUrl: process.env.AI_GATEWAY_BASE_URL,
    omlxModel: process.env.AI_GATEWAY_MODEL,
    omlxApiKey: process.env.AI_GATEWAY_API_KEY,
    userId: options.userId,
    workspacePath: options.workspace,
  };

  console.log(chalk.gray(`[Config] VLLM_BASE: ${cliConfig.vllmBaseUrl || '(empty)'}`));
  console.log(chalk.gray(`[Config] DASHSCOPE_BASE: ${cliConfig.dashscopeBaseUrl || '(empty)'}`));
  console.log(chalk.gray(`[Config] OMLX_BASE: ${cliConfig.omlxBaseUrl || '(empty)'}`));
  console.log(chalk.gray(`[Config] MODELS: ${cliConfig.vllmModelName || '(empty)'}`));

  const modelRouter = createModelRouter(cliConfig);
  const models = modelRouter.listModels();
  console.log(chalk.gray(`[LLM] Available models: ${models.map((m: any) => m.id).join(', ')}`));

  // Load skills
  const skillsDir = findSkillsDir(options.workspace);
  const skills: LoadedSkill[] = [];
  if (skillsDir) {
    try {
      const loaded = loadSkillsFromDir(skillsDir);
      skills.push(...loaded);
      if (loaded.length > 0) {
        console.log(chalk.gray(`[Skills] Loaded ${loaded.length} skills: ${loaded.map((s: LoadedSkill) => s.manifest.name).join(', ')}`));
      }
    } catch { /* skip */ }
  }

  // MCP
  const mcpManager = new McpClientManager(cliConfig);
  let mcpTools: Array<{ name: string; description: string }> = [];
  try {
    await mcpManager.loadConfig();
    await mcpManager.connectAll();
    mcpTools = await mcpManager.getAllTools();
  } catch { /* skip */ }

  // Build tools
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
  const messages: ModelMessage[] = [];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(chalk.gray('\nType your query or use /help for commands\n'));

  let isClosing = false;

  rl.on('close', () => {
    isClosing = true;
    process.exit(0);
  });

  function prompt() {
    if (isClosing) return;
    rl.question(chalk.bold.green('\nuclaw> '), async (input) => {
      if (isClosing) return;
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }

      if (trimmed.startsWith('/')) {
        handleCommand(trimmed, rl, modelRouter, mcpTools, skills, messages);
        prompt();
        return;
      }

      messages.push({ role: 'user', content: trimmed });
      const spinner = ora(chalk.cyan('Thinking...')).start();

      try {
        const model = modelRouter.getModel();
        let streamedText = '';
        const result = await runChatLoop(messages, {
          model, systemPrompt, tools,
          onText: (text: string) => {
            if (!streamedText) spinner.stop();
            process.stdout.write(text);
            streamedText += text;
          },
        });
        if (streamedText) process.stdout.write('\n');
        messages.push({ role: 'assistant', content: result.text });
      } catch (err: any) {
        spinner.stop();
        console.error(chalk.red(`\n✗ Error: ${err.message}`));
      }

      prompt();
    });
  }

  prompt();
}

function handleCommand(
  cmd: string,
  rl: readline.Interface,
  modelRouter: ReturnType<typeof createModelRouter>,
  mcpTools: Array<{ name: string; description: string }>,
  skills: LoadedSkill[],
  messages: ModelMessage[],
) {
  const parts = cmd.slice(1).split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case 'help':
      console.log(chalk.bold('\n▤ Available Commands:'));
      console.log('  /help              - Show this help');
      console.log('  /clear             - Clear conversation history');
      console.log('  /model [name]      - Switch model');
      console.log('  /skills            - List available skills');
      console.log('  /tools             - List available tools');
      console.log('  /exit, /quit       - Exit REPL');
      break;
    case 'clear':
      messages.length = 0;
      console.log(chalk.gray('Conversation cleared'));
      break;
    case 'model': {
      const models = modelRouter.listModels();
      if (args) console.log(chalk.gray(`Selected model: ${args}`));
      else {
        console.log(chalk.bold('\n▸ Available Models:'));
        for (const m of models) console.log(`  ${m.id} (${m.provider})`);
      }
      break;
    }
    case 'skills':
      if (skills.length === 0) console.log(chalk.yellow('No skills loaded'));
      else {
        console.log(chalk.bold('\n◎ Available Skills:'));
        for (const s of skills) console.log(`  ${chalk.green(s.manifest.name)} - ${s.manifest.description}`);
      }
      break;
    case 'tools':
      console.log(chalk.bold('\n⚙ Available Tools:'));
      console.log('  bash, file_read, file_write, file_edit, grep, glob');
      break;
    case 'mcp':
      if (mcpTools.length === 0) console.log(chalk.yellow('No MCP tools available'));
      else {
        console.log(chalk.bold('\n▨ MCP Tools:'));
        for (const t of mcpTools) console.log(`  ${chalk.green(t.name)} - ${t.description}`);
      }
      break;
    case 'exit':
    case 'quit':
      console.log(chalk.gray('\nGoodbye!'));
      rl.close();
      process.exit(0);
      break;
    default:
      console.log(chalk.yellow(`Unknown command: /${command}. Type /help for available commands.`));
  }
}

function findSkillsDir(startDir: string): string | null {
  const candidates = ['agent/skills', '.claude/skills', '.uclaw/skills'];
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
