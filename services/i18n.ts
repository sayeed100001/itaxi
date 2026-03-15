import { translations } from '../constants/translations.js';

export const SUPPORTED_LANGUAGES = ['en', 'fa'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type TranslationDict = (typeof translations)['en'];

const isRecord = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object';

const getByPath = (obj: unknown, path: string): unknown => {
  if (!path) return obj;
  const keys = path.split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const k of keys) {
    if (!isRecord(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
};

export const format = (template: string, vars?: Record<string, string | number>): string => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
};

export const getTranslations = (lang: Language): TranslationDict => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dict = (translations as any)?.[lang] as TranslationDict | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return dict || ((translations as any).en as TranslationDict);
};

export const tr = (lang: Language, key: string, vars?: Record<string, string | number>): string => {
  const dict = getTranslations(lang);
  const value = getByPath(dict, key);
  if (typeof value === 'string') return format(value, vars);
  return key;
};

export const isRTL = (lang: Language): boolean => lang === 'fa';

// Backwards-compatible helper. Prefer `useI18n()` from `services/useI18n.ts` in React code.
export const useTranslation = (lang: Language = 'en') => {
  const t = (key: string, vars?: Record<string, string | number>): string => tr(lang, key, vars);
  return { t };
};

