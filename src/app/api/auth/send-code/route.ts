import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = String(body.phone || '').trim();

    if (!/^1\d{10}$/.test(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
    }

    const { error } = await supabase.auth.signInWithOtp({ phone });

    if (error) {
      console.error('[发送验证码失败]', error);
      console.error('[发送验证码失败原因]', (error as any).cause || '无 cause');
      return NextResponse.json({ error: error.message || '发送失败' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[发送验证码异常]', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
