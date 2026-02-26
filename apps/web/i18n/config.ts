export const defaultLocale = 'en';

export const locales = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'fa', label: 'فارسی', dir: 'rtl' },
] as const;

export type Locale = (typeof locales)[number]['code'];
export type Direction = 'ltr' | 'rtl';

export const localeCodes: string[] = locales.map((l) => l.code);

export function getDirection(code: string): Direction {
  return locales.find((l) => l.code === code)?.dir ?? 'ltr';
}
