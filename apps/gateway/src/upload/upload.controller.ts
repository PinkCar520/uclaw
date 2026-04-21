import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Req, Body } from '@nestjs/common';
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
    storage: diskStorage({
      destination: './public/uploads/rag',
      filename: (req, file, callback) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = extname(file.originalname);
        callback(null, `${uniqueSuffix}${ext}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for RAG
  }))
  async uploadForRag(
    @UploadedFile() file: Express.Multer.File, 
    @Body('projectId') projectId: string,
    @Req() req: any
  ) {
    if (!file) throw new BadRequestException('No file provided');

    // Basic extension check before starting background task
    const allowedExtensions = [
      '.txt', '.md', '.json', '.csv',
      '.js', '.ts', '.jsx', '.tsx', '.py',
      '.yml', '.yaml', '.xml', '.html', '.htm',
      '.log', '.sql', '.sh',
    ];
    const ext = extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      // If we used diskStorage, we might want to delete the file here if it's invalid
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new BadRequestException(
        `Unsupported file type "${ext || 'unknown'}". Allowed: ${allowedExtensions.join(', ')}`
      );
    }

    const userId = req.user?.workId || 'system';

    // 1. Create the document record immediately with 'processing' status
    const document = await this.ragService.createDocumentRecord({
      title: file.originalname,
      sourceUrl: file.path, // Store the local path for the background worker
      projectId,
      userId,
    });

    // 2. Trigger background indexing (don't await)
    // We use a safe wrapper to ensure errors don't crash the main thread
    this.ragService.startAsyncIndexing(document.id, file.path).catch(err => {
      console.error(`[Background Task Error] Failed to start indexing for ${document.id}:`, err);
    });

    // 3. Return immediately to the user
    return {
      success: true,
      documentId: document.id,
      status: 'processing',
      message: 'File received and is being processed in the background',
    };
  }
}
