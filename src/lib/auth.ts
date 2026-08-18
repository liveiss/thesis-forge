'use client';

import { useCallback, useEffect, useState } from 'react';

export interface User {
  id: string;
  phone: string;
  createdAt: string;
  plan: 'free' | 'basic' | 'deep' | 'season';
  planExpire?: string;
  detectCount: number;
  fixCount: number;
}

const PROFILE_KEY = 'thesis_forge_profile';

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

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败（${res.status}）`);
  }
  return data as T;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始加载：从后端获取 session
  useEffect(() => {
    let mounted = true;
    apiFetch<{ user: { id: string; phone: string; plan: string; planExpire?: string } | null }>('/api/auth/session')
      .then(data => {
        if (!mounted) return;
        if (data.user) {
          const u: User = {
            id: data.user.id,
            phone: data.user.phone,
            createdAt: new Date().toISOString(),
            plan: (data.user.plan as User['plan']) || 'free',
            planExpire: data.user.planExpire,
            detectCount: 0,
            fixCount: 0,
          };
          setUser(u);
          storeProfile(u);
        } else {
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
        }
      })
      .catch(err => {
        console.warn('[获取 session 失败]', err);
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
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const sendCode = useCallback(async (phone: string): Promise<{ ok: boolean; error?: string }> => {
    if (!/^1\d{10}$/.test(phone)) return { ok: false, error: '手机号格式不正确' };

    try {
      await apiFetch('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: errorMessage(error) };
    }
  }, []);

  const verifyCode = useCallback(async (phone: string, code: string): Promise<{ ok: boolean; error?: string }> => {
    if (!/^1\d{10}$/.test(phone)) return { ok: false, error: '手机号格式不正确' };

    try {
      const data = await apiFetch<{ ok: boolean; user?: { id: string; phone: string } }>('/api/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });

      if (data.ok && data.user) {
        const newUser: User = {
          id: data.user.id,
          phone: data.user.phone,
          createdAt: new Date().toISOString(),
          plan: 'free',
          detectCount: 0,
          fixCount: 0,
        };
        setUser(newUser);
        storeProfile(newUser);
      }
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: errorMessage(error) };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('[登出失败]', err);
    }
    setUser(null);
    storeProfile(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      storeProfile(next);
      return next;
    });
  }, []);

  const recordUsage = useCallback((type: 'detect' | 'fix') => {
    setUser(prev => {
      if (!prev) return prev;
      const updates = type === 'detect'
        ? { detectCount: prev.detectCount + 1 }
        : { fixCount: prev.fixCount + 1 };
      const next = { ...prev, ...updates };
      storeProfile(next);
      return next;
    });
  }, []);

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
    sendCode,
    verifyCode,
    logout,
    updateUser,
    recordUsage,
    canUse,
  };
}
