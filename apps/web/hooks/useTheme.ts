'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

function getSystemDark(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return getSystemDark();
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  const dark = resolveIsDark(theme);
  html.classList.toggle('dark', dark);
  html.classList.toggle('light', !dark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme) ?? 'system';
  });

  const isDark = resolveIsDark(theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Keep in sync if OS preference changes while set to system
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    if (next === 'system') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', next);
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  return { theme, isDark, setTheme, toggle };
}
