import { createContext, useContext } from 'react';
import { uiCopy, type Language, type UiKey } from './uiCopy';

export const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: UiKey) => string;
}>({ language: 'ar', setLanguage: () => undefined, t: (key) => uiCopy.ar[key] });

export function useLanguage() {
  return useContext(LanguageContext);
}
