import { Controller, Get, Post, Query, Body, Req, Res, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { OAuthService } from './oauth.service';
import { IS_PUBLIC_KEY } from './sso.guard';

const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller('api/auth')
export class OAuthController {
  constructor(private oauthService: OAuthService) {}

  /**
   * GET /api/auth/oauth/authorize
   * OAuth authorize page -- shows login form or redirects if already logged in.
   * Query params: client_id, redirect_uri, state, response_type
   */
  @Public()
  @Get('oauth/authorize')
  async oauthAuthorize(
    @Query('redirect_uri') redirectUri: string,
    @Query('state') state: string,
    @Query('port') port: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    // If user is already authenticated via JWT
    if (req.user?.workId) {
      const code = this.oauthService.generateAuthCode(req.user.dbId, req.user.workId);
      const callbackUrl = redirectUri || `http://localhost:${port}/callback`;
      const separator = callbackUrl.includes('?') ? '&' : '?';
      const finalUrl = `${callbackUrl}${separator}code=${code}&state=${state || ''}`;
      return res.redirect(finalUrl);
    }

    // Show login page with OAuth redirect
    const gatewayUrl = process.env.UCLAW_GATEWAY_URL || 'http://localhost:3000';
    const html = `<!DOCTYPE html>
<html>
<head><title>UClaw Login</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#f6f3f2;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#fff;border-radius:16px;padding:40px;width:100%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
  h1{font-size:24px;font-weight:700;color:#1c1b1b;margin-bottom:8px}
  p{color:#716b67;font-size:14px;margin-bottom:24px}
  input{width:100%;padding:12px 16px;border:2px solid #e8e4e2;border-radius:8px;font-size:14px;margin-bottom:12px;outline:none;transition:border .2s}
  input:focus{border-color:#ec5b14}
  button{width:100%;padding:12px;background:#ec5b14;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:background .2s}
  button:hover{background:#d4500f}
  button:disabled{opacity:.5;cursor:not-allowed}
  .error{color:#e53e3e;font-size:13px;margin-bottom:12px}
  .logo{text-align:center;margin-bottom:24px;font-size:32px;font-weight:800;color:#ec5b14}
</style>
</head>
<body>
<div class="card">
  <div class="logo">UClaw</div>
  <h1>Sign in to continue</h1>
  <p>Enter your credentials to authorize the CLI application.</p>
  <div id="error" class="error" style="display:none"></div>
  <form id="loginForm" onsubmit="handleLogin(event)">
    <input type="email" id="email" placeholder="Email" required autocomplete="email" />
    <input type="password" id="password" placeholder="Password" required autocomplete="current-password" />
    <button type="submit" id="submitBtn">Sign In & Authorize</button>
  </form>
</div>
<script>
  const redirectUri = '${redirectUri || ''}';
  const state = '${state || ''}';
  const port = '${port || ''}';

  async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const err = document.getElementById('error');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    err.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
        }),
      });
      const data = await res.json();
      if (!data.access_token) {
        err.textContent = data.message || 'Login failed';
        err.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Sign In & Authorize';
        return;
      }

      // Now redirect to authorize endpoint with JWT
      const url = '/api/auth/oauth/callback?token=' + encodeURIComponent(data.access_token) +
        (redirectUri ? '&redirect_uri=' + encodeURIComponent(redirectUri) : '') +
        (state ? '&state=' + encodeURIComponent(state) : '') +
        (port ? '&port=' + encodeURIComponent(port) : '');
      window.location.href = url;
    } catch (ex) {
      err.textContent = 'Network error: ' + ex.message;
      err.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In & Authorize';
    }
  }
</script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * GET /api/auth/oauth/callback
   * Internal endpoint: receives JWT token after login, generates code, redirects to CLI callback.
   */
  @Public()
  @Get('oauth/callback')
  async oauthCallback(
    @Query('token') token: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('state') state: string,
    @Query('port') port: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedException('Missing token.');
    }

    // Decode JWT to get user info
    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    } catch {
      throw new UnauthorizedException('Invalid token.');
    }

    // Generate auth code
    const code = this.oauthService.generateAuthCode(payload.sub, payload.workId);

    // Redirect to CLI local callback
    const callbackUrl = redirectUri || `http://localhost:${port}/callback`;
    const separator = callbackUrl.includes('?') ? '&' : '?';
    const finalUrl = `${callbackUrl}${separator}code=${code}&state=${state || ''}`;
    res.redirect(finalUrl);
  }

  /**
   * POST /api/auth/oauth/token
   * Exchange auth code for API Key (called by CLI callback server).
   */
  @Public()
  @Post('oauth/token')
  async exchangeToken(@Body() body: { code: string; name?: string }) {
    if (!body.code) {
      throw new UnauthorizedException('Missing code.');
    }

    const result = await this.oauthService.exchangeCodeForApiKey(body.code, body.name || 'CLI Login');
    if (!result) {
      throw new UnauthorizedException('Invalid or expired code.');
    }
    return result;
  }
}
