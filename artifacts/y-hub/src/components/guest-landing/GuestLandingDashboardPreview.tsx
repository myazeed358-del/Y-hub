import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import type { guestCopy } from '@/i18n/guestLandingCopy';
import { PreviewLine } from '@/components/guest-landing/PreviewLine';
import { StatCard } from '@/components/guest-landing/StatCard';
import { CoursePreview } from '@/components/guest-landing/CoursePreview';

type GuestLandingDashboardPreviewProps = {
  language: 'ar' | 'en';
  copy: (typeof guestCopy)['ar' | 'en'];
};

export function GuestLandingDashboardPreview({
  language,
  copy,
}: GuestLandingDashboardPreviewProps) {
  return (
        <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="relative mx-auto w-full max-w-[900px] lg:-mr-16 lg:-translate-y-8 xl:-mr-24 xl:-translate-y-10">
          <div className="absolute -inset-12 rounded-[4rem] bg-gradient-to-br from-cyan-500/20 via-blue-500/5 to-violet-600/20 blur-[70px]" />

          <div className="relative rotate-[2deg] rounded-[2rem] border border-cyan-400/15 bg-[#09111f]/92 p-3 shadow-[0_45px_140px_rgba(0,0,0,.65),0_0_70px_rgba(34,211,238,.08)] backdrop-blur-xl transition duration-500 hover:rotate-[0.5deg] hover:scale-[1.01]">
            <div className="overflow-hidden rounded-[1.55rem] border border-white/[0.07] bg-[#07101d]">
              {/* Preview topbar */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {copy.studentDashboard}
                  </p>
                  <h2 className="mt-1 text-sm font-black text-slate-100">
                    {copy.welcome}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.8)]" />
                  <span className="text-[10px] font-bold text-slate-500">
                    {copy.online}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 p-4 md:grid-cols-[0.72fr_1.28fr]">
                {/* Side */}
                <div className="flex h-full flex-col gap-3">
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                        <TrendingUp size={17} />
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {copy.semester}
                      </span>
                    </div>

                    <div className="text-3xl font-black text-white">75%</div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {copy.progress}
                    </p>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full w-3/4 rounded-full bg-gradient-to-l from-cyan-300 to-violet-500" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <CalendarDays size={15} className="text-violet-400" />
                      <span className="text-xs font-black">{copy.upcoming}</span>
                    </div>

                    <div className="space-y-2">
                      <PreviewLine title={copy.lecture} time="10:00" />
                      <PreviewLine title={copy.shortQuiz} time="13:30" />
                      <PreviewLine title={copy.review} time="16:00" />
                    </div>
                  </div>

                  <div className="flex min-h-[82px] flex-1 items-center rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.035] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                        <CheckCircle2 size={16} />
                      </div>

                      <div>
                        <div className="text-xs font-black text-slate-200">
                          {copy.progressSaved}
                        </div>
                        <div className="mt-1 text-[9px] text-slate-500">
                          {copy.continueLearning}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      icon={<BookOpen size={16} />}
                      value="5"
                      label={copy.currentCourses}
                    />
                    <StatCard
                      icon={<CheckCircle2 size={16} />}
                      value="12"
                      label={copy.completedTasks}
                    />
                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black">{copy.currentCourses}</p>
                        <p className="mt-1 text-[9px] text-slate-500">
                          {copy.followProgress}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-cyan-300">
                        {copy.viewAll}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <CoursePreview
                        code="01"
                        title={copy.courseOne}
                        progress="82%"
                      />
                      <CoursePreview
                        code="02"
                        title={copy.courseTwo}
                        progress="68%"
                      />
                      <CoursePreview
                        code="03"
                        title={copy.courseThree}
                        progress="54%"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1.15fr_.85fr]">
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <p className="text-xs font-black">{copy.weeklyActivity}</p>

                      <div className="mt-5 flex h-20 items-end gap-2">
                        {[34, 58, 42, 76, 52, 88, 68].map((height, index) => (
                          <div
                            key={index}
                            className="flex-1 rounded-t-md bg-gradient-to-t from-cyan-500/25 to-cyan-300/80"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <p className="text-xs font-black">{copy.weeklyAchievement}</p>
                      <div className="mt-4 flex items-end gap-1">
                        <span className="text-3xl font-black text-cyan-300">
                          8
                        </span>
                        <span className="pb-1 text-[9px] text-slate-500">
                          {copy.activities}
                        </span>
                      </div>
                      <p className="mt-2 text-[9px] leading-4 text-slate-500">
                        {copy.steadyProgress}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
  );
}
