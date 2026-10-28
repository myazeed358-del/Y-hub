import type { ReactNode } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'wouter';

/** The composition root supplies the same authorized syllabus used on the learning home. */
export default function CoursePlanPage({ learningPath }: { learningPath?: ReactNode }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  return <div className="mx-auto max-w-6xl space-y-6" dir={ar ? 'rtl' : 'ltr'}>
    <h1 className="text-3xl font-extrabold md:text-5xl">{ar ? 'خطة الشعبة الدراسية' : 'Section learning plan'}</h1>
    {learningPath ?? <p>{ar ? 'اختر شعبة لعرض السيلابس الخاص بها.' : 'Choose a section to view its syllabus.'}</p>}
    <Link href="/lesson/introduction" className="text-sm text-muted-foreground underline">{ar ? 'مرجع مستقل: أساسيات المنطق الضبابي' : 'Independent reference: fuzzy logic foundations'}</Link>
  </div>;
}
