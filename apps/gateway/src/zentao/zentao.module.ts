import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZentaoService } from './zentao.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ZentaoService],
  exports: [ZentaoService],
})
export class ZentaoModule {}
