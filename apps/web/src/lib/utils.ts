import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 修复禅道图片 URL
 * 禅道返回的相对路径如 index.php?m=file&f=read&t=png&fileID=1
 * 需要通过后端代理或转换为完整 URL
 */
export function fixZenTaoImageUrl(url: string, baseUrl?: string): string {
  // 如果已经是完整 URL 或 data URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  
  // 如果是相对路径，拼接 baseUrl
  if (baseUrl) {
    const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    return base + url;
  }
  
  // 否则通过我们的代理端点
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}
