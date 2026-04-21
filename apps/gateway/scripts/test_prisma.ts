import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/uclaw?schema=public' });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const doc = await prisma.document.create({
      data: {
        title: 'test doc',
        status: 'processing'
      }
    });

    await prisma.documentChunk.createMany({
      data: [{
        id: 'chunk1',
        documentId: doc.id,
        content: 'test content',
        index: 0
      }]
    });
    console.log('Success!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
