import * as React from 'react';
import NotFound from '@/pages/legacy/NotFound';

import { useLegacyLesson } from '../hooks/useLegacyLesson';
import { LessonHeader } from '../components/LessonHeader';
import { LessonArticle } from '../components/LessonArticle';
import { LessonSidebar } from '../components/LessonSidebar';

export default function LessonPage() {
  const lessonState = useLegacyLesson();

  if (!lessonState.lesson) return <NotFound />;

  return (
    <div className="mx-auto max-w-5xl">
      <LessonHeader
        lesson={lessonState.lesson}
        t={lessonState.t}
        index={lessonState.index}
        lessons={lessonState.lessons}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_270px]">
        <LessonArticle
          lesson={lessonState.lesson}
          t={lessonState.t}
          previous={lessonState.previous}
          next={lessonState.next}
        />

        <LessonSidebar
          language={lessonState.language}
          slug={lessonState.slug}
          lessonItems={lessonState.lessonItems}
        />
      </div>
    </div>
  );
}
