'use client';

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

const THEME_KEY = 'thesis-forge-theme';
let cachedTheme: Theme | undefined;
const themeListeners = new Set<() => void>();

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getThemeSnapshot(): Theme {
  if (cachedTheme === undefined) {
    cachedTheme = readStoredTheme();
  }
  return cachedTheme;
}

function subscribeTheme(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  themeListeners.add(listener);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handleMediaChange = () => listener();
  media.addEventListener('change', handleMediaChange);

  return () => {
    themeListeners.delete(listener);
    media.removeEventListener('change', handleMediaChange);
  };
}

function setThemeValue(theme: Theme): void {
  cachedTheme = theme;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_KEY, theme);
  }
  themeListeners.forEach(listener => listener());
}

function getResolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => 'dark' as Theme);
  const resolvedTheme = getResolvedTheme(theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (next: Theme) => setThemeValue(next);

  const toggleTheme = () => {
    const next = theme === 'light'
      ? 'dark'
      : theme === 'dark'
        ? 'light'
        : resolvedTheme === 'light'
          ? 'dark'
          : 'light';
    setThemeValue(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
