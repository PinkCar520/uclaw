import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface CreateSkillDto {
  slug: string;
  name: string;
  description?: string;
  category?: string;
  source?: string;
  sourceUrl?: string;
  version?: string;
  author?: string;
  license?: string;
  compatibility?: string;
  manifest?: any;
  content?: string;
  isFeatured?: boolean;
  isPublic?: boolean;
  icon?: string;
  tags?: string[];
}

export interface UpdateSkillDto {
  name?: string;
  description?: string;
  category?: string;
  version?: string;
  isFeatured?: boolean;
  isPublic?: boolean;
  icon?: string;
  tags?: string[];
}

export interface InstallSkillDto {
  userId?: string;
  config?: any;
}

@Injectable()
export class SkillService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: PrismaClient) {}

  async getSkills(params?: { category?: string; source?: string; q?: string; isFeatured?: boolean }) {
    const where: any = { isPublic: true };

    if (params?.category && params.category !== 'all') {
      where.category = params.category;
    }
    if (params?.source) {
      where.source = params.source;
    }
    if (params?.isFeatured) {
      where.isFeatured = true;
    }
    if (params?.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
        { tags: { has: params.q } },
      ];
    }

    const skills = await this.prisma.skill.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });

    return skills;
  }

  async getSkillById(id: string) {
    return this.prisma.skill.findUnique({ where: { id } });
  }

  async getSkillBySlug(slug: string) {
    return this.prisma.skill.findUnique({ where: { slug } });
  }

  async createSkill(data: CreateSkillDto) {
    return this.prisma.skill.create({
      data: {
        ...data,
        tags: data.tags || [],
        isFeatured: data.isFeatured ?? false,
        isPublic: data.isPublic ?? true,
        source: data.source || 'internal',
      },
    });
  }

  async updateSkill(id: string, data: UpdateSkillDto) {
    return this.prisma.skill.update({
      where: { id },
      data,
    });
  }

  async deleteSkill(id: string) {
    return this.prisma.skill.delete({ where: { id } });
  }

  async getStats() {
    const [total, newThisWeek] = await Promise.all([
      this.prisma.skill.count({ where: { isPublic: true } }),
      this.prisma.skill.count({
        where: {
          isPublic: true,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);
    return { total, newThisWeek };
  }

  // ─── Skill Installation ─────────────────────────────────────────────

  async installSkill(skillId: string, userId?: string, config?: any) {
    const existing = await this.prisma.skillInstallation.findFirst({
      where: { skillId, userId: userId || null },
    });
    if (existing) {
      // Re-enable if disabled
      return this.prisma.skillInstallation.update({
        where: { id: existing.id },
        data: { status: 'active', config: config || existing.config },
      });
    }
    return this.prisma.skillInstallation.create({
      data: {
        skillId,
        userId: userId || null,
        config: config || {},
        status: 'active',
      },
    });
  }

  async uninstallSkill(skillId: string, userId?: string) {
    return this.prisma.skillInstallation.deleteMany({
      where: { skillId, userId: userId || null },
    });
  }

  async getInstallationStatus(skillId: string, userId?: string) {
    const installation = await this.prisma.skillInstallation.findFirst({
      where: { skillId, userId: userId || null },
    });
    return {
      installed: !!installation,
      status: installation?.status || null,
      config: installation?.config || null,
    };
  }

  async getUserInstallations(userId: string) {
    return this.prisma.skillInstallation.findMany({
      where: { userId },
      include: { skill: true },
    });
  }
}
