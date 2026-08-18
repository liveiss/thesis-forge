import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { parseCookies } from '../../../lib/cookies';

async function getUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies['sb-access-token'];
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, title, data, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[获取项目列表失败]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }

  const projects = (data || []).map(row => {
    const proj = row.data as Record<string, unknown>;
    const sections = Array.isArray(proj?.sections) ? proj.sections : [];
    return {
      id: row.id,
      title: row.title || String(proj?.title || ''),
      sectionCount: sections.length,
      wordCount: sections.reduce((sum: number, s: Record<string, unknown>) => sum + (Number(s.wordCount) || 0), 0),
      createdAt: row.created_at || String(proj?.createdAt || ''),
      updatedAt: row.updated_at || String(proj?.updatedAt || ''),
    };
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const project = body.project as Record<string, unknown>;
  const diagnostics = body.diagnostics as Record<string, unknown> || {};
  const report = body.report as Record<string, unknown> | null;

  if (!project || !project.title) {
    return NextResponse.json({ error: '项目数据不完整' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dataPayload = {
    ...project,
    diagnostics,
    report,
    createdAt: now,
    updatedAt: now,
  };

  const { error } = await supabaseAdmin.from('projects').upsert({
    id: projectId,
    user_id: user.id,
    title: String(project.title),
    type: String(project.type || 'thesis'),
    major: String(project.major || ''),
    citation_style: String(project.citationStyle || 'gb'),
    word_limit: Number(project.wordLimit) || 8000,
    data: dataPayload,
    created_at: now,
    updated_at: now,
  }, { onConflict: 'id' });

  if (error) {
    console.error('[保存项目失败]', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: projectId });
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[删除项目失败]', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
