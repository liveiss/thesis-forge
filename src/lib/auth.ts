'use client';

import { useCallback, useSyncExternalStore } from 'react';

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
let cachedUser: User | null | undefined;
const listeners = new Set<() => void>();

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored) as Partial<User>;
    if (!session.phone) return null;
    // 兼容旧版：修复带时间戳的非确定性 ID
    if (session.id && session.id.includes('_') && session.id.split('_').length > 2) {
      session.id = `user_${session.phone}`;
    }
    return session as User;
  } catch {
    return null;
  }
}

function getSessionSnapshot(): User | null {
  if (cachedUser === undefined) {
    cachedUser = readStoredUser();
  }
  return cachedUser;
}

function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setSession(user: User | null): void {
  cachedUser = user;
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }
  listeners.forEach(listener => listener());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useAuth() {
  const user = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);

  const sendCode = useCallback(async (phone: string): Promise<{ ok: boolean; error?: string }> => {
    if (!/^1\d{10}$/.test(phone)) return { ok: false, error: '手机号格式不正确' };

    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem(`code_${phone}`, code);
      // TODO: 生产环境接入真实短信服务
      console.log(`[验证码] ${phone}: ${code}`);
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: errorMessage(error) };
    }
  }, []);

  const verifyCode = useCallback(async (phone: string, code: string): Promise<{ ok: boolean; error?: string }> => {
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
    setSession(newUser);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    const current = getSessionSnapshot();
    if (!current) return;
    setSession({ ...current, ...updates });
  }, []);

  const recordUsage = useCallback((type: 'detect' | 'fix') => {
    const current = getSessionSnapshot();
    if (!current) return;
    const updates = type === 'detect'
      ? { detectCount: current.detectCount + 1 }
      : { fixCount: current.fixCount + 1 };
    setSession({ ...current, ...updates });
  }, []);

  const canUse = useCallback((type: 'detect' | 'fix'): boolean => {
    const current = getSessionSnapshot();
    if (!current) return false;
    if (current.plan === 'season') return true;
    if (current.plan === 'basic' || current.plan === 'deep') return true;
    if (type === 'detect') return current.detectCount < 1;
    return false;
  }, []);

  return {
    user,
    loading: false,
    sendCode,
    verifyCode,
    logout,
    updateUser,
    recordUsage,
    canUse,
  };
}
