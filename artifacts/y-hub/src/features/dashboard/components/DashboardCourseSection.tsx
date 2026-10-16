import * as React from 'react';
import { BookOpen, Loader2, Plus } from 'lucide-react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import {
  DashboardCourseCard,
  type Course,
} from '@/features/dashboard/components/DashboardCourseCard';
import type { getDashboardCopy } from '@/i18n/dashboardCopy';
import { useCourseEnrollmentRoster } from '../hooks/useCourseEnrollmentRoster';
import { CourseEnrollmentDialog } from './CourseEnrollmentDialog';

interface DashboardCourseSectionProps {
  copy: ReturnType<typeof getDashboardCopy>;
  loading: boolean;
  courses: Course[];
  viewerId: string | null;
  isArabic: boolean;
  setIsOpen: (value: boolean) => void;
  handleDelete: (id: string) => Promise<void>;
  handleToggleStatus: (course: Course) => Promise<void>;
  handleToggleEnrollmentOpen: (course: Course) => Promise<void>;
  updatingEnrollmentId: string | null;
}

export function DashboardCourseSection({
  copy,
  loading,
  courses,
  viewerId,
  isArabic,
  setIsOpen,
  handleDelete,
  handleToggleStatus,
  handleToggleEnrollmentOpen,
  updatingEnrollmentId,
}: DashboardCourseSectionProps) {
  const {
    counts,
    countsError,
    selectedCourse,
    setSelectedCourse,
    roster,
    rosterLoading,
    rosterError,
  } = useCourseEnrollmentRoster(courses, loading);

  return (
    <>
      <section className="rounded-[2rem] border border-border bg-card/85 dark:border-slate-800/80 dark:bg-[#0b1220]/65 p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
              Y HUB
            </p>

            <h2 className="text-xl font-black text-foreground dark:text-white sm:text-2xl">
              {copy.courseManagement}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground dark:text-slate-500">
              {copy.courseManagementSubtitle}
            </p>
          </div>
        </div>

        {countsError && !loading && courses.length > 0 && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {isArabic
              ? 'تعذر تحميل أعداد الطلاب.'
              : 'Could not load enrollment counts.'}
          </p>
        )}

        {loading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-4">
            <Loader2
              className="animate-spin text-cyan-400"
              size={34}
            />
            <p className="text-sm text-slate-500">
              {copy.loading}
            </p>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex min-h-[290px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted/25 dark:border-slate-800 dark:bg-slate-950/25 px-6 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.05]">
              <BookOpen
                className="text-slate-600"
                size={30}
              />
            </div>

            <h3 className="text-lg font-black text-foreground dark:text-slate-200">
              {copy.noCourses}
            </h3>

            <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground dark:text-slate-500">
              {copy.noCoursesText}
            </p>

            <Button
              onClick={() => setIsOpen(true)}
              className="mt-6 gap-2 rounded-xl bg-cyan-400 font-black text-slate-950 hover:bg-cyan-300"
            >
              <Plus size={16} />
              {copy.newCourse}
            </Button>
          </div>
        ) : (
          <div
            className="grid min-w-0 gap-5"
            style={{
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            }}
          >
            {courses.map((course) => (
              <DashboardCourseCard
                key={course.id}
                course={course}
                copy={copy}
                isArabic={isArabic}
                enrollmentCount={counts[course.id] ?? null}
                canManage={viewerId === course.instructor_id}
                onShowStudents={() => setSelectedCourse(course)}
                handleDelete={handleDelete}
                handleToggleStatus={handleToggleStatus}
                handleToggleEnrollmentOpen={handleToggleEnrollmentOpen}
                updatingEnrollmentId={updatingEnrollmentId}
              />
            ))}
          </div>
        )}
      </section>
      <CourseEnrollmentDialog
        course={selectedCourse}
        students={roster}
        loading={rosterLoading}
        error={rosterError}
        isArabic={isArabic}
        onOpenChange={(open) => {
          if (!open) setSelectedCourse(null);
        }}
      />
    </>
  );
}
