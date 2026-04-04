import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  app.enableCors(); // allow cross-origin requests

  // Increase payload limits for large image/attachment uploads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  
  // Serve static files from 'public' directory
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
  });
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
