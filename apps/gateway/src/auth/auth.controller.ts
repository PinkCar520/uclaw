import { Controller, Post, Get, Delete, Body, Param, UnauthorizedException, Req, Headers, UseGuards, SetMetadata } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiKeyService, CreateApiKeyDto } from './api-key.service';
import { IS_PUBLIC_KEY } from './sso.guard';

const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  /**
   * POST /api/auth/register
   * 用户注册接口
   */
  @Public()
  @Post('register')
  async register(@Body() body: any) {
    const { email, password, name } = body;
    if (!email || !password) {
      throw new UnauthorizedException('Authentication Failed: Email and password are required.');
    }
    return this.authService.register(email, password, name);
  }

  /**
   * POST /api/auth/login
   * 用户登录接口
   */
  @Public()
  @Post('login')
  async login(@Body() body: any) {
    const { username, email, password } = body;
    const identifier = username || email;

    if (!identifier || !password) {
      throw new UnauthorizedException('Authentication Failed: Credentials required.');
    }

    const user = await this.authService.validateUser(identifier, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.authService.login(user);
  }

  /**
   * POST /api/auth/api-keys
   * 创建 API Key（用户登录后使用）
   */
  @Post('api-keys')
  async createApiKey(@Req() req: any, @Body() body: CreateApiKeyDto) {
    const userId = req.user?.dbId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.apiKeyService.createApiKey(userId, body);
  }

  /**
   * GET /api/auth/api-keys
   * 列出当前用户的所有 API Key
   */
  @Get('api-keys')
  async listApiKeys(@Req() req: any) {
    const userId = req.user?.dbId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.apiKeyService.listApiKeys(userId);
  }

  /**
   * DELETE /api/auth/api-keys/:id
   * 撤销 API Key
   */
  @Delete('api-keys/:id')
  async revokeApiKey(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.dbId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.apiKeyService.revokeApiKey(userId, id);
  }
}
