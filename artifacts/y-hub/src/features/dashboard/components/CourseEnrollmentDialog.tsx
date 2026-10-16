import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/y-hub-ds/components/ui/dialog';
import type { Course } from '../types';
import type { EnrollmentRosterStudent } from '../services/courseEnrollmentRepository';

interface Props {
  course: Course | null;
  students: EnrollmentRosterStudent[];
  loading: boolean;
  error: boolean;
  isArabic: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CourseEnrollmentDialog({
  course,
  students,
  loading,
  error,
  isArabic,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={Boolean(course)} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isArabic ? 'rtl' : 'ltr'}
        className="border-border bg-background text-foreground sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>
            {isArabic ? 'الطلاب المسجلون' : 'Enrolled students'}
          </DialogTitle>
          <DialogDescription>
            {course?.title ?? ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p role="status" className="py-6 text-sm text-muted-foreground">
            {isArabic ? 'جاري تحميل الأسماء...' : 'Loading students...'}
          </p>
        ) : error ? (
          <p role="alert" className="py-6 text-sm text-destructive">
            {isArabic
              ? 'تعذر جلب الأسماء. تحقق من الاتصال والصلاحيات.'
              : 'Could not load students. Check connection and permissions.'}
          </p>
        ) : students.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {isArabic ? 'لا يوجد طلاب مسجلون حاليًا.' : 'No enrolled students yet.'}
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {students.map((student, index) => (
              <li
                key={student.student_id}
                className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{index + 1}.</span>
                <span className="min-w-0 flex-1 break-words font-semibold">
                  {student.full_name}
                </span>
                <span
                  dir="ltr"
                  title={isArabic ? 'رقم Y-Hub' : 'Y-Hub number'}
                  className="shrink-0 rounded-lg border border-border bg-muted/40 px-3 py-1 font-mono text-xs font-bold"
                >
                  {student.user_number ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
