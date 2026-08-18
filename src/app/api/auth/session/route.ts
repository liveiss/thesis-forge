import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { parseCookies } from '../../../../lib/cookies';

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    const token = cookies['sb-access-token'];

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, plan_expire')
      .eq('id', data.user.id)
      .single();

    return NextResponse.json({
      user: {
        id: data.user.id,
        phone: data.user.phone || '',
        plan: profile?.plan || 'free',
        planExpire: profile?.plan_expire || null,
      },
    });
  } catch (error: unknown) {
    console.error('[获取 session 异常]', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
