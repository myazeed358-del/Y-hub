import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@workspace/y-hub-ds/components/ui/tooltip';
import { Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';
import { uiCopy, type Language, type UiKey } from '@/i18n/uiCopy';
import { LanguageContext } from '@/i18n/LanguageContext';
import { useGuardedLocation } from '@/shared/navigation/guardedLocation';
import { ApplicationFrame } from '@/app/ApplicationFrame';

const queryClient = new QueryClient();








import { ThemeProvider } from 'next-themes';

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'ar';
    const storedLanguage =
      window.localStorage.getItem('yhub-language') ??
      window.localStorage.getItem('fuzzy-academy-language');

    return storedLanguage === 'en' ? 'en' : 'ar';
  });

  useEffect(() => {
    window.localStorage.setItem('yhub-language', language);
    window.localStorage.removeItem('fuzzy-academy-language');
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = (key: UiKey) => uiCopy[language][key];

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <WouterRouter hook={useGuardedLocation} base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <ApplicationFrame />
              </WouterRouter>
              <Toaster position="top-center" dir="rtl" richColors />
            </TooltipProvider>
          </QueryClientProvider>
        </LanguageContext.Provider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

