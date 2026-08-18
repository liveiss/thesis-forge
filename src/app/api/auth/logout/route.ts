import { NextResponse } from 'next/server';
import { clearCookie } from '../../../../lib/cookies';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', clearCookie('sb-access-token'));
  return response;
}
