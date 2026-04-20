import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { RAGModule } from '../rag/rag.module';
import { TracingModule } from '../tracing/tracing.module';

@Module({
  imports: [RAGModule, TracingModule],
  controllers: [UploadController],
})
export class UploadModule {}
