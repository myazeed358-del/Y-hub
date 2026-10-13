import * as React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

interface HeaderWelcomeMessageProps {
  firstName: string;
  academicMeta: string;
}

export function HeaderWelcomeMessage({
  firstName,
  academicMeta,
}: HeaderWelcomeMessageProps) {
  const { language } = useLanguage();

  return (
        <div className="hidden text-left lg:block">
          <div className="text-xs font-bold text-foreground">
            {language === 'ar'
              ? `مرحباً، ${firstName}`
              : `Welcome, ${firstName}`}
          </div>

          <div className="mt-1 max-w-[220px] truncate text-[10px] text-muted-foreground">
            {academicMeta}
          </div>
        </div>
  );
}
