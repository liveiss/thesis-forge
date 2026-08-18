// ==============================================
// 论文工坊 - Supabase 客户端
// ==============================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 环境变量：
// NEXT_PUBLIC_SUPABASE_URL - Supabase 项目 URL
// NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase 匿名密钥
// SUPABASE_SERVICE_ROLE_KEY - 服务端密钥（用于激活码兑换等需绕过 RLS 的操作）

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 未配置环境变量时返回安全降级 client，避免 SSR 报错
const mockClient = {
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({ single: async () => ({ data: null, error: new Error('Supabase 未配置') }) }),
        order: () => ({ data: [], error: new Error('Supabase 未配置') }),
      }),
      single: async () => ({ data: null, error: new Error('Supabase 未配置') }),
    }),
    upsert: () => ({ error: new Error('Supabase 未配置') }),
    delete: () => ({ eq: () => ({ eq: () => ({ error: new Error('Supabase 未配置') }) }) }),
    insert: () => ({ error: new Error('Supabase 未配置') }),
    update: () => ({ eq: () => ({ eq: () => ({ error: new Error('Supabase 未配置') }) }) }),
  }),
  auth: {
    getUser: async () => ({ data: { user: null }, error: new Error('Supabase 未配置') }),
    getSession: async () => ({ data: { session: null }, error: new Error('Supabase 未配置') }),
    signInWithOtp: async () => ({ error: new Error('Supabase 未配置') }),
    verifyOtp: async () => ({ error: new Error('Supabase 未配置') }),
    signOut: async () => ({ error: new Error('Supabase 未配置') }),
  },
} as unknown as SupabaseClient;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : mockClient;

export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : mockClient;
