import { useEffect, useState } from 'react';
import type { Course } from '../types';
import {
  courseEnrollmentRepository,
  type EnrollmentRosterStudent,
} from '../services/courseEnrollmentRepository';

export function useCourseEnrollmentRoster(
  courses: Course[],
  loading: boolean
) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsError, setCountsError] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [roster, setRoster] = useState<EnrollmentRosterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(false);

  useEffect(() => {
    if (loading || courses.length === 0) {
      setCounts({});
      setCountsError(false);
      return;
    }

    let active = true;
    const visibleIds = new Set(courses.map((course) => course.id));
    setCounts({});
    setCountsError(false);

    // Only show counts for courses on this dashboard.
    void courseEnrollmentRepository.listCounts()
      .then((rows) => {
        if (!active) return;
        setCounts(Object.fromEntries(
          rows
            .filter((row) => visibleIds.has(row.course_id))
            .map((row) => [row.course_id, row.enrollment_count])
        ));
      })
      .catch(() => {
        if (active) setCountsError(true);
      });

    return () => { active = false; };
  }, [courses, loading]);

  useEffect(() => {
    if (!selectedCourse) {
      setRoster([]);
      setRosterLoading(false);
      setRosterError(false);
      return;
    }

    let active = true;
    setRoster([]);
    setRosterLoading(true);
    setRosterError(false);

    void courseEnrollmentRepository.getRoster(selectedCourse.id)
      .then((students) => {
        if (active) setRoster(students);
      })
      .catch(() => {
        if (active) setRosterError(true);
      })
      .finally(() => {
        if (active) setRosterLoading(false);
      });

    return () => { active = false; };
  }, [selectedCourse]);

  return {
    counts,
    countsError,
    selectedCourse,
    setSelectedCourse,
    roster,
    rosterLoading,
    rosterError,
  };
}
