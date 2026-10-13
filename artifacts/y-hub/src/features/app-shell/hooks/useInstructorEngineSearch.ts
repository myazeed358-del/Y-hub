import { useState } from 'react';
import type { Language } from '@/i18n/uiCopy';

import {
  resolveInstructorEngineSearch,
} from '../domain/instructorEngineSearch';

type SearchRole =
  Parameters<typeof resolveInstructorEngineSearch>[0];

export function useInstructorEngineSearch(
  role: SearchRole,
  language: Language
) {
  const [engineSearch, setEngineSearch] = useState('');

  const {
    instructorSearchResults,
    quickPracticeSearchMatch,
  } = resolveInstructorEngineSearch(
    role,
    engineSearch,
    language
  );

  return {
    engineSearch,
    setEngineSearch,
    instructorSearchResults,
    quickPracticeSearchMatch,
  };
}

export type InstructorEngineSearchController =
  ReturnType<typeof useInstructorEngineSearch>;
