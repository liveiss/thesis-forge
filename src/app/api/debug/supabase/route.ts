import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const results: Record<string, any> = {
    url,
    hasUrl: !!url,
    timestamp: new Date().toISOString(),
    fetchTests: {} as Record<string, any>,
  };

  if (!url) {
    return NextResponse.json({ error: '未配置 SUPABASE_URL' }, { status: 500 });
  }

  const targets = [
    { name: 'supabase_auth_settings', url: `${url}/auth/v1/settings` },
    { name: 'supabase_health', url: `${url}/rest/v1/` },
    { name: 'google', url: 'https://www.google.com/generate_204' },
  ];

  for (const t of targets) {
    try {
      const start = Date.now();
      const res = await fetch(t.url, {
        method: 'GET',
        headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
      });
      results.fetchTests[t.name] = {
        ok: res.ok,
        status: res.status,
        duration: Date.now() - start,
      };
    } catch (err: any) {
      results.fetchTests[t.name] = {
        ok: false,
        error: err.message,
        cause: err.cause ? String(err.cause) : null,
      };
    }
  }

  return NextResponse.json(results);
}
