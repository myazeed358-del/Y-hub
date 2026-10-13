import * as React from 'react';

import { useCoursePlan } from '../hooks/useCoursePlan';
import { CoursePlanHeader } from '../components/CoursePlanHeader';
import { CoursePlanSummary } from '../components/CoursePlanSummary';
import { CoursePlanLessonList } from '../components/CoursePlanLessonList';

export default function CoursePlanPage() {
  const {
    language,
    t,
    lessons,
    completed,
    localizedLessons,
  } = useCoursePlan();

  return (
    <div
      className="mx-auto max-w-6xl"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <CoursePlanHeader
        language={language}
        t={t}
        completed={completed}
        lessons={lessons}
      />

      <CoursePlanSummary language={language} t={t} />

      <CoursePlanLessonList
        t={t}
        localizedLessons={localizedLessons}
      />
    </div>
  );
}
