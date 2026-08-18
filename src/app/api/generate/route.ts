import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

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

    const base = effectiveBaseUrl.replace(/\/+$/, '');

    // 5. prompt 长度限制（仅生成类请求）
    if (type !== 'models' && typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `单次检测文本过长（>${MAX_PROMPT_LENGTH} 字符），建议分章节处理` },
        { status: 400 }
      );
    }

    // 获取模型列表
    if (type === 'models') {
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

    // 6. 生成内容
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
      // 安全：不直接把上游错误详情返回给前端，只返回状态码
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

    return NextResponse.json({ response: aiResponse });
  } catch (error: unknown) {
    console.error('[API 异常]', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}
