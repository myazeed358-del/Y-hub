import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, GraduationCap, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';
import YHubLogo from '@/components/YHubLogo';
import ScientificBackdrop from '@/components/ScientificBackdrop';

type GuestLandingProps = {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
};

const guestCopy = {
  ar: {
    home: 'الرئيسية',
    about: 'عن المنصة',
    contact: 'تواصل معنا',
    description:
      'Y HUB منصة أكاديمية للطالب الجامعي، تجمع المحتوى التعليمي، الحلول المتخصصة، الاختبارات، ومتابعة التقدم في تجربة مصممة حسب تخصصك.',
    createAccount: 'إنشاء حساب',
    signIn: 'تسجيل الدخول',
    studentDashboard: 'لوحة الطالب',
    welcome: 'أهلاً بك في Y HUB',
    online: 'متصل',
    semester: 'هذا الفصل',
    progress: 'التقدم الأكاديمي',
    upcoming: 'الجدول القادم',
    lecture: 'محاضرة',
    shortQuiz: 'اختبار قصير',
    review: 'جلسة مراجعة',
    currentCourses: 'المساقات الحالية',
    completedTasks: 'مهام مكتملة',
    followProgress: 'تابع تقدمك من مكان واحد',
    viewAll: 'عرض الكل',
    courseOne: 'المساق الأول',
    courseTwo: 'المساق الثاني',
    courseThree: 'المساق الثالث',
    weeklyActivity: 'النشاط الأسبوعي',
    weeklyAchievement: 'إنجاز الأسبوع',
    activities: 'نشاطات',
    steadyProgress: 'تقدم ثابت خلال الأيام الماضية.',
    progressSaved: 'تقدمك محفوظ',
    continueLearning: 'أكمل من حيث توقفت',
  },
  en: {
    home: 'Home',
    about: 'About',
    contact: 'Contact',
    description:
      'Y HUB is an academic platform for university students, bringing together learning content, specialized solutions, assessments, and progress tracking in an experience tailored to your major.',
    createAccount: 'Create Account',
    signIn: 'Sign In',
    studentDashboard: 'Student Dashboard',
    welcome: 'Welcome to Y HUB',
    online: 'Online',
    semester: 'This Semester',
    progress: 'Academic Progress',
    upcoming: 'Upcoming Schedule',
    lecture: 'Lecture',
    shortQuiz: 'Short Quiz',
    review: 'Review Session',
    currentCourses: 'Current Courses',
    completedTasks: 'Completed Tasks',
    followProgress: 'Track your progress from one place',
    viewAll: 'View All',
    courseOne: 'Course One',
    courseTwo: 'Course Two',
    courseThree: 'Course Three',
    weeklyActivity: 'Weekly Activity',
    weeklyAchievement: 'Weekly Achievement',
    activities: 'activities',
    steadyProgress: 'Steady progress over the past few days.',
    progressSaved: 'Progress Saved',
    continueLearning: 'Continue where you left off',
  },
} as const;

export default function GuestLanding({
  language,
  onToggleLanguage,
}: GuestLandingProps) {
  const copy = guestCopy[language];

  return (
    <main
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="relative min-h-screen overflow-hidden bg-[#050914] text-white"
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-10rem] h-[32rem] w-[32rem] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute bottom-[-12rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-violet-600/10 blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />

        <ScientificBackdrop />
      </div>

      {/* Header */}
      <header dir="ltr" className="relative z-20 mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-6 lg:px-14">
        <YHubLogo size="sm" />

        <div className="flex items-center gap-5">
          <nav
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="hidden items-center gap-8 text-sm font-bold text-slate-400 md:flex"
          >
            <a href="#home" className="text-white transition hover:text-cyan-300">
              {copy.home}
            </a>
            <a href="#about" className="transition hover:text-white">
              {copy.about}
            </a>
            <a href="#contact" className="transition hover:text-white">
              {copy.contact}
            </a>
          </nav>

          <button
            type="button"
            onClick={onToggleLanguage}
            className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-400/10"
            aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section dir="ltr" className="relative z-10 mx-auto grid min-h-[calc(100vh-100px)] w-full max-w-[1600px] items-center gap-6 px-6 pb-12 pt-2 lg:grid-cols-[0.78fr_1.22fr] lg:px-14 lg:pb-16">
        {/* Text */}
        <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="relative z-10 max-w-xl">

          <div className="mb-6 yhub-display" dir="ltr">
            <YHubLogo size="hero" />
          </div>

          <p
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="mt-7 max-w-lg text-base font-medium leading-8 text-slate-400 sm:text-lg"
          >
            {copy.description}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/login?mode=signup"
              className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-3.5 text-sm font-black text-[#031019] shadow-[0_0_40px_rgba(34,211,238,.2)] transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              {copy.createAccount}
              <ArrowLeft size={16} />
            </Link>

            <Link
              href="/login"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-6 py-3.5 text-sm font-black text-slate-200 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              {copy.signIn}
            </Link>
          </div>
        </div>

        {/* Student dashboard preview */}
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
      </section>
    </main>
  );
}

function PreviewLine({ title, time }: { title: string; time: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2">
      <span className="text-[9px] font-bold text-slate-300">{title}</span>
      <span className="font-mono text-[9px] text-slate-600">{time}</span>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-start justify-between">
        <div className="text-2xl font-black">{value}</div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-[9px] text-slate-500">{label}</p>
    </div>
  );
}

function CoursePreview({
  code,
  title,
  progress,
}: {
  code: string;
  title: string;
  progress: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-[#0a1423] p-3">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/15 to-violet-500/15 font-mono text-[9px] font-black text-cyan-300">
        {code}
      </div>

      <p className="text-[10px] font-black text-slate-200">{title}</p>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: progress }}
        />
      </div>

      <p className="mt-2 text-[8px] text-slate-600">{progress}</p>
    </div>
  );
}
