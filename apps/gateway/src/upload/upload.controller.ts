import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { RAGService } from '../rag/rag.service';
import { TracingService } from '../tracing/tracing.service';
import * as fs from 'fs';

@Controller('api/upload')
export class UploadController {
  constructor(
    private readonly ragService: RAGService,
    private readonly tracingService: TracingService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './public/uploads',
      filename: (req, file, callback) => {
        const uniqueSuffix = randomUUID();
        const ext = extname(file.originalname);
        callback(null, `${uniqueSuffix}${ext}`);
      },
    }),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    // Construct the URL to access the file
    // Assumes the app is serving static assets from /public as prefix
    const url = `/public/uploads/${file.filename}`;
    
    return {
      success: true,
      url,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  @Post('rag')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for RAG
  }))
  async uploadForRag(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('No file provided');
    
    const allowedExtensions = ['.txt', '.md', '.json', '.js', '.ts', '.py'];
    const ext = extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException(`Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`);
    }

    const userId = req.user?.workId || 'system';
    const content = file.buffer.toString('utf-8');

    return await this.tracingService.traceCall('RAG Indexing', { 
      filename: file.originalname, 
      userId 
    }, async (span) => {
      const documentId = await this.ragService.indexDocument(
        file.originalname,
        content,
        userId
      );
      
      span.setAttribute('document_id', documentId);
      span.setAttribute('content_length', content.length);

      return {
        success: true,
        documentId,
        message: `Successfully indexed ${file.originalname}`,
      };
    });
  }
}
