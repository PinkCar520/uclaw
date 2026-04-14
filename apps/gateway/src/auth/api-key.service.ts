import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';

export interface CreateApiKeyDto {
  name: string;
  permissions?: string[];
  expiresAt?: Date;
}

export interface ApiKeyResponse {
  id: string;
  key: string; // 完整 key（仅创建时返回一次）
  name: string;
  permissions: string[];
  expiresAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ApiKeyListResponse {
  id: string;
  name: string;
  permissions: string[];
  expiresAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  keyPrefix: string; // uclaw_sk_xxxx... (只显示前缀)
}

@Injectable()
export class ApiKeyService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: PrismaClient) {}

  /**
   * Generate a new API key for a user
   */
  async createApiKey(userId: string, dto: CreateApiKeyDto): Promise<ApiKeyResponse> {
    // Generate key with prefix
    const randomPart = randomBytes(32).toString('hex');
    const key = `uclaw_sk_${randomPart}`;

    // Hash the key for storage
    const keyHash = createHash('sha256').update(key).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        key: keyHash,
        name: dto.name,
        permissions: dto.permissions ?? ['read', 'write', 'execute'],
        expiresAt: dto.expiresAt ?? null,
      },
    });

    return {
      id: apiKey.id,
      key, // Return full key only once
      name: apiKey.name,
      permissions: apiKey.permissions as string[],
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
    };
  }

  /**
   * Find user by API key (validates key, checks expiry and revocation)
   */
  async findUserByApiKey(apiKey: string): Promise<{ userId: string; workId: string } | null> {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const record = await this.prisma.apiKey.findUnique({
      where: { key: keyHash },
      include: { user: true },
    });

    if (!record) {
      return null;
    }

    // Check if revoked
    if (record.revoked) {
      return null;
    }

    // Check if expired
    if (record.expiresAt && record.expiresAt < new Date()) {
      return null;
    }

    // Update last used time
    await this.prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: record.user.id,
      workId: record.user.workId,
    };
  }

  /**
   * List all API keys for a user (without exposing full keys)
   */
  async listApiKeys(userId: string): Promise<ApiKeyListResponse[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId, revoked: false },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      permissions: k.permissions as string[],
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      keyPrefix: `${k.key.slice(0, 16)}...`, // Show only prefix
    }));
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revoked: true },
    });
  }
}
