import { useLanguage } from '@/i18n/LanguageContext';

export function useLegacyHome() { return useLanguage(); }
export type LegacyHomeController = ReturnType<typeof useLegacyHome>;
