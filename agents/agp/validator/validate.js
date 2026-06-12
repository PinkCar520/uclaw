#!/usr/bin/env node
/**
 * AGP Manifest Validator v1.0
 * 检验 AGP (Agent Governance Protocol) Manifest 文件是否符合 AGP/1.0 规范
 *
 * Usage:
 *   node agp/validator/validate.js <path-to-SKILL.md>
 *   node agp/validator/validate.js apps/gateway/skills/fix-bug/SKILL.md
 *
 * @author pinkcar
 */

const fs = require('fs');
const path = require('path');

// ─── ANSI 颜色 ────────────────────────────────────────────────────────────────
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ─── Frontmatter 解析 ─────────────────────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  // 解析 protocol
  const protocol = yaml.match(/^protocol:\s*(.+)$/m);
  if (protocol) result.protocol = protocol[1].trim();

  // 解析 name
  const name = yaml.match(/^name:\s*(.+)$/m);
  if (name) result.name = name[1].trim();

  // 解析 description
  const desc = yaml.match(/^description:\s*["']?([\s\S]*?)["']?$/m);
  if (desc) result.description = desc[1].trim().replace(/^"|"$/g, '');

  // 解析 allowed-tools（数组格式）
  const toolsMatch = yaml.match(/^allowed-tools:\n((?:\s+-\s+.+\n?)+)/m);
  if (toolsMatch) {
    result['allowed-tools'] = toolsMatch[1]
      .split('\n')
      .map((l) => l.trim().replace(/^-\s*/, ''))
      .filter(Boolean);
  } else {
    // 兼容检测旧的单行格式
    const inlineTools = yaml.match(/^allowed-tools:\s+(.+)$/m);
    if (inlineTools) {
      result['allowed-tools'] = inlineTools[1].trim().split(/\s+/);
      result['_allowed-tools-format'] = 'inline'; // 标记为旧格式
    }
  }

  // 解析 requires-approval（数组格式）
  const approvalMatch = yaml.match(/^requires-approval:\n((?:\s+-\s+.+\n?)+)/m);
  if (approvalMatch) {
    result['requires-approval'] = approvalMatch[1]
      .split('\n')
      .map((l) => l.trim().replace(/^-\s*/, ''))
      .filter(Boolean);
  }

  // 解析 metadata
  const authorMatch = yaml.match(/^\s+author:\s*(.+)$/m);
  if (authorMatch) {
    result.metadata = result.metadata || {};
    result.metadata.author = authorMatch[1].trim();
  }

  return result;
}

// ─── 校验规则 ─────────────────────────────────────────────────────────────────
function validate(manifest, filePath) {
  const errors = [];
  const warnings = [];
  const passed = [];

  // ✅ 规则 1：protocol 字段存在且格式正确
  if (!manifest.protocol) {
    errors.push('缺少必填字段 `protocol`，应为 "AGP/1.0"');
  } else if (!/^AGP\/\d+\.\d+$/.test(manifest.protocol)) {
    errors.push(`protocol 格式错误："${manifest.protocol}"，应为 "AGP/<版本>"，如 "AGP/1.0"`);
  } else {
    passed.push(`protocol: ${manifest.protocol}`);
  }

  // ✅ 规则 2：name 字段
  if (!manifest.name) {
    errors.push('缺少必填字段 `name`');
  } else {
    passed.push(`name: ${manifest.name}`);
  }

  // ✅ 规则 3：description 字段
  if (!manifest.description) {
    errors.push('缺少必填字段 `description`');
  } else if (manifest.description.length < 10) {
    warnings.push('`description` 建议不少于 10 个字符，以便网关意图路由精准匹配');
  } else {
    passed.push(`description: ${manifest.description.slice(0, 40)}...`);
  }

  // ✅ 规则 4：allowed-tools 必须存在且为数组格式
  if (!manifest['allowed-tools']) {
    errors.push('缺少必填字段 `allowed-tools`（AGP 核心字段！）');
  } else if (!Array.isArray(manifest['allowed-tools'])) {
    errors.push('`allowed-tools` 必须为 YAML 数组格式（每项以 "- " 开头），不能是空格分隔的字符串');
  } else if (manifest['allowed-tools'].length === 0) {
    errors.push('`allowed-tools` 不能为空数组，至少声明一个工具');
  } else {
    if (manifest['_allowed-tools-format'] === 'inline') {
      warnings.push('`allowed-tools` 使用了旧的空格分隔格式，建议升级为 YAML 数组格式');
    } else {
      passed.push(`allowed-tools: [${manifest['allowed-tools'].join(', ')}]`);
    }
  }

  // ✅ 规则 5：requires-approval 建议存在（有写操作的 Skill）
  if (!manifest['requires-approval']) {
    warnings.push('未声明 `requires-approval`。若工作流包含写操作（创建/修改/删除/提交），强烈建议添加此字段以启用 AGP 网关拦截断点');
  } else if (manifest['requires-approval'].length === 0) {
    warnings.push('`requires-approval` 为空数组，若无高危操作可省略此字段');
  } else {
    passed.push(`requires-approval: [${manifest['requires-approval'].join(', ')}]`);
  }

  // ✅ 规则 6：author 建议为 pinkcar 或团队标识
  if (manifest.metadata?.author) {
    passed.push(`author: ${manifest.metadata.author}`);
  } else {
    warnings.push('建议在 `metadata.author` 中声明作者信息');
  }

  return { errors, warnings, passed };
}

// ─── 主程序 ───────────────────────────────────────────────────────────────────
function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log(c.bold('\nAGP Manifest Validator v1.0'));
    console.log('Usage: node agp/validator/validate.js <path-to-SKILL.md>\n');
    console.log('Examples:');
    console.log('  node agp/validator/validate.js apps/gateway/skills/fix-bug/SKILL.md');
    console.log('  node agp/validator/validate.js agp/examples/fix-bug.agp.md\n');
    process.exit(0);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(c.red(`\n✗ 文件不存在: ${absolutePath}\n`));
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const manifest = parseFrontmatter(content);

  console.log(c.bold(`\n▤ AGP Manifest Validator — 校验文件: ${filePath}\n`));
  console.log('─'.repeat(60));

  if (!manifest) {
    console.error(c.red('✗ 未找到 YAML Frontmatter（以 --- 包裹的头部配置块）'));
    console.error(c.red('   请确认文件以 --- 开头的 YAML 块'));
    process.exit(1);
  }

  const { errors, warnings, passed } = validate(manifest, filePath);

  // 输出通过项
  passed.forEach((p) => console.log(c.green(`  ✓ ${p}`)));

  // 输出警告
  if (warnings.length > 0) {
    console.log('');
    warnings.forEach((w) => console.log(c.yellow(`  ⚠  ${w}`)));
  }

  // 输出错误
  if (errors.length > 0) {
    console.log('');
    errors.forEach((e) => console.log(c.red(`  ✗ ${e}`)));
  }

  console.log('─'.repeat(60));

  if (errors.length === 0) {
    console.log(c.green(c.bold(`\n✓ AGP/1.0 校验通过！${warnings.length > 0 ? `（${warnings.length} 条建议）` : ''}\n`)));
    process.exit(0);
  } else {
    console.log(c.red(c.bold(`\n✗ AGP/1.0 校验失败：${errors.length} 个错误，${warnings.length} 个警告\n`)));
    process.exit(1);
  }
}

main();
