'use client';

import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { LanguageSwitcher } from './LanguageSwitcher';

export function AppControls() {
  const { isDark, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="inline-flex items-center rounded-full border border-(--border-color) bg-(--surface-muted) p-0.5 gap-0">
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-(--surface-elevated) transition-colors"
      >
        {mounted ? (
          isDark ? (
            <SunIcon weight="regular" className="w-[18px] h-[18px]" />
          ) : (
            <MoonIcon weight="regular" className="w-[18px] h-[18px]" />
          )
        ) : (
          <span className="w-[18px] h-[18px]" />
        )}
      </button>

      <div className="w-px h-4 bg-(--border-color)" aria-hidden="true" />

      <LanguageSwitcher />
    </div>
  );
}
