import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';

export interface AuthCodeRecord {
  code: string;
  userId: string;
  workId: string;
  createdAt: number;
}

/**
 * Simple in-memory auth code store (codes expire in 5 minutes)
 * For production, use Redis or the database.
 */
const codeStore = new Map<string, AuthCodeRecord>();
const CODE_EXPIRY_MS = 5 * 60 * 1000;

@Injectable()
export class OAuthService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: PrismaClient) {}

  /**
   * Step 1: Generate an authorization code for a logged-in user.
   * Called after user completes login on the web.
   */
  generateAuthCode(userId: string, workId: string): string {
    const code = randomBytes(32).toString('hex');
    codeStore.set(code, {
      code,
      userId,
      workId,
      createdAt: Date.now(),
    });
    // Auto-cleanup after expiry
    setTimeout(() => codeStore.delete(code), CODE_EXPIRY_MS);
    return code;
  }

  /**
   * Step 2: Validate and consume an auth code.
   * Returns user info or null if invalid/expired.
   */
  async consumeAuthCode(code: string): Promise<{ userId: string; workId: string } | null> {
    const record = codeStore.get(code);
    if (!record) return null;

    // Check expiry
    if (Date.now() - record.createdAt > CODE_EXPIRY_MS) {
      codeStore.delete(code);
      return null;
    }

    // Consume (one-time use)
    codeStore.delete(code);
    return { userId: record.userId, workId: record.workId };
  }

  /**
   * Step 3: Generate an API key for the user identified by the auth code.
   */
  async exchangeCodeForApiKey(code: string, keyName: string): Promise<{ key: string; workId: string } | null> {
    const user = await this.consumeAuthCode(code);
    if (!user) return null;

    // Generate API key
    const randomPart = randomBytes(32).toString('hex');
    const key = `uclaw_sk_${randomPart}`;
    const keyHash = createHash('sha256').update(key).digest('hex');

    await this.prisma.apiKey.create({
      data: {
        userId: user.userId,
        key: keyHash,
        name: keyName || 'CLI Login',
        permissions: ['read', 'write', 'execute'],
      },
    });

    return { key, workId: user.workId };
  }
}
