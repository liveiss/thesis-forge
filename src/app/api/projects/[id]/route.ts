import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { parseCookies } from '../../../../lib/cookies';

async function getUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies['sb-access-token'];
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('user_id', user.id)
    .eq('id', id)
    .single();

  if (error || !data?.data) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  return NextResponse.json({ project: data.data });
}
