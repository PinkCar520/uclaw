import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

@Injectable()
export class RAGService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly configService: ConfigService,
  ) {}

  private getEmbeddingModel() {
    const baseURL = this.configService.get<string>('RAG_EMBEDDING_API_BASE') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const apiKey = this.configService.get<string>('RAG_EMBEDDING_API_KEY');
    const model = this.configService.get<string>('RAG_EMBEDDING_MODEL') || 'text-embedding-v3';

    return createOpenAI({
      baseURL,
      apiKey,
    }).embedding(model);
  }

  /**
   * Index a text document into chunks and store vectors
   */
  async indexDocument(title: string, content: string, userId?: string) {
    // 1. Simple chunking (500 chars)
    const chunkSize = 500;
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }

    // 2. Generate embeddings
    const { embeddings } = await embedMany({
      model: this.getEmbeddingModel(),
      values: chunks,
    });

    // 3. Store in DB
    const doc = await this.prisma.document.create({
      data: {
        title,
        userId,
        status: 'indexed',
      }
    });

    for (let i = 0; i < chunks.length; i++) {
      await this.prisma.documentChunk.create({
        data: {
          documentId: doc.id,
          content: chunks[i],
          index: i,
          embedding: embeddings[i], // Stored as JSON array
        }
      });
    }

    return doc.id;
  }

  /**
   * Similarity search using raw SQL pgvector
   */
  async searchSimilarity(query: string, limit: number = 5) {
    // 1. Embed query
    const { embedding } = await embed({
      model: this.getEmbeddingModel(),
      value: query,
    });

    // 2. Raw SQL for vector distance (using <=> or <->)
    // Prisma Json type -> string for pgvector cast
    const vectorStr = `[${embedding.join(',')}]`;
    
    // We use a raw query because pgvector is not natively supported in Prisma 7 yet
    const results: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        dc.id, 
        dc."documentId", 
        dc.content, 
        (dc.embedding::text::vector <=> $1::vector) as distance,
        d.title
      FROM document_chunks dc
      JOIN documents d ON dc."documentId" = d.id
      ORDER BY distance ASC
      LIMIT $2
    `, vectorStr, limit);

    return results;
  }

  /**
   * List all documents
   */
  async getDocuments(userId?: string) {
    return this.prisma.document.findMany({
      where: userId ? { userId } : {},
      include: {
        _count: {
          select: { chunks: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a document and its chunks
   */
  async deleteDocument(id: string) {
    return this.prisma.document.delete({
      where: { id },
    });
  }

  /**
   * Get RAG statistics
   */
  async getStats() {
    const [docCount, chunkCount] = await Promise.all([
      this.prisma.document.count(),
      this.prisma.documentChunk.count(),
    ]);

    // Simple size estimation: each chunk is ~500 chars + embedding overhead
    const estimatedSizeMb = (chunkCount * 2) / 1024; 

    return {
      activeSources: docCount,
      totalChunks: chunkCount,
      dataIndexedMb: estimatedSizeMb.toFixed(2),
    };
  }
}
