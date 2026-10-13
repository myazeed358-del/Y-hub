import * as React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

export function HeaderLanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <button
      onClick={() =>
        setLanguage(language === 'ar' ? 'en' : 'ar')
      }
      className="h-9 rounded-xl border border-border bg-card px-3 text-[11px] font-black tracking-wide text-primary transition-all hover:bg-accent/10"
      aria-label={t('language')}
      data-testid="button-language-toggle"
    >
      {language === 'ar' ? 'EN' : 'AR'}
    </button>
  );
}
