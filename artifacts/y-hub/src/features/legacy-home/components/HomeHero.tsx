import { ArrowLeft, BookOpen } from 'lucide-react';
import type { LegacyHomeController } from '../hooks/useLegacyHome';
type Props = Pick<LegacyHomeController, 'language' | 't'>;
export function HomeHero({ language }: Props) {
  const ar = language === 'ar';
  return <section dir={ar ? 'rtl' : 'ltr'} className="relative overflow-hidden rounded-[2rem] border bg-card p-7 md:p-10">
    <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-primary"><BookOpen size={18} />{ar ? 'التعلم الأكاديمي' : 'Academic learning'}</div>
    <h1 className="text-3xl font-extrabold md:text-5xl">{ar ? 'تابع دروس شعبتك' : 'Follow your section lessons'}</h1>
    <p className="mt-5 max-w-2xl leading-8 text-muted-foreground">{ar ? 'اختر شعبتك وراجع وحدات السيلابس وموضوعاته كما أعدها الدكتور.' : 'Choose your section and explore the syllabus units and topics prepared by your instructor.'}</p>
    <a href="#learning-path" data-testid="link-continue-learning" className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground">
      {ar ? 'عرض السيلابس' : 'View syllabus'}<ArrowLeft size={17} />
    </a>
  </section>;
}
