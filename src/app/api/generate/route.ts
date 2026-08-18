import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';
import { supabase } from '../../../lib/supabase';

interface ModelInfo {
  id?: string | number;
}

const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PROMPT_LENGTH = 20000; // 2 万字符
const MAX_MODELS_TIMEOUT = 8000;
const MAX_CHAT_TIMEOUT = 300000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasSupabaseConfig(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

interface AuthCheckResult {
  userId: string | null;
  plan: 'free' | 'basic' | 'deep' | 'season';
  error?: { message: string; status: number; code?: string };
}

async function checkAuth(request: Request): Promise<AuthCheckResult> {
  if (!hasSupabaseConfig()) {
    // 未配置 Supabase 时走游客模式（仅开发/测试）
    return { userId: null, plan: 'free' };
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return {
      userId: null,
      plan: 'free',
      error: { message: '请先登录', status: 401, code: 'UNAUTHORIZED' },
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return {
      userId: null,
      plan: 'free',
      error: { message: '登录已过期，请重新登录', status: 401, code: 'UNAUTHORIZED' },
    };
  }

  const userId = userData.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expire')
    .eq('id', userId)
    .single();

  const plan = (profile?.plan as AuthCheckResult['plan']) || 'free';

  // season 套餐检查过期
  if (plan === 'season' && profile?.plan_expire) {
    const expire = new Date(profile.plan_expire).getTime();
    if (Date.now() > expire) {
      return {
        userId,
        plan: 'free',
        error: { message: '毕业季通行证已过期，请重新开通', status: 403, code: 'PLAN_EXPIRED' },
      };
    }
  }

  return { userId, plan };
}

async function checkUsage(
  userId: string,
  plan: AuthCheckResult['plan'],
  type: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!hasSupabaseConfig() || !userId) {
    return { allowed: true };
  }

  // 付费套餐直接放行
  if (plan === 'basic' || plan === 'deep' || plan === 'season') {
    return { allowed: true };
  }

  // free 套餐：仅允许 1 次 detect，fix 不允许
  if (plan === 'free') {
    if (type === 'fix') {
      return { allowed: false, reason: '免费用户暂不支持 AI 修改，请开通套餐' };
    }

    const { count, error } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'detect');

    if (error) {
      console.warn('[用量查询失败]', error);
      return { allowed: false, reason: '用量校验失败，请稍后重试' };
    }

    if ((count || 0) >= 1) {
      return { allowed: false, reason: '免费体验次数已用完，请开通套餐继续使用' };
    }
  }

  return { allowed: true };
}

async function recordUsage(userId: string, type: string) {
  if (!hasSupabaseConfig() || !userId) return;

  const usageType = type === 'fix' ? 'fix' : 'detect';
  const { error } = await supabase.from('usage_logs').insert({
    user_id: userId,
    type: usageType,
  });
  if (error) {
    console.warn('[用量记录失败]', error);
  }
}

export async function POST(request: Request) {
  try {
    // 1. 请求体大小限制
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: '请求体过大，请减小文件或文本内容' },
        { status: 413 }
      );
    }

    // 2. 速率限制（基于 IP）
    const clientIp = getClientIp(request);
    const limit = rateLimit(clientIp);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: limit.message || '请求过于频繁' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit.limit),
            'X-RateLimit-Remaining': String(limit.remaining),
            'X-RateLimit-Reset': String(limit.resetAt),
          },
        }
      );
    }

    // 3. 解析请求体
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    const { baseUrl, apiKey, prompt, model, type } = body;

    const envBaseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const envApiKey = process.env.API_KEY || '';
    const envModel = process.env.API_MODEL || process.env.NEXT_PUBLIC_API_MODEL || '';

    const effectiveBaseUrl = String(baseUrl || '').trim() || envBaseUrl;
    const effectiveApiKey = String(apiKey || '').trim() || envApiKey;
    const effectiveModel = String(model || '').trim() || envModel || 'deepseek-chat';
    const requestType = String(type || 'generate');

    if (!effectiveBaseUrl || !effectiveApiKey) {
      return NextResponse.json(
        { error: 'API 未配置，请在设置中补齐配置' },
        { status: 400 }
      );
    }

    // 4. baseUrl 安全校验：必须 https
    if (!isValidHttpsUrl(effectiveBaseUrl)) {
      return NextResponse.json(
        { error: 'API Base URL 必须是 https 地址' },
        { status: 400 }
      );
    }

    // 5. 用户认证 + 套餐校验
    const auth = await checkAuth(request);
    if (auth.error) {
      return NextResponse.json(
        { error: auth.error.message, code: auth.error.code },
        { status: auth.error.status }
      );
    }

    // 6. 用量额度校验
    const usage = await checkUsage(auth.userId || '', auth.plan, requestType);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.reason, code: 'QUOTA_EXCEEDED' },
        { status: 403 }
      );
    }

    const base = effectiveBaseUrl.replace(/\/+$/, '');

    // 7. prompt 长度限制（仅生成类请求）
    if (requestType !== 'models' && typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `单次检测文本过长（>${MAX_PROMPT_LENGTH} 字符），建议分章节处理` },
        { status: 400 }
      );
    }

    // 获取模型列表
    if (requestType === 'models') {
      try {
        const res = await fetch(`${base}/models`, {
          signal: AbortSignal.timeout(MAX_MODELS_TIMEOUT),
          headers: { 'Authorization': `Bearer ${effectiveApiKey}` },
        });
        if (!res.ok) {
          return NextResponse.json({ models: ['deepseek-chat', 'gpt-4o-mini', 'glm-4-flash'] });
        }
        const data = await res.json();
        let models: string[] = [];
        if (Array.isArray(data.data)) {
          models = (data.data as ModelInfo[])
            .map(m => String(m.id ?? '').trim())
            .filter(Boolean);
        } else if (Array.isArray(data.models)) {
          models = data.models;
        } else if (Array.isArray(data)) {
          models = data;
        }
        return NextResponse.json({
          models: models.length > 0 ? models : ['deepseek-chat', 'gpt-4o-mini', 'glm-4-flash'],
        });
      } catch {
        return NextResponse.json({ models: ['deepseek-chat', 'gpt-4o-mini', 'glm-4-flash'] });
      }
    }

    // 8. 生成内容
    const chatBody = JSON.stringify({
      model: effectiveModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 16384,
    });

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveApiKey}`,
      },
      body: chatBody,
      signal: AbortSignal.timeout(MAX_CHAT_TIMEOUT),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[上游 API 错误]', response.status, errorBody.slice(0, 500));
      return NextResponse.json(
        { error: `AI 服务返回错误（${response.status}），请检查 API Key 或模型配置` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim() || '';
    if (!aiResponse) {
      return NextResponse.json({ response: '', error: 'AI 返回了空内容' });
    }

    // 9. 记录用量（异步，不阻塞返回）
    await recordUsage(auth.userId || '', requestType);

    return NextResponse.json({ response: aiResponse });
  } catch (error: unknown) {
    console.error('[API 异常]', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}
