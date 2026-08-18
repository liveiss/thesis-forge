import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { parseCookies } from '../../../lib/cookies';

const PLAN_PRICES: Record<string, number> = {
  basic: 1990, // ¥19.90
  deep: 3990,  // ¥39.90
  season: 9900, // ¥99.00
};

const PLAN_DURATIONS: Record<string, number> = {
  basic: 7,
  deep: 7,
  season: 90,
};

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    const token = cookies['sb-access-token'];

    if (!token) {
      return NextResponse.json({ error: '请先登录', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: '登录已过期', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = userData.user.id;
    let body: { code?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    const code = String(body.code || '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: '请输入激活码', code: 'MISSING_CODE' }, { status: 400 });
    }

    // 查询激活码（使用 service role 绕过 RLS）
    const { data: redemption, error: findError } = await supabaseAdmin
      .from('redemption_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (findError || !redemption) {
      return NextResponse.json({ error: '激活码不存在', code: 'INVALID_CODE' }, { status: 404 });
    }

    if (redemption.used_by && redemption.used_by !== userId) {
      return NextResponse.json({ error: '激活码已被使用', code: 'CODE_USED' }, { status: 409 });
    }

    if (redemption.used_by === userId) {
      return NextResponse.json({ error: '您已使用过该激活码', code: 'CODE_USED_SELF' }, { status: 409 });
    }

    const plan = redemption.plan as 'basic' | 'deep' | 'season';
    const durationDays = redemption.duration_days ?? PLAN_DURATIONS[plan] ?? 7;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // 标记激活码已使用
    const { error: updateCodeError } = await supabaseAdmin
      .from('redemption_codes')
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq('id', redemption.id)
      .is('used_by', null);

    if (updateCodeError) {
      console.error('[激活码更新失败]', updateCodeError);
      return NextResponse.json({ error: '兑换失败，请稍后重试', code: 'REDEEM_FAILED' }, { status: 500 });
    }

    // 更新用户 profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ plan, plan_expire: expiresAt, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (profileError) {
      console.error('[Profile 更新失败]', profileError);
      return NextResponse.json({ error: '开通套餐失败', code: 'PROFILE_UPDATE_FAILED' }, { status: 500 });
    }

    // 写入 subscription 记录
    const { error: subError } = await supabaseAdmin.from('subscriptions').insert({
      user_id: userId,
      plan,
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    if (subError) {
      console.error('[Subscription 写入失败]', subError);
    }

    // 写入订单记录（用于对账）
    const { error: orderError } = await supabaseAdmin.from('orders').insert({
      user_id: userId,
      plan,
      amount: PLAN_PRICES[plan],
      currency: 'CNY',
      status: 'paid',
      provider: 'redemption_code',
      paid_at: new Date().toISOString(),
    });

    if (orderError) {
      console.error('[订单记录失败]', orderError);
    }

    return NextResponse.json({
      ok: true,
      plan,
      expiresAt,
      message: `成功开通「${plan === 'basic' ? '单篇基础' : plan === 'deep' ? '单篇深度' : '毕业季通行证'}」`,
    });
  } catch (error: unknown) {
    console.error('[激活码兑换异常]', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
