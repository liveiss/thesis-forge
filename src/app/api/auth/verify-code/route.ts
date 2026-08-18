import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '../../../../lib/supabase';
import { setCookie } from '../../../../lib/cookies';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = String(body.phone || '').trim();
    const token = String(body.code || '').trim();

    if (!/^1\d{10}$/.test(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json({ error: '验证码格式不正确' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { error: error?.message || '验证失败' },
        { status: 401 }
      );
    }

    // 确保 profile 存在
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        phone,
        plan: 'free',
      });
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        phone,
      },
    });

    // 设置 cookie，有效期 7 天
    response.headers.set('Set-Cookie', setCookie('sb-access-token', data.session.access_token, 7 * 24 * 60 * 60));

    return response;
  } catch (error: unknown) {
    console.error('[验证验证码异常]', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
