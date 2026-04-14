/**
 * Seed MCP Servers from mcp.config.json into the database.
 * Run with: npx ts-node --transpile-only src/mcp-server/seed-mcp-servers.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/uclaw?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('▸ Seeding MCP Servers from mcp.config.json...');

  const configPath = path.join(__dirname, '../../mcp.config.json');
  if (!fs.existsSync(configPath)) {
    console.log('  ⚠  mcp.config.json not found, skipping.');
    return;
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  const servers = config.mcpServers || [];

  const categoryMap: Record<string, string> = {
    'ZenTao': 'pm',
    'Jenkins': 'cicd',
    'GitLab': 'vc',
    'Local': 'data_science',
  };

  for (const srv of servers) {
    const existing = await prisma.mCPServer.findFirst({ where: { name: srv.name } });
    const category = categoryMap[srv.name.split(' ')[0]] || null;

    if (existing) {
      await prisma.mCPServer.update({
        where: { id: existing.id },
        data: {
          description: srv.description || existing.description,
          command: srv.command || existing.command,
          args: srv.args,
          env: srv.env,
          enabled: srv.enabled ?? existing.enabled,
          category: category || existing.category,
        },
      });
      console.log(`  ✓ Updated ${srv.name}`);
    } else {
      await prisma.mCPServer.create({
        data: {
          name: srv.name,
          description: srv.description,
          command: srv.command,
          args: srv.args,
          env: srv.env,
          enabled: srv.enabled ?? true,
          status: 'unknown',
          transport: 'stdio',
          category,
        },
      });
      console.log(`  ✓ Created ${srv.name}`);
    }
  }

  console.log('✓ MCP Server seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
