#!/usr/bin/env node
// 测试 Supabase Auth 手机验证码配置
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);
const testPhone = process.argv[2] || '13800138000';

console.log(`正在测试手机号 ${testPhone} 发送验证码...`);
const { data, error } = await supabase.auth.signInWithOtp({ phone: testPhone });

if (error) {
  console.error('发送失败:', error.message);
  console.error('错误码:', error.status);
  process.exit(1);
}

console.log('发送成功:', data);
