import { BugDetail } from '@uclaw/core';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface ZentaoConfig {
  baseUrl: string;
  token?: string;
  isMock?: boolean;
}

export class ZentaoTool {
  private client: AxiosInstance | null = null;
  private isMock: boolean = true;
  private token: string = '';

  // 模拟禅道数据库 (兜底数据)
  private readonly mockBugs: BugDetail[] = [
    {
      id: 'BUG-2048',
      title: 'UI Crash: Navigation bar disappears when resizing window on iOS 16 Safari',
      status: 'active',
      assignee: 'Mei Feng Li',
      severity: 'high',
      createdAt: '2026-03-31',
      description: 'The navigation bar component fails to recalculate layout dimensions on orientation change.',
    }
  ];

  constructor(config?: ZentaoConfig) {
    if (config?.baseUrl && !config.isMock) {
      this.isMock = false;
      this.token = config.token || '';
      
      // 只在不是账号密码交换时添加全局静态 header
      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (!this.token.includes(':')) {
         headers['Token'] = this.token;
      }

      this.client = axios.create({
        baseURL: config.baseUrl,
        headers,
        timeout: 5000,
      });
    }
  }

  async getBugInfo(bugId: string): Promise<BugDetail | null> {
    console.log(`[@uclaw/tools-zentao] Fetching bug: ${bugId} (Mode: ${this.isMock ? 'Mock' : 'API'})`);

    if (this.isMock || !this.client) {
      const bug = this.mockBugs.find(b => b.id.includes(bugId) || bugId.includes(b.id));
      return bug || null;
    }

    try {
      const numericId = bugId.replace(/[^0-9]/g, '');
      let activeToken = this.token;

      // 如果提供了账号密码，则先换取临时 Token
      if (this.token.includes(':')) {
        console.log(`[@uclaw/tools-zentao] Token is account:password, exchanging for session token...`);
        const [account, password] = this.token.split(':');
        try {
          const tokenRes = await this.client.post('/api.php/v1/tokens', {
            account,
            password
          });
          activeToken = tokenRes.data.token;
          console.log(`[@uclaw/tools-zentao] Successfully obtained session token.`);
        } catch (tokenErr: any) {
          console.error(`[@uclaw/tools-zentao] Token exchange failed:`, tokenErr.message);
          // 降级使用原始 Basic Auth 尝试
        }
      }

      // 使用获取到的 Token (或原始 Token) 进行请求
      const response = await this.client.get(`/api.php/v1/bugs/${numericId}`, {
        headers: {
          'Token': activeToken,
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      if (!data || !data.id) {
        throw new Error('Could not parse bug data from response');
      }

      return {
        id: `BUG-${data.id}`,
        title: data.title,
        status: this.mapStatus(typeof data.status === 'object' ? data.status.code : data.status),
        assignee: data.assignedTo?.realname || data.assignedTo?.account || 'Unassigned',
        severity: this.mapSeverity(data.severity),
        createdAt: data.openedDate,
        description: data.steps || data.description || '',
        // 提取图片附件
        attachments: this.extractAttachments(data),
      };
    } catch (err: any) {
      console.error(`[@uclaw/tools-zentao] API Error:`, err.message);
      if (err.response) {
        console.error(`[@uclaw/tools-zentao] Status:`, err.response.status, JSON.stringify(err.response.data));
      }
      return null;
    }
  }

  /**
   * 修改 Bug 信息 (通用接口)
   */
  async updateBug(bugId: string, updateData: any): Promise<boolean> {
    console.log(`[@uclaw/tools-zentao] Updating bug: ${bugId} (Mode: API)`);
    if (this.isMock || !this.client) return true;

    try {
      const numericId = bugId.replace(/[^0-9]/g, '');
      let activeToken = this.token;

      // 获取 Session Token
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        const tokenRes = await this.client.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      // 发起 PUT 请求修改 Bug
      const response = await this.client.put(`/api.php/v1/bugs/${numericId}`, updateData, {
        headers: {
          'Token': activeToken,
          'Content-Type': 'application/json'
        }
      });

      if (response.status !== 200) {
        console.error(`[@uclaw/tools-zentao] Update Failed. Status: ${response.status}`, response.data);
        return false;
      }

      return true;
    } catch (err: any) {
      console.error(`[@uclaw/tools-zentao] Update Error:`, err.message);
      if (err.response) {
        console.error(`[@uclaw/tools-zentao] Full Error Response from ZenTao:`, JSON.stringify(err.response.data, null, 2));
      }
      return false;
    }
  }

  /**
   * 将 Bug 标记为“已解决”
   */
  async resolveBug(bugId: string, resolution: string = 'fixed'): Promise<boolean> {
    // 禅道 22.0 解决 Bug 往往需要更多的必填信息
    try {
      // 1. 先查一下这个 Bug 属于哪个版本 (resolvedBuild 必填)
      const currentBug = await this.getBugInfo(bugId);
      
      return this.updateBug(bugId, {
        status: 'resolved',
        resolution: resolution,
        resolvedBuild: 'trunk', // 默认为主干，或者从 currentBug 获取更精确的值
        resolvedDate: new Date().toISOString().split('T')[0] // 格式化日期 YYYY-MM-DD
      });
    } catch {
      return false;
    }
  }

  /**
   * 获取 Bug 统计数据
   */
  async getBugStats(productId: number = 4): Promise<{ total: number; active: number; resolved: number }> {
    console.log(`[@uclaw/tools-zentao] Fetching Bug stats for product: ${productId}`);
    if (this.isMock || !this.client) return { total: 12, active: 8, resolved: 4 };

    try {
      let activeToken = this.token;
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        const tokenRes = await this.client.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      const response = await this.client.get(`/api.php/v1/products/${productId}/bugs`, {
        headers: { 'Token': activeToken }
      });

      const bugs = response.data.bugs || [];
      return {
        total: response.data.total || bugs.length,
        active: bugs.filter((b: any) => b.status === 'active').length,
        resolved: bugs.filter((b: any) => b.status === 'resolved').length
      };
    } catch (err: any) {
      console.error(`[@uclaw/tools-zentao] Stats Error:`, err.message);
      return { total: 0, active: 0, resolved: 0 };
    }
  }

  async searchBugs(query: string): Promise<BugDetail[]> {
    console.log(`[@uclaw/tools-zentao] Searching bugs with query: ${query} (Mode: ${this.isMock ? 'Mock' : 'API'})`);
    
    if (this.isMock || !this.client) {
      const normalizedQuery = query.toLowerCase();
      return this.mockBugs.filter((bug) =>
        bug.title.toLowerCase().includes(normalizedQuery) ||
        bug.id.toLowerCase().includes(normalizedQuery)
      );
    }

    try {
      let activeToken = this.token;
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        const tokenRes = await this.client.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      const response = await this.client.get('/api.php/v1/bugs', {
        params: { title: query },
        headers: { 'Token': activeToken }
      });
      
      const items = Array.isArray(response.data.bugs) ? response.data.bugs : [];
      return items.map((data: any) => ({
        id: `BUG-${data.id}`,
        title: data.title,
        status: this.mapStatus(typeof data.status === 'object' ? data.status.code : data.status),
        assignee: data.assignedTo?.realname || data.assignedTo?.account || 'Unassigned',
        severity: this.mapSeverity(data.severity),
        createdAt: data.openedDate,
        description: '',
      }));
    } catch (err: any) {
      console.error(`[@uclaw/tools-zentao] API Search Error:`, err.message);
      return [];
    }
  }

  // ──────────────────────────────────────────────
  // Story (产品需求) 相关接口
  // ──────────────────────────────────────────────

  /**
   * 创建产品需求 (Story)
   * 禅道 22.0 API: POST /api.php/v1/products/{productId}/stories
   */
  async createStory(productId: number, data: { title: string; spec: string; pri?: number; estimate?: number }): Promise<any> {
    console.log(`[@uclaw/tools-zentao] Creating story in product: ${productId} (Mode: ${this.isMock ? 'Mock' : 'API'})`);
    if (this.isMock || !this.client) {
      return { id: `STORY-${Math.floor(Math.random() * 1000)}`, title: data.title, status: 'active' };
    }

    try {
      let activeToken = this.token;
      let openedBy = 'admin';
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        openedBy = account;
        const tokenRes = await this.client!.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      // 严格按照实测成功的 Payload 进行请求
      const response = await this.client!.post(`/api.php/v1/stories`, {
        product: Number(productId),
        module: 0,
        branch: 0,
        title: data.title,
        spec: data.spec || '需求描述',
        pri: Number(data.pri || 3),
        category: 'feature',
        type: 'story',
        estimate: Number(data.estimate || 0),
        reviewer: [openedBy], // 指派自己评审，避免静默失败
        openedBy: openedBy,
        source: 'po'
      }, {
        headers: {
          'Token': activeToken,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[@uclaw/tools-zentao] Create Story Success. Status: ${response.status}`);
      console.debug(`[@uclaw/tools-zentao] Response Body:`, JSON.stringify(response.data, null, 2));
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = err.message;
      const responseData = err.response?.data;
      console.error(`[@uclaw/tools-zentao] Create Story Error:`, errorMsg);
      if (responseData) {
        console.error(`[@uclaw/tools-zentao] Full Error Response:`, JSON.stringify(responseData, null, 2));
      }
      return { success: false, error: responseData || errorMsg };
    }
  }

  /**
   * 获取单个需求详情
   * 禅道 22.0 API: GET /api.php/v1/stories/{storyId}
   */
  async getStoryInfo(storyId: string): Promise<any> {
    console.log(`[@uclaw/tools-zentao] Fetching story: ${storyId}`);
    if (this.isMock || !this.client) {
      return { id: storyId, title: "Mock Story", status: "active", spec: "Mock story description." };
    }

    try {
      const numericId = storyId.replace(/[^0-9]/g, '');
      let activeToken = this.token;
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        const tokenRes = await this.client.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      const response = await this.client.get(`/api.php/v1/stories/${numericId}`, {
        headers: { 'Token': activeToken }
      });
      
      return response.data;
    } catch (err: any) {
      console.error(`[@uclaw/tools-zentao] Fetch Story Error:`, err.message);
      return null;
    }
  }

  /**
   * 搜索需求
   * 禅道 22.0 API: GET /api.php/v1/stories?title={query}
   */
  async searchStories(query: string): Promise<any[]> {
    console.log(`[@uclaw/tools-zentao] Searching stories: ${query}`);
    if (this.isMock || !this.client) {
      return [{ id: 'STORY-101', title: `[Mock] Search result for ${query}`, status: 'active' }];
    }

    try {
      let activeToken = this.token;
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        const tokenRes = await this.client.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      const response = await this.client.get('/api.php/v1/stories', {
        params: { title: query, status: 'all' }, // 尝试增加 status: all 避免 400
        headers: { 'Token': activeToken }
      });
      
      console.debug(`[@uclaw/tools-zentao] Search Stories Response:`, JSON.stringify(response.data, null, 2));
      return Array.isArray(response.data.stories) ? response.data.stories : [];
    } catch (err: any) {
      console.error(`[@uclaw/tools-zentao] Search Stories Error:`, err.message);
      if (err.response && err.response.data) {
        console.error(`[@uclaw/tools-zentao] Full Error Response:`, JSON.stringify(err.response.data, null, 2));
      }
      return [];
    }
  }

  /**
   * 获取所有产品列表
   * 禅道 22.0 API: GET /api.php/v1/products
   */
  async listProducts(): Promise<any[]> {
    console.log(`[@uclaw/tools-zentao] Listing products (Mode: ${this.isMock ? 'Mock' : 'API'})`);
    if (this.isMock || !this.client) {
      return [{ id: 4, name: 'Mock 产品', code: 'mock-p' }];
    }

    try {
      let activeToken = this.token;
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        const tokenRes = await this.client.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      const response = await this.client.get('/api.php/v1/products', {
        headers: { 'Token': activeToken }
      });
      
      return Array.isArray(response.data.products) ? response.data.products : [];
    } catch (err: any) {
      console.error(`[@uclaw/tools-zentao] List Products Error:`, err.message);
      return [];
    }
  }

  /**
   * 创建一个新产品
   * 禅道 22.0 API: POST /api.php/v1/products
   */
  async createProduct(data: { name: string; code: string; type?: string; desc?: string }): Promise<any> {
    console.log(`[@uclaw/tools-zentao] Creating product: ${data.name} (Mode: ${this.isMock ? 'Mock' : 'API'})`);
    if (this.isMock || !this.client) {
      return { id: 10, name: data.name, code: data.code };
    }

    try {
      let activeToken = this.token;
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        const tokenRes = await this.client.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      const response = await this.client.post('/api.php/v1/products', {
        name: data.name,
        code: data.code,
        type: data.type || 'normal',
        desc: data.desc || '',
      }, {
        headers: {
          'Token': activeToken,
          'Content-Type': 'application/json'
        }
      });
      
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = err.message;
      const responseData = err.response?.data;
      console.error(`[@uclaw/tools-zentao] Create Product Error:`, errorMsg);
      if (responseData) {
        console.error(`[@uclaw/tools-zentao] Full Error Response:`, JSON.stringify(responseData, null, 2));
      }
      return { success: false, error: responseData || errorMsg };
    }
  }

  /**
   * 创建一个新项目 (Project/Execution)
   * 禅道 22.0 API: POST /api.php/v1/projects
   * 注：从 18.0 开始，项目创建必须包含关联的产品数组 products: [ID, ...]
   */
  async createProject(data: { name: string; code: string; begin: string; end: string; desc?: string; type?: string; productIds?: number[] }): Promise<any> {
    console.log(`[@uclaw/tools-zentao] Creating project: ${data.name} (Mode: ${this.isMock ? 'Mock' : 'API'})`);
    if (this.isMock || !this.client) {
      return { id: 20, name: data.name, code: data.code };
    }

    try {
      let activeToken = this.token;
      if (this.token.includes(':')) {
        const [account, password] = this.token.split(':');
        const tokenRes = await this.client.post('/api.php/v1/tokens', { account, password });
        activeToken = tokenRes.data.token;
      }

      const response = await this.client.post('/api.php/v1/projects', {
        name: data.name,
        code: data.code,
        begin: data.begin,
        end: data.end,
        type: data.type || 'project',
        desc: data.desc || '',
        products: data.productIds || [], // 修复 400 错误：项目必须关联产品
      }, {
        headers: {
          'Token': activeToken,
          'Content-Type': 'application/json'
        }
      });
      
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = err.message;
      const responseData = err.response?.data;
      console.error(`[@uclaw/tools-zentao] Create Project Error:`, errorMsg);
      if (responseData) {
        console.error(`[@uclaw/tools-zentao] Full Error Response:`, JSON.stringify(responseData, null, 2));
      }
      return { success: false, error: responseData || errorMsg };
    }
  }

  private mapStatus(status: string): 'active' | 'resolved' | 'closed' {
    const s = status.toLowerCase();
    if (s === 'active' || s === 'doing' || s === 'opened') return 'active';
    if (s === 'resolved' || s === 'done') return 'resolved';
    return 'closed';
  }

  private mapSeverity(severity: any): 'high' | 'medium' | 'low' {
    const s = Number(severity);
    if (s === 1 || s === 2) return 'high';
    if (s === 3) return 'medium';
    return 'low';
  }

  /**
   * 从禅道 Bug 数据中提取图片附件
   * 禅道通常在 files 或 attachments 字段中返回附件列表
   */
  private extractAttachments(data: any): Array<{ url: string; name?: string; contentType?: string }> {
    const attachments: Array<{ url: string; name?: string; contentType?: string }> = [];
    
    // 尝试多种可能的附件字段名
    const filesData = data.files || data.attachments || data.pics || [];
    
    if (Array.isArray(filesData)) {
      for (const file of filesData) {
        // 只提取图片类型
        const contentType = file.type || file.contentType || file.extension || '';
        const isImage = contentType.startsWith('image/') || 
                        /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(file.name || file.title || file.path || '');
        
        if (isImage && (file.url || file.path || file.downloadUrl)) {
          attachments.push({
            url: file.url || file.path || file.downloadUrl,
            name: file.name || file.title || file.realname || 'image',
            contentType: contentType.startsWith('image/') ? contentType : undefined,
          });
        }
      }
    }

    // 如果 description 中包含 <img> 标签，也提取出来
    const description = data.description || data.steps || '';
    if (description) {
      const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
      let match;
      while ((match = imgRegex.exec(description)) !== null) {
        const imgSrc = match[1];
        if (imgSrc && !attachments.find(a => a.url === imgSrc)) {
          // 提取 alt 文本作为 name
          const altMatch = match[0].match(/alt="([^"]*)"/i);
          attachments.push({
            url: imgSrc,
            name: altMatch ? altMatch[1] : 'screenshot',
            contentType: 'image/png',
          });
        }
      }
    }

    return attachments;
  }
}
