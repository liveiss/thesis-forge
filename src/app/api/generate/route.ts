import { NextResponse } from 'next/server';

interface ModelInfo {
  id?: string | number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  try {
    const { baseUrl, apiKey, prompt, model, type } = await request.json();

    const envBaseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const envApiKey = process.env.API_KEY || '';
    const envModel = process.env.API_MODEL || process.env.NEXT_PUBLIC_API_MODEL || '';

    const effectiveBaseUrl = String(baseUrl || '').trim() || envBaseUrl;
    const effectiveApiKey = String(apiKey || '').trim() || envApiKey;
    const effectiveModel = String(model || '').trim() || envModel || 'deepseek-chat';

    if (!effectiveBaseUrl || !effectiveApiKey) {
      return NextResponse.json(
        { error: 'API 未配置，请在服务端环境变量或页面设置中补齐配置' },
        { status: 400 }
      );
    }

    // 获取模型列表
    if (type === 'models') {
      const base = effectiveBaseUrl.replace(/\/+$/, '');
      try {
        const res = await fetch(`${base}/models`, {
          signal: AbortSignal.timeout(8000),
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

    // 生成内容
    const base = effectiveBaseUrl.replace(/\/+$/, '');
    const url = `${base}/chat/completions`;

    const body = JSON.stringify({
      model: effectiveModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 16384,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveApiKey}`,
      },
      body,
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `API Error: ${response.status} - ${errorBody.substring(0, 500)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim() || '';
    if (!aiResponse) {
      return NextResponse.json({ response: '', error: 'AI 返回了空内容' });
    }

    return NextResponse.json({ response: aiResponse });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Server Error: ${errorMessage(error)}` },
      { status: 500 }
    );
  }
}
