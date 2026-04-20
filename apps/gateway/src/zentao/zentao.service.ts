import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZentaoTool } from '@uclaw/tools-zentao';
import { BugDetail } from '@uclaw/core';

@Injectable()
export class ZentaoService implements OnModuleInit {
  private zentaoTool!: ZentaoTool;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const baseUrl = this.configService.get<string>('ZENTAO_BASE_URL');
    const token = this.configService.get<string>('ZENTAO_API_TOKEN');

    this.zentaoTool = new ZentaoTool({
      baseUrl: baseUrl || '',
      token: token,
      isMock: !baseUrl, // 如果没配置 URL 则自动进入 Mock 模式
    });
  }

  async getBugInfo(bugId: string): Promise<BugDetail | null> {
    return this.zentaoTool.getBugInfo(bugId);
  }

  async searchBugs(query: string): Promise<BugDetail[]> {
    return this.zentaoTool.searchBugs(query);
  }

  async resolveBug(bugId: string): Promise<boolean> {
    return this.zentaoTool.resolveBug(bugId);
  }

  async getBugStats() {
    // 默认获取产品 ID 为 4 的统计（即您刚才创建的 UClaw 产品）
    return this.zentaoTool.getBugStats(4);
  }
}
