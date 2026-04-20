import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RAGService } from './rag.service';
import { RAGController } from './rag.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [RAGController],
  providers: [RAGService],
  exports: [RAGService],
})
export class RAGModule {}
