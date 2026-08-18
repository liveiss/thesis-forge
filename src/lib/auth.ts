'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface User {
  id: string;
  phone: string;
  createdAt: string;
  plan: 'free' | 'basic' | 'deep' | 'season';
  planExpire?: string;
  detectCount: number;
  fixCount: number;
}

const SESSION_KEY = 'thesis_forge_session';
const PROFILE_KEY = 'thesis_forge_profile';

function hasSupabaseConfig(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function readStoredProfile(): Partial<User> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Partial<User>) : null;
  } catch {
    return null;
  }
}

function storeProfile(profile: Partial<User> | null) {
  if (typeof window === 'undefined') return;
  if (profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(PROFILE_KEY);
  }
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'supabase' | 'local'>('supabase');

  // 初始加载：监听 Supabase session，同时尝试恢复本地缓存
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      const stored = readStoredProfile();
      if (stored?.id && stored.phone) {
        setUser({
          id: stored.id,
          phone: stored.phone,
          createdAt: stored.createdAt || new Date().toISOString(),
          plan: stored.plan || 'free',
          planExpire: stored.planExpire,
          detectCount: stored.detectCount || 0,
          fixCount: stored.fixCount || 0,
        });
      }
      setLoading(false);
      setMode('local');
      return;
    }

    setMode('supabase');

    // 初始 session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await hydrateUser(session.user);
      }
      setLoading(false);
    });

    // 监听登录态变化
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await hydrateUser(session.user);
      } else {
        setUser(null);
        storeProfile(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function hydrateUser(supabaseUser: { id: string; phone?: string }) {
    const phone = supabaseUser.phone || '';

    // 读取或创建 profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    if (error || !profile) {
      // 触发器可能还没跑完，尝试创建
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: supabaseUser.id,
        phone,
        plan: 'free',
      });
      if (upsertError) {
        console.warn('[hydrateUser] profile 创建失败', upsertError);
      }
    }

    const merged: User = {
      id: supabaseUser.id,
      phone,
      createdAt: profile?.created_at || new Date().toISOString(),
      plan: (profile?.plan as User['plan']) || 'free',
      planExpire: profile?.plan_expire || undefined,
      detectCount: 0,
      fixCount: 0,
    };

    setUser(merged);
    storeProfile(merged);
  }

  const sendCode = useCallback(async (phone: string): Promise<{ ok: boolean; error?: string }> => {
    if (!/^1\d{10}$/.test(phone)) return { ok: false, error: '手机号格式不正确' };

    if (mode === 'local') {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem(`code_${phone}`, code);
      console.log(`[本地模拟验证码] ${phone}: ${code}`);
      return { ok: true };
    }

    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      return { ok: false, error: errorMessage(error) };
    }
    return { ok: true };
  }, [mode]);

  const verifyCode = useCallback(async (phone: string, code: string): Promise<{ ok: boolean; error?: string }> => {
    if (mode === 'local') {
      const storedCode = localStorage.getItem(`code_${phone}`);
      if (!storedCode) return { ok: false, error: '请先获取验证码' };
      if (storedCode !== code) return { ok: false, error: '验证码错误' };
      localStorage.removeItem(`code_${phone}`);
      const newUser: User = {
        id: `user_${phone}`,
        phone,
        createdAt: new Date().toISOString(),
        plan: 'free',
        detectCount: 0,
        fixCount: 0,
      };
      setUser(newUser);
      storeProfile(newUser);
      return { ok: true };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });

    if (error || !data.user) {
      return { ok: false, error: error ? errorMessage(error) : '验证失败' };
    }

    await hydrateUser(data.user);
    return { ok: true };
  }, [mode]);

  const logout = useCallback(async () => {
    if (mode === 'supabase') {
      await supabase.auth.signOut();
    }
    setUser(null);
    storeProfile(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [mode]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      storeProfile(next);
      return next;
    });
  }, []);

  const recordUsage = useCallback(async (type: 'detect' | 'fix') => {
    setUser(prev => {
      if (!prev) return prev;
      const updates = type === 'detect'
        ? { detectCount: prev.detectCount + 1 }
        : { fixCount: prev.fixCount + 1 };
      const next = { ...prev, ...updates };
      storeProfile(next);
      return next;
    });

    if (mode === 'supabase' && user?.id) {
      await supabase.from('usage_logs').insert({ user_id: user.id, type });
    }
  }, [mode, user?.id]);

  const canUse = useCallback((type: 'detect' | 'fix'): boolean => {
    const current = user;
    if (!current) return false;
    if (current.plan === 'season') return true;
    if (current.plan === 'basic' || current.plan === 'deep') return true;
    if (type === 'detect') return current.detectCount < 1;
    return false;
  }, [user]);

  return {
    user,
    loading,
    mode,
    sendCode,
    verifyCode,
    logout,
    updateUser,
    recordUsage,
    canUse,
  };
}
