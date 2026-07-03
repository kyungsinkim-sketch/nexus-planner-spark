import { useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { translations, TranslationKey } from '@/lib/i18n';

export function useTranslation() {
  // Field selectors — a storewide subscription here re-rendered every
  // consumer (~91 components) on ANY store change, including each
  // realtime chat message. Selectors limit re-renders to language changes.
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  const t = useCallback(
    (key: TranslationKey): string => translations[language][key],
    [language],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ko' ? 'en' : 'ko');
  }, [language, setLanguage]);

  return { t, language, setLanguage, toggleLanguage };
}
