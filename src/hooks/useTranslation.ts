import { useAppStore } from '@/stores/appStore';
import { translations, TranslationKey } from '@/lib/i18n';

export function useTranslation() {
  const { language, setLanguage } = useAppStore();
  
  const t = (key: TranslationKey): string => {
    return translations[language][key];
  };
  
  const toggleLanguage = () => {
    setLanguage(language === 'ko' ? 'en' : 'ko');
  };
  
  return { t, language, setLanguage, toggleLanguage };
}
