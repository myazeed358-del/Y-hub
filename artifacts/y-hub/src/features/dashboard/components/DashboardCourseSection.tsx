import { BookOpen, Loader2, Plus } from 'lucide-react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import {
  DashboardCourseCard,
  type Course,
} from '@/features/dashboard/components/DashboardCourseCard';
import type { getDashboardCopy } from '@/i18n/dashboardCopy';

interface DashboardCourseSectionProps {
  copy: ReturnType<typeof getDashboardCopy>;
  loading: boolean;
  courses: Course[];
  setIsOpen: (value: boolean) => void;
  handleDelete: (id: string) => Promise<void>;
  handleToggleStatus: (course: Course) => Promise<void>;
}

export function DashboardCourseSection({
  copy,
  loading,
  courses,
  setIsOpen,
  handleDelete,
  handleToggleStatus,
}: DashboardCourseSectionProps) {
  return (
      <section className="rounded-[2rem] border border-slate-800/80 bg-[#0b1220]/65 p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
              Y HUB
            </p>

            <h2 className="text-xl font-black text-white sm:text-2xl">
              {copy.courseManagement}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {copy.courseManagementSubtitle}
            </p>
          </div>
        </div>

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
          <div className="flex min-h-[290px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-800 bg-slate-950/25 px-6 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.05]">
              <BookOpen
                className="text-slate-600"
                size={30}
              />
            </div>

            <h3 className="text-lg font-black text-slate-200">
              {copy.noCourses}
            </h3>

            <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
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
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <DashboardCourseCard
                key={course.id}
                course={course}
                copy={copy}
                handleDelete={handleDelete}
                handleToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}
      </section>
  );
}
