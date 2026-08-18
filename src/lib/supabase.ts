// ==============================================
// 论文工坊 - Supabase 客户端
// ==============================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 环境变量：
// NEXT_PUBLIC_SUPABASE_URL - Supabase 项目 URL
// NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase 匿名密钥

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 未配置环境变量时返回安全降级 client，避免 SSR 报错
const mockClient = {
  from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('Supabase 未配置') }) }), order: () => ({ data: [], error: new Error('Supabase 未配置') }) }) }),
    upsert: () => ({ error: new Error('Supabase 未配置') }),
    delete: () => ({ eq: () => ({ eq: () => ({ error: new Error('Supabase 未配置') }) }) }),
  }),
} as unknown as SupabaseClient;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : mockClient;
