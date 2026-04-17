/**
 * UClaw API Client - 基于 Fetch 的社区最佳实践封装
 * 
 * 核心特性：
 * 1. 自动注入 Authorization Token
 * 2. 统一处理 HTTP 错误码 (401, 502, 504)
 * 3. 类型安全 (Generics)
 * 4. 智能 Header 处理 (JSON vs FormData)
 */

export interface ApiError extends Error {
  status?: number;
  data?: any;
}

/**
 * 核心请求函数
 */
export async function request<T>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('uclaw_auth_token');
  const headers = new Headers(options.headers);

  // 1. 自动注入鉴权 Token
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 2. 智能设置 Content-Type
  // 如果 body 是 FormData，浏览器会自动设置包含 boundary 的 Content-Type，此处不应手动覆盖
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, { ...options, headers });

    // 3. 处理成功但无内容的响应 (204 No Content)
    if (response.status === 204) return {} as T;

    // 4. 统一 HTTP 错误处理
    if (!response.ok) {
      const error: ApiError = new Error('API Request Failed');
      error.status = response.status;
      
      try {
        error.data = await response.json();
      } catch {
        error.data = { message: 'Unknown server error' };
      }

      // 4.1 自动处理登录失效
      if (response.status === 401) {
        console.error('[API] Unauthorized, redirecting to login...');
        localStorage.removeItem('uclaw_auth_token');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth';
        }
      }

      // 4.2 友好化 502/504 错误
      if (response.status === 502 || response.status === 504) {
        throw new Error('网关响应超时，请稍后重试或检查 CLI 节点状态');
      }

      throw error;
    }

    // 5. 自动解析 JSON
    return await response.json();
  } catch (err: any) {
    // 捕获网络断开等底层错误
    if (err.name === 'AbortError') throw err;
    console.error(`[API Error] ${url}:`, err.message);
    throw err;
  }
}

/**
 * 快捷方法集
 */
export const api = {
  get: <T>(url: string, options?: RequestInit) => 
    request<T>(url, { ...options, method: 'GET' }),
  
  post: <T>(url: string, data?: any, options?: RequestInit) => 
    request<T>(url, { 
      ...options, 
      method: 'POST', 
      body: data instanceof FormData ? data : JSON.stringify(data) 
    }),
  
  put: <T>(url: string, data?: any, options?: RequestInit) => 
    request<T>(url, { 
      ...options, 
      method: 'PUT', 
      body: data instanceof FormData ? data : JSON.stringify(data) 
    }),

  patch: <T>(url: string, data?: any, options?: RequestInit) => 
    request<T>(url, { 
      ...options, 
      method: 'PATCH', 
      body: data instanceof FormData ? data : JSON.stringify(data) 
    }),
  
  delete: <T>(url: string, options?: RequestInit) => 
    request<T>(url, { ...options, method: 'DELETE' }),
};

/**
 * 专门适配 Vercel AI SDK 的 Fetch 包装器
 * 解决 useChat 中的鉴权与 SSE 兼容问题
 */
export const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem('uclaw_auth_token');
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(input, { ...init, headers });
};
