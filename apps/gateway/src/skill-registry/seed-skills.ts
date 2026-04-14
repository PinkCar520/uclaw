/**
 * Seed built-in skills into the database.
 * Run with: DATABASE_URL="postgresql://..." npx ts-node --transpile-only src/skill-registry/seed-skills.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/uclaw?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const builtInSkills = [
  {
    slug: 'fix-bug',
    name: 'Fix Bug',
    description: '修复禅道缺陷的完整全链路工作流：拉取缺陷详情、分析相关代码、应用修复、Git 提交并在禅道关闭缺陷。',
    category: 'pm',
    source: 'internal',
    version: '1.1',
    author: 'pinkcar',
    license: 'Proprietary',
    compatibility: '需要 mcp-zentao MCP Server 和本地 CLI 节点在线（RPC 通道）',
    icon: 'CheckCircle2',
    tags: ['zentao', 'bug-fix', 'git'],
    isFeatured: true,
    isPublic: true,
  },
  {
    slug: 'write-prd',
    name: 'Write PRD',
    description: '产品经理的智能需求助手：起草 PRD (产品需求文档) 并将其发布到禅道。当用户要求写需求、规划产品、创建 Story 时使用。',
    category: 'pm',
    source: 'internal',
    version: '1.1',
    author: 'pinkcar',
    license: 'Proprietary',
    compatibility: '需要 mcp-zentao MCP Server',
    icon: 'CheckCircle2',
    tags: ['zentao', 'prd', 'product'],
    isFeatured: false,
    isPublic: true,
  },
  {
    slug: 'jenkins',
    name: 'Jenkins CI/CD',
    description: 'Interact with Jenkins CI/CD server via REST API. Trigger builds, check build status, view console output, manage jobs.',
    category: 'cicd',
    source: 'internal',
    version: '1.0',
    author: 'uclaw',
    license: 'Proprietary',
    compatibility: '需要 JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN 环境变量',
    icon: 'Rocket',
    tags: ['jenkins', 'cicd', 'build', 'deploy'],
    isFeatured: false,
    isPublic: true,
  },
  {
    slug: 'gitlab',
    name: 'GitLab Integration',
    description: 'GitLab CI/CD 流水线管理与 Merge Request 操作。支持触发流水线、查询状态、创建和管理 MR。',
    category: 'vc',
    source: 'internal',
    version: '1.0',
    author: 'uclaw',
    license: 'Proprietary',
    compatibility: '需要 mcp-gitlab MCP Server',
    icon: 'GitPullRequest',
    tags: ['gitlab', 'mr', 'pipeline'],
    isFeatured: false,
    isPublic: true,
  },
];

async function main() {
  console.log('▸ Seeding built-in skills...');

  for (const skill of builtInSkills) {
    const existing = await prisma.skill.findUnique({ where: { slug: skill.slug } });
    if (existing) {
      console.log(`  ⏭  ${skill.slug} already exists, skipping.`);
      continue;
    }
    await prisma.skill.create({ data: skill });
    console.log(`  ✓ Created ${skill.slug}`);
  }

  console.log('✓ Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
