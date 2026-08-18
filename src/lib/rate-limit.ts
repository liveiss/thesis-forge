// ==============================================
// 简易内存速率限制（Serverless 友好版）
// 生产高并发建议换 Redis / Upstash Ratelimit
// ==============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 分钟
const MAX_REQUESTS_PER_WINDOW = 20;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 100;

function getKey(ip: string, window: number): string {
  return `${ip}:${Math.floor(Date.now() / window)}`;
}

function isAllowed(ip: string, window: number, max: number): { allowed: boolean; remaining: number; resetAt: number } {
  const key = getKey(ip, window);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + window;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

export function rateLimit(ip: string): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  message?: string;
} {
  // 清理过期条目（简单清理，避免内存无限增长）
  if (store.size > 10000) {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  }

  const minute = isAllowed(ip, WINDOW_MS, MAX_REQUESTS_PER_WINDOW);
  if (!minute.allowed) {
    return {
      allowed: false,
      limit: MAX_REQUESTS_PER_WINDOW,
      remaining: 0,
      resetAt: minute.resetAt,
      message: '请求过于频繁，请稍后再试',
    };
  }

  const hour = isAllowed(ip, HOURLY_WINDOW_MS, MAX_REQUESTS_PER_HOUR);
  if (!hour.allowed) {
    return {
      allowed: false,
      limit: MAX_REQUESTS_PER_HOUR,
      remaining: 0,
      resetAt: hour.resetAt,
      message: '本小时请求次数已用完，请稍后再试',
    };
  }

  return {
    allowed: true,
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: Math.min(minute.remaining, hour.remaining),
    resetAt: Math.min(minute.resetAt, hour.resetAt),
  };
}

export function getClientIp(request: Request): string {
  // Netlify / Vercel 会把真实 IP 放在这些头里
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}
