import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RpcModule } from '../chat/rpc.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    RpcModule,
  ],
  controllers: [UserController],
  providers: [],
  exports: [],
})
export class UserModule {}
