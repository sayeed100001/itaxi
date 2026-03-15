import { useMemo } from 'react';
import { useAppStore } from '../store.js';
import { getTranslations, tr } from './i18n.js';

export const useI18n = () => {
  const language = useAppStore((s) => s.language);
  const isRTL = language === 'fa';

  // Keep referential stability for callers that pass callbacks.
  const t = useMemo(() => getTranslations(language), [language]);
  const tx = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => tr(language, key, vars);
  }, [language]);

  return { language, isRTL, t, tx };
};

