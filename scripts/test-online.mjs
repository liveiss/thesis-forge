#!/usr/bin/env node
// 线上端到端测试脚本
const BASE_URL = process.argv[2] || 'https://starlit-profiterole-b37340.netlify.app';

const cookieJar = new Map();

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...options.headers };
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body,
  });

  // 保存 cookie
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const [nameValue] = setCookie.split(';');
    const [name, value] = nameValue.split('=');
    if (name && value !== undefined) {
      cookieJar.set(name.trim(), value.trim());
    }
  }

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function getCookieHeader() {
  return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function main() {
  console.log(`测试站点: ${BASE_URL}\n`);

  // 1. 发送验证码
  console.log('1. 发送验证码...');
  const sendRes = await api('/api/auth/send-code', {
    method: 'POST',
    body: { phone: '13800138000' },
  });
  console.log('  状态:', sendRes.status, sendRes.data);

  // 2. 验证验证码
  console.log('\n2. 验证验证码...');
  const verifyRes = await api('/api/auth/verify-code', {
    method: 'POST',
    body: { phone: '13800138000', code: '123456' },
  });
  console.log('  状态:', verifyRes.status, verifyRes.data);
  console.log('  Cookie:', getCookieHeader());

  // 3. 获取 session
  console.log('\n3. 获取 session...');
  const sessionRes = await api('/api/auth/session', {
    headers: { Cookie: getCookieHeader() },
  });
  console.log('  状态:', sessionRes.status, sessionRes.data);

  // 4. 保存项目
  console.log('\n4. 保存项目...');
  const saveRes = await api('/api/projects', {
    method: 'POST',
    headers: { Cookie: getCookieHeader() },
    body: {
      project: {
        title: '测试项目',
        type: 'thesis',
        major: '计算机',
        citationStyle: 'gb',
        wordLimit: 10000,
        sections: [
          { id: 'sec_1', title: '引言', type: 'introduction', content: '这是测试内容', wordCount: 6 },
        ],
        references: [],
      },
      diagnostics: {},
      report: null,
    },
  });
  console.log('  状态:', saveRes.status, saveRes.data);

  // 5. 获取项目列表
  console.log('\n5. 获取项目列表...');
  const listRes = await api('/api/projects', {
    headers: { Cookie: getCookieHeader() },
  });
  console.log('  状态:', listRes.status, listRes.data);
}

main().catch(console.error);
