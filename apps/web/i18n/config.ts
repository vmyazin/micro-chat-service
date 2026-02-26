export const defaultLocale = 'en';

export const locales = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
] as const;

export type Locale = (typeof locales)[number]['code'];

export const localeCodes: string[] = locales.map((l) => l.code);
