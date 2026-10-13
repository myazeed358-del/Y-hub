import { useEffect, useState } from 'react';
import type { Language } from '@/i18n/uiCopy';
import { getCourses } from '@/utils/courseStorage';

import {
  resolveActiveCourseRoute,
} from '../domain/resolveActiveCourseRoute';

export function useActiveCourseName(
  location: string,
  language: Language
): string | null {
  const [activeCourseName, setActiveCourseName] =
    useState<string | null>(null);

  useEffect(() => {
    const route = resolveActiveCourseRoute(location);
    let cancelled = false;

    if (route.kind === 'course') {
      getCourses()
        .then((courses) => {
          if (cancelled) return;

          const course = courses.find(
            (item) => item.id === route.courseId
          );

          setActiveCourseName(
            course ? course.title : null
          );
        })
        .catch(() => {
          if (!cancelled) {
            setActiveCourseName(null);
          }
        });
    } else if (route.kind === 'lesson') {
      setActiveCourseName(
        language === 'ar'
          ? 'المجموعات الضبابية'
          : 'Fuzzy Sets'
      );
    } else if (route.kind === 'clear') {
      setActiveCourseName(null);
    }

    // Prevent an old course request from replacing
    // the context after navigation.
    return () => {
      cancelled = true;
    };
  }, [location, language]);

  return activeCourseName;
}
