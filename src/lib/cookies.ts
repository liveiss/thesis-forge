// 简易 cookie 读写工具（服务端 + 客户端共用）

export function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  const maxAge = maxAgeSeconds > 0 ? `Max-Age=${maxAgeSeconds}` : '';
  const secure = process.env.NODE_ENV === 'production' ? 'Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; ${maxAge} ${secure}`.trim();
}

export function clearCookie(name: string): string {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure' : '';
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0 ${secure}`.trim();
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  cookieHeader.split(';').forEach(part => {
    const [name, ...rest] = part.trim().split('=');
    if (name) {
      result[name] = decodeURIComponent(rest.join('=') || '');
    }
  });
  return result;
}
