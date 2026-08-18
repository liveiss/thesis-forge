#!/usr/bin/env node
// ============================================================
// 论文工坊 - 激活码批量生成脚本
// 用法：
//   node scripts/generate-codes.mjs <plan> <count> [durationDays]
// 示例：
//   node scripts/generate-codes.mjs deep 10 7
// 环境变量：
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from '@supabase/supabase-js';

function randomCode(prefix, length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = prefix.toUpperCase();
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('错误：请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const plan = process.argv[2];
  const count = parseInt(process.argv[3] || '1', 10);
  const durationDays = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;

  if (!['basic', 'deep', 'season'].includes(plan)) {
    console.error('错误：plan 必须是 basic / deep / season 之一');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const codes = [];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const code = randomCode(plan.slice(0, 2));
    codes.push(code);
    rows.push({
      code,
      plan,
      duration_days: durationDays ?? (plan === 'season' ? 90 : 7),
    });
  }

  const { error } = await supabase.from('redemption_codes').insert(rows);
  if (error) {
    console.error('生成失败：', error.message);
    process.exit(1);
  }

  console.log(`成功生成 ${count} 个 ${plan} 套餐激活码：\n`);
  codes.forEach(c => console.log(c));
}

main();
