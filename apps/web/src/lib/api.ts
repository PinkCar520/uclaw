/**
 * 🔄 旧版 API 桥接层
 * 建议逐步迁移至使用 ./api-client.ts
 */
import { api, authFetch, request } from './api-client';

export { api, authFetch, request };

/**
 * 为了兼容旧代码中的 apiFetch 调用
 */
export async function apiFetch(url: string, options: RequestInit = {}, token?: string | null) {
  return request(url, options);
}
