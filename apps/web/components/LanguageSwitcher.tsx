'use client';

import * as Popover from '@radix-ui/react-popover';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { GlobeIcon, CheckIcon } from '@phosphor-icons/react';
import { Button } from '@/components/Button';
import { setUserLocale } from '@/app/actions/locale';
import { locales } from '@/i18n/config';

export function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  const selectLocale = async (newLocale: string) => {
    if (newLocale === locale) {
      setOpen(false);
      return;
    }

    setIsPending(true);
    await setUserLocale(newLocale);
    // Refresh to apply new messages
    window.location.reload();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 p-2 h-auto"
          aria-label="Select language"
        >
          <GlobeIcon className="w-5 h-5" />
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-50 w-36 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <div className="flex flex-col">
            {locales.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => selectLocale(lang.code)}
                disabled={isPending}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                aria-pressed={locale === lang.code}
              >
                <span>{lang.label}</span>
                {locale === lang.code && (
                  <CheckIcon className="w-4 h-4 text-emerald-500" />
                )}
              </button>
            ))}
          </div>
          <Popover.Arrow className="fill-white dark:fill-gray-900 border-gray-200 dark:border-gray-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
