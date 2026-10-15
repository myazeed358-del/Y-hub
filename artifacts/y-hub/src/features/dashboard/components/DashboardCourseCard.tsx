import * as React from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Eye,
  EyeOff,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import type { getDashboardCopy } from '@/i18n/dashboardCopy';

import type { Course } from '../types';
export type { Course } from '../types';

interface DashboardCourseCardProps {
  course: Course;
  copy: ReturnType<typeof getDashboardCopy>;
  enrollmentCount: number | null;
  isArabic: boolean;
  canManage: boolean;
  onShowStudents: () => void;
  handleDelete: (id: string) => Promise<void>;
  handleToggleStatus: (course: Course) => Promise<void>;
}

export function DashboardCourseCard({
  course,
  copy,
  enrollmentCount,
  isArabic,
  canManage,
  onShowStudents,
  handleDelete,
  handleToggleStatus,
}: DashboardCourseCardProps) {
  return (
              <article
                key={course.id}
                className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card p-5 dark:border-slate-800 dark:bg-slate-950/35 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-muted/30 dark:hover:border-cyan-400/20 dark:hover:bg-slate-950/55 hover:shadow-[0_20px_45px_rgba(0,0,0,.18)]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-cyan-400/[0.04] blur-3xl transition-opacity group-hover:bg-cyan-400/[0.08]" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary dark:border-white/[0.05] dark:bg-white/[0.025] dark:text-cyan-400">
                    <BookOpen size={20} />
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
                      course.is_published
                        ? 'border-primary/20 bg-primary/10 text-primary dark:border-cyan-400/15 dark:bg-cyan-400/[0.06] dark:text-cyan-300'
                        : 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/15 dark:bg-violet-400/[0.06] dark:text-violet-300'
                    }`}
                  >
                    {course.is_published
                      ? copy.publishedBadge
                      : copy.draftBadge}
                  </span>
                </div>

                <div className="relative mt-5 flex-1">
                  {course.course_code && (
                    <div className="mb-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground dark:text-slate-600">
                      {course.course_code}
                    </div>
                  )}

                  <h3 className="line-clamp-2 text-lg font-black leading-7 text-card-foreground dark:text-slate-100">
                    {course.title}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-xs leading-6 text-muted-foreground dark:text-slate-500">
                    {course.description || copy.noDescription}
                  </p>
                </div>

                <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {isArabic ? 'الطلاب المسجلون' : 'Enrolled students'}
                  </span>
                  <button
                    type="button"
                    onClick={onShowStudents}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20"
                  >
                    <Users size={15} />
                    {enrollmentCount === null ? '—' : enrollmentCount}
                    <span>{isArabic ? 'عرض الأسماء' : 'View names'}</span>
                  </button>
                </div>

                {canManage && (
                <div className="relative mt-6 border-t border-border pt-4 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title={copy.delete}
                      onClick={() => handleDelete(course.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors dark:border-slate-800 dark:text-slate-500 hover:border-red-400/20 hover:bg-red-500/[0.07] hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      type="button"
                      title={
                        course.is_published
                          ? copy.unpublish
                          : copy.publish
                      }
                      onClick={() => handleToggleStatus(course)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors dark:border-slate-800 dark:text-slate-500 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:border-violet-400/20 dark:hover:bg-violet-500/[0.07] dark:hover:text-violet-300"
                    >
                      {course.is_published ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>

                    <Link
                      href={`/course/${course.id}`}
                      className="min-w-0 flex-1"
                    >
                      <Button className="h-10 w-full gap-2 rounded-xl border border-primary/25 bg-primary/10 font-bold text-primary hover:bg-primary/15 hover:text-primary dark:border-cyan-400/15 dark:bg-cyan-400/[0.07] dark:text-cyan-300 dark:hover:bg-cyan-400/[0.12] dark:hover:text-cyan-200">
                        <Settings2 size={15} />
                        {copy.manage}
                        <ArrowUpRight size={14} />
                      </Button>
                    </Link>
                  </div>
                </div>
                )}
              </article>
  );
}
