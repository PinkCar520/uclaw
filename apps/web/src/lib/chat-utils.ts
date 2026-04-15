export interface ThinkingStep {
  label: string;
  status: 'done' | 'active' | 'pending';
  icon?: string;
}

/**
 * Parse reasoning text into ThinkingStep[] for ThinkingList rendering.
 * Splits by newlines or sentences, marking the last step as 'active' during streaming.
 */
export function parseReasoningToSteps(
  reasoning: string, 
  isStreaming: boolean, 
  isLastStep = true
): ThinkingStep[] {
  if (!reasoning || !reasoning.trim()) return [];

  const trimmed = reasoning.trim();

  // Split by newlines first, filter empty lines
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);

  // If we have multiple lines, use them directly
  if (lines.length > 1) {
    return lines.map((label, i) => {
      const isLast = isLastStep && i === lines.length - 1;
      return {
        label,
        status: isLast && isStreaming ? ('active' as const) : ('done' as const),
      };
    });
  }

  // Single line: try sentence-level splitting (by common sentence boundaries)
  // Split by period, exclamation, question mark followed by space or end of string
  const sentences = trimmed
      .split(/(?<=[.!。！？\n])\s*(?=[A-Z\u4e00-\u9fff])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

  // If we got multiple sentences, use them
  if (sentences.length > 1) {
    return sentences.map((label, i) => {
      const isLast = isLastStep && i === sentences.length - 1;
      return {
        label: label.replace(/[.。!！?？]+$/, ''),
        status: isLast && isStreaming ? ('active' as const) : ('done' as const),
      };
    });
  }

  // Fallback: treat as a single step
  return [{
    label: trimmed,
    status: isLastStep && isStreaming ? ('active' as const) : ('done' as const),
  }];
}

/**
 * Get a friendly name for a tool invocation.
 */
export function getFriendlyToolName(
  part: any, 
  t: (key: string, defaultValue?: string) => string,
  getLocalizedName?: (name: string) => string
): string {
  // 安全提取底层对象，应对 AI SDK 各版本嵌套结构
  const inner = part.toolInvocation || part.invocation || part;
  const rawToolName = inner.toolName || part.toolName || part.type?.replace('tool-', '') || 'unknown';

  let args = inner.args || part.args;
  // 如果是字符串序列化，做一层解析
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch (e) { }
  }

  // 优先显示具体技能名称，其次显示翻译名称
  if (rawToolName === 'activate_skill') {
    let skillName = args?.skill_name || args?.skillName || args?.name || args?.skill;
    if (skillName) {
      return getLocalizedName ? getLocalizedName(skillName) : skillName; 
    }
    return t('chat.tool.activate_skill', 'Activate Skill');
  }

  // 常用工具名称映射
  const toolNameMap: Record<string, string> = {
    'searchBugs': t('chat.tool.search_bugs', 'Search Bugs'),
    'tool-searchBugs': t('chat.tool.search_bugs', 'Search Bugs'),
    'resolveBug': t('chat.tool.resolve_bug', 'Resolve Bug'),
    'tool-resolveBug': t('chat.tool.resolve_bug', 'Resolve Bug'),
    'proposePlan': t('chat.tool.propose_plan', 'Propose Plan'),
    'tool-proposePlan': t('chat.tool.propose_plan', 'Propose Plan'),
    'runLocalCommand': t('chat.tool.run_command', 'Run Command'),
    'tool-runLocalCommand': t('chat.tool.run_command', 'Run Command'),
    'list_directory': t('chat.tool.list_dir', 'List Directory'),
    'read_file': t('chat.tool.read_file', 'Read File'),
    'grep_search': t('chat.tool.grep_search', 'Search Files'),
  };

  if (toolNameMap[rawToolName]) {
    const translated = toolNameMap[rawToolName];
    // 特殊处理：如果运行的是 zentao 脚本等有 command 的工具
    if (args?.command) {
      const cmdNames: Record<string, string> = {
        'analyze': '分析问题',
        'verify': '验证缺陷',
        'resolve': '解决缺陷',
        'trace': '链路追踪'
      };
      const cmdName = cmdNames[args.command] || args.command;
      return `${translated} → ${cmdName}`;
    }
    return translated;
  }

  // Fallback: title-case the raw name
  return rawToolName.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Beautify model names by removing versioning and technical suffixes.
 */
export function beautifyModelName(name: string): string {
  return name
    .split(/[-:_]/)
    .filter(word => !['it', '8bit', 'v3', 'v2', 'latest'].includes(word.toLowerCase()))
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
