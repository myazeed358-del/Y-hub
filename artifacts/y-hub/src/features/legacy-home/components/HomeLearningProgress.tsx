import type { ReactNode } from 'react';
import type { LegacyHomeController } from '../hooks/useLegacyHome';
type Props = Pick<LegacyHomeController, 'language' | 't'> & { learningPath?: ReactNode };

/** Academic content is supplied by the application composition root. */
export function HomeLearningProgress({ language, learningPath }: Props) {
  return <>{learningPath ?? <p>{language === 'ar' ? 'اختر شعبة لعرض السيلابس الخاص بها.' : 'Choose a section to view its syllabus.'}</p>}</>;
}
