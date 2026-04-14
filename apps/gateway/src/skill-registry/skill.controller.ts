import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req, HttpCode, HttpStatus, SetMetadata } from '@nestjs/common';
import { SkillService, CreateSkillDto, UpdateSkillDto } from './skill.service';
import { SkillImportService, ImportSkillDto } from './skill-import.service';
import { IS_PUBLIC_KEY } from '../auth/sso.guard';

const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller('api/skills')
export class SkillController {
  constructor(
    private readonly skillService: SkillService,
    private readonly skillImportService: SkillImportService,
  ) {}

  /**
   * GET /api/skills
   * 获取技能列表，支持筛选
   */
  @Public()
  @Get()
  async getSkills(
    @Query('category') category?: string,
    @Query('source') source?: string,
    @Query('q') q?: string,
    @Query('featured') featured?: string,
  ) {
    const skills = await this.skillService.getSkills({
      category,
      source,
      q,
      isFeatured: featured === 'true',
    });
    return { success: true, data: skills };
  }

  /**
   * GET /api/skills/stats
   * 获取技能统计信息
   */
  @Public()
  @Get('stats')
  async getStats() {
    const stats = await this.skillService.getStats();
    return { success: true, data: stats };
  }

  /**
   * GET /api/skills/:id
   * 获取技能详情
   */
  @Public()
  @Get(':id')
  async getSkill(@Param('id') id: string) {
    const skill = await this.skillService.getSkillById(id);
    return { success: true, data: skill };
  }

  /**
   * POST /api/skills
   * 创建技能（内部使用）
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSkill(@Body() body: CreateSkillDto) {
    const skill = await this.skillService.createSkill(body);
    return { success: true, data: skill };
  }

  /**
   * PUT /api/skills/:id
   * 更新技能
   */
  @Put(':id')
  async updateSkill(@Param('id') id: string, @Body() body: UpdateSkillDto) {
    const skill = await this.skillService.updateSkill(id, body);
    return { success: true, data: skill };
  }

  /**
   * DELETE /api/skills/:id
   * 删除技能
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteSkill(@Param('id') id: string) {
    await this.skillService.deleteSkill(id);
    return { success: true };
  }

  /**
   * POST /api/skills/:id/install
   * 安装技能
   */
  @Post(':id/install')
  @HttpCode(HttpStatus.CREATED)
  async installSkill(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.dbId;
    const config = body?.config || {};
    const installation = await this.skillService.installSkill(id, userId, config);
    return { success: true, data: installation };
  }

  /**
   * DELETE /api/skills/:id/install
   * 卸载技能
   */
  @Delete(':id/install')
  @HttpCode(HttpStatus.OK)
  async uninstallSkill(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.dbId;
    await this.skillService.uninstallSkill(id, userId);
    return { success: true };
  }

  /**
   * GET /api/skills/:id/install/status
   * 获取安装状态
   */
  @Public()
  @Get(':id/install/status')
  async getInstallStatus(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.dbId;
    const status = await this.skillService.getInstallationStatus(id, userId);
    return { success: true, data: status };
  }

  /**
   * POST /api/skills/import
   * 从外部源导入技能
   */
  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  async importSkill(@Body() body: ImportSkillDto) {
    try {
      const skill = await this.skillImportService.importSkill(body);
      return {
        success: true,
        data: {
          message: `Successfully imported skill "${skill.name}" from ${body.source}`,
          skill,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
