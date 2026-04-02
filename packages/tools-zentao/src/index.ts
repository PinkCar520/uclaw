import { BugDetail } from '@uclaw/types';
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
      
      let authHeader = '';
      // 如果 token 包含冒号，则视为 username:password 并进行 Base64 编码
      if (this.token.includes(':')) {
        const base64Auth = Buffer.from(this.token).toString('base64');
        authHeader = `Basic ${base64Auth}`;
      } else {
        // 否则视为静态 Token
        authHeader = `Token ${this.token}`;
      }

      this.client = axios.create({
        baseURL: config.baseUrl,
        headers: {
          'Authorization': authHeader,
          'Token': this.token, // 兼容性保留
          'Content-Type': 'application/json',
        },
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
}
