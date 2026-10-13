import { Link } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import {
  ArrowRight,
  Loader2,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';

interface Props {
  course: {
    title: string;
    description?: string | null;
    course_code?: string | null;
  };
  enrolling: boolean;
  handleEnroll: () => Promise<void>;
}

export function StudentEnrollmentGate({
  course,
  enrolling,
  handleEnroll,
}: Props) {
  return (
      <div className="mx-auto max-w-2xl py-20 px-5 text-center" dir="rtl">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-[hsl(var(--primary)/.1)] flex items-center justify-center">
            <ShieldAlert className="text-[hsl(var(--primary))]" size={40} />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-[hsl(var(--foreground))]">{course.title}</h2>
        <p className="mt-3 text-[hsl(var(--muted-foreground))] leading-relaxed max-w-md mx-auto">
          {course.description || 'هذا المساق يتطلب التسجيل للوصول إلى محتواه.'}
        </p>
        <div className="mt-2 inline-block">
          {course.course_code && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/.2)]">
              {course.course_code}
            </span>
          )}
        </div>
        <div className="mt-8 p-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <p className="font-bold text-lg mb-1">التسجيل مطلوب</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
            سجّل في هذا المساق للوصول إلى المواد الدراسية والاختبارات والمعلم الذكي.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              className="gap-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/.9)] rounded-xl px-8"
              onClick={handleEnroll}
              disabled={enrolling}
            >
              {enrolling ? (
                <><Loader2 size={16} className="animate-spin" /> جاري التسجيل...</>
              ) : (
                <><UserPlus size={18} /> سجّل الآن</>
              )}
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="rounded-xl gap-2">
                <ArrowRight size={16} /> العودة للوحة القيادة
              </Button>
            </Link>
          </div>
        </div>
      </div>
  );
}
