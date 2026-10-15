import { Book } from 'lucide-react';
import type { useLanguage } from '@/i18n/LanguageContext';
import { CircularProgress } from './CircularProgress';
import { HorizontalProgress } from './HorizontalProgress';

interface Props {
  t: ReturnType<typeof useLanguage>['t'];
  firstName: string;
  enrolledIds: Set<string>;
  courses: any[];
  enrollingId: string | null;
  handleEnroll: (courseId: string) => Promise<void>;
  setLocation: (path: string) => void;
}

export function StudentDashboardMain({
  t,
  firstName,
  enrolledIds,
  courses,
  enrollingId,
  handleEnroll,
  setLocation,
}: Props) {
  return (
      <div className="flex-1 space-y-8 min-w-0">
        <header>
          <h1 className="text-3xl font-bold mb-2">
            {t('welcomeBack')} <span className="text-primary font-extrabold">{firstName}</span>!
          </h1>
          <p className="text-muted-foreground">{t('digitalHub')}</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center shadow-sm">
            <CircularProgress progress={enrolledIds.size > 0 ? 100 : 0} label={`${enrolledIds.size}`} sublabel={t('enrolledCourses')} />
          </div>
          <div className="md:col-span-2 bg-card border border-border rounded-2xl p-6 flex flex-col justify-center shadow-sm">
            <h2 className="text-xl font-bold mb-6">{t('currentObjectives')}</h2>
            <div className="flex flex-col gap-5">
              {enrolledIds.size === 0 ? (
                <div className="text-muted-foreground text-sm">{t('noObjectives')}</div>
              ) : (
                <>
                  <HorizontalProgress progress={0} label={t('completeAssignments')} valueText="0/0" />
                  <HorizontalProgress progress={0} label={t('weeklyLectures')} valueText="0/0 hrs" />
                </>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{t('availableCourses')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {courses.length === 0 ? (
              <div className="col-span-full text-muted-foreground text-center py-10">{t('noCourses')}</div>
            ) : courses.map((course) => {
              const isEnrolled = enrolledIds.has(course.id);
              const isEnrolling = enrollingId === course.id;

              return (
                <div key={course.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/50 transition-colors group flex flex-col shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Book className="text-primary group-hover:text-primary" size={24} />
                  </div>
                  <div className="text-xs text-primary mb-1 font-medium">{course.course_code || 'GEN'}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-4 line-clamp-1">{course.title}</h3>
                  <div className="flex justify-between items-end mb-4 mt-auto">
                    <span className="text-xs text-muted-foreground">{isEnrolled ? t('enrolled') : t('notEnrolled')}</span>
                    <span className="text-sm font-bold text-foreground">{isEnrolled ? '100%' : '0%'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-background rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-primary" style={{ width: isEnrolled ? '100%' : '0%' }} />
                  </div>
                  {isEnrolled ? (
                    <button onClick={() => setLocation(`/course/${course.id}/view`)} className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                      {t('enterCourse')}
                    </button>
                  ) : (
                    <button onClick={() => handleEnroll(course.id)} disabled={isEnrolling} className="w-full py-2 rounded-lg bg-background border border-border text-foreground font-semibold hover:bg-accent/10 transition-colors">
                      {isEnrolling ? t('enrolling') : t('enrollNow')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
  );
}
