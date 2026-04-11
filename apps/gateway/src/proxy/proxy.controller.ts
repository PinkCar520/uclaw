import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

/**
 * 图片代理控制器
 * 用于代理禅道等外部服务的图片资源
 * 解决跨域和认证问题
 */
@Controller('proxy')
export class ProxyController {
  @Get('image')
  async proxyImage(@Query('url') imageUrl: string, @Res() res: Response) {
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch: ${response.statusText}` });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/png';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      return res.send(buffer);
    } catch (error: any) {
      console.error(`[Proxy] Failed to fetch image: ${imageUrl}`, error.message);
      return res.status(502).json({ 
        error: 'Failed to fetch image',
        message: error.message 
      });
    }
  }
}
