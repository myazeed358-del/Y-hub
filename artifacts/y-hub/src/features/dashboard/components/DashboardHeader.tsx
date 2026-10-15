import {
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CreateCourseDialog } from '@/features/dashboard/components/CreateCourseDialog';
import type { getDashboardCopy } from '@/i18n/dashboardCopy';

interface DashboardHeaderProps {
  copy: ReturnType<typeof getDashboardCopy>;
  roleLabel: string;
  firstName: string;
  isArabic: boolean;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  newTitle: string;
  setNewTitle: (value: string) => void;
  newCode: string;
  setNewCode: (value: string) => void;
  newDesc: string;
  setNewDesc: (value: string) => void;
  handleCreateCourse: () => Promise<void>;
}

export function DashboardHeader({
  copy,
  roleLabel,
  firstName,
  isArabic,
  isOpen,
  setIsOpen,
  newTitle,
  setNewTitle,
  newCode,
  setNewCode,
  newDesc,
  setNewDesc,
  handleCreateCourse,
}: DashboardHeaderProps) {
  return (
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-300/70 bg-secondary p-6 shadow-[0_18px_55px_rgba(51,65,85,0.10)] dark:border-slate-800/80 dark:bg-[#0b1220]/90 dark:shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/[0.09] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/[0.08] blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/70 bg-cyan-50 px-3 py-1.5 text-[11px] font-black text-cyan-800 dark:border-cyan-400/15 dark:bg-cyan-400/[0.06] dark:text-cyan-300">
                <GraduationCap size={14} />
                {copy.workspace}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-slate-500">
                <ShieldCheck size={13} />
                {roleLabel}
              </span>
            </div>

            <h1 className="max-w-3xl text-3xl font-black tracking-tight text-foreground dark:text-white sm:text-4xl lg:text-5xl">
              {copy.welcome}{' '}
              <span className="bg-gradient-to-r from-cyan-700 to-violet-700 dark:from-cyan-300 dark:to-violet-400 bg-clip-text text-transparent">
                {firstName}
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#475569] dark:text-slate-400 sm:text-base">
              {copy.subtitle}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-600">
              <span className="inline-flex items-center gap-2">
                <Sparkles size={13} className="text-violet-400" />
                {copy.academicControl}
              </span>

              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,.9)]" />
                {copy.sync}
              </span>
            </div>
          </div>

          <CreateCourseDialog
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            isArabic={isArabic}
            copy={copy}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            newCode={newCode}
            setNewCode={setNewCode}
            newDesc={newDesc}
            setNewDesc={setNewDesc}
            handleCreateCourse={handleCreateCourse}
          />
        </div>
      </section>
  );
}
