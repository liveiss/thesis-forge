const BASE = 'https://starlit-profiterole-b37340.netlify.app';
const phone = '13800138000';
const code = process.argv[2] || 'DEPY2WLCBBBWMPUZ72';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function main() {
  console.log('1. 发送验证码...');
  let r = await req('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ phone }) });
  console.log(' ', r.status, r.data);

  console.log('2. 验证验证码...');
  r = await req('/api/auth/verify-code', { method: 'POST', body: JSON.stringify({ phone, code: '123456' }) });
  console.log(' ', r.status, r.data);
  const cookie = r.headers.get('set-cookie');
  console.log('  Cookie:', cookie?.slice(0, 60) + '...');

  console.log('3. 兑换激活码...');
  r = await req('/api/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
    headers: { Cookie: cookie },
  });
  console.log(' ', r.status, r.data);

  console.log('4. 获取 session...');
  r = await req('/api/auth/session', { headers: { Cookie: cookie } });
  console.log(' ', r.status, r.data);
}

main().catch(console.error);
