import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  constructor(
    private configService: ConfigService,
  ) { }

  /**
   * 获取当前网关配置的模型列表 (供前端动态展示)
   * ⚠️ 注意：前端应优先迁移到使用 SkillOrchestrator.getAvailableModels()
   */
  getAvailableModels() {
    const modelsRaw = this.configService.get<string>('VLLM_MODEL_NAME') || 'qwen2.5-coder:7b';
    return modelsRaw.split(',').map((id) => {
      const modelId = id.trim();
      const isCloud = modelId.includes('deepseek') || modelId.includes('omni') || modelId.includes('qwen');
      
      return {
        id: modelId,
        name: modelId,
        provider: isCloud ? 'Alibaba Bailian' : 'Private Ollama',
        icon: isCloud ? 'Cloud' : 'Cpu',
        color: isCloud ? 'text-orange-500' : 'text-blue-500',
      };
    });
  }
}
