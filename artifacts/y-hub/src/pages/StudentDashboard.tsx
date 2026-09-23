import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, BookOpen, Calculator, Settings, PlayCircle, Book, Calendar, FunctionSquare, LineChart, Activity, Clock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../App';

// Progress Components inline to avoid extra files
function CircularProgress({ progress, size = 120, strokeWidth = 10, label, sublabel }: any) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={sublabel}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-muted" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-primary transition-all duration-1000 ease-out" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label && <span className="text-2xl font-bold text-foreground">{label}</span>}
        {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}

function HorizontalProgress({ progress, label, valueText }: any) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-primary">{valueText}</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLocation('/login');
        return;
      }
      
      const { data: profileData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setProfile(profileData);

      const { data: coursesData } = await supabase.from('courses').select('*').eq('is_published', true).order('created_at', { ascending: false });
      if (coursesData) setCourses(coursesData);

      const { data: enrollmentsData } = await supabase.from('course_enrollments').select('course_id').eq('student_id', user.id).eq('status', 'active');
      if (enrollmentsData) {
        setEnrolledIds(new Set(enrollmentsData.map((e: any) => e.course_id)));
      }
    }
    loadData();
  }, [setLocation]);

  const handleEnroll = async (courseId: string) => {
    setEnrollingId(courseId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase.from('course_enrollments').insert({ course_id: courseId, student_id: user.id, status: 'active' });
      if (error) {
        if (error.code === '23505') {
          toast.info(t('alreadyEnrolled') || 'Already enrolled');
        } else {
          throw error;
        }
      } else {
        toast.success(t('enrolledSuccessfully') || 'Enrolled successfully!');
      }
      
      setEnrolledIds(prev => new Set([...prev, courseId]));
    } catch (e) {
      console.error(e);
      toast.error('Enrollment failed');
    } finally {
      setEnrollingId(null);
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', active: true },
    { name: 'My Courses', icon: BookOpen, path: '/legacy-course', active: false },
    { name: 'Math Lab', icon: Calculator, path: '/math-solver', active: false },
  ];

  const tools = [
    { name: 'Graphing', icon: LineChart, path: '/calculus' },
    { name: 'Equations', icon: FunctionSquare, path: '/solver' },
    { name: 'Statistics', icon: Activity, path: '/lab' },
  ];

  const firstName = profile?.full_name?.split(' ')[0] || (language === 'ar' ? 'طالب' : 'Student');

  // Integrate naturally into Shell - no fixed inset-0 overlay
  return (
    <div className="flex flex-col xl:flex-row gap-8 w-full max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* MAIN CONTENT AREA */}
      <div className="flex-1 space-y-8 min-w-0">
        <header>
          <h1 className="text-3xl font-bold mb-2">
            {t('welcomeBack')} <span className="text-[hsl(var(--primary))] font-extrabold">{firstName}</span>!
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">{t('digitalHub')}</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 flex flex-col items-center justify-center shadow-sm">
            <CircularProgress progress={enrolledIds.size > 0 ? 100 : 0} label={`${enrolledIds.size}`} sublabel={t('enrolledCourses')} />
          </div>
          <div className="md:col-span-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 flex flex-col justify-center shadow-sm">
            <h2 className="text-xl font-bold mb-6">{t('currentObjectives')}</h2>
            <div className="flex flex-col gap-5">
              {enrolledIds.size === 0 ? (
                <div className="text-[hsl(var(--muted-foreground))] text-sm">{t('noObjectives')}</div>
              ) : (
                <>
                  <HorizontalProgress progress={0} label={t('completeAssignments')} valueText="0/0" />
                  <HorizontalProgress progress={0} label={t('weeklyLectures')} valueText="0/0 hrs" />
                </>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{t('availableCourses')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {courses.length === 0 ? (
              <div className="col-span-full text-[hsl(var(--muted-foreground))] text-center py-10">{t('noCourses')}</div>
            ) : courses.map((course) => {
              const isEnrolled = enrolledIds.has(course.id);
              const isEnrolling = enrollingId === course.id;
              
              return (
                <div key={course.id} className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-5 hover:border-[hsl(var(--primary)/.5)] transition-colors group flex flex-col shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary)/.1)] flex items-center justify-center mb-4 group-hover:bg-[hsl(var(--primary)/.2)] transition-colors">
                    <Book className="text-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary))]" size={24} />
                  </div>
                  <div className="text-xs text-[hsl(var(--primary))] mb-1 font-medium">{course.course_code || 'GEN'}</div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4 line-clamp-1">{course.title}</h3>
                  <div className="flex justify-between items-end mb-4 mt-auto">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{isEnrolled ? t('enrolled') : t('notEnrolled')}</span>
                    <span className="text-sm font-bold text-[hsl(var(--foreground))]">{isEnrolled ? '100%' : '0%'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[hsl(var(--background))] rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-[hsl(var(--primary))]" style={{ width: isEnrolled ? '100%' : '0%' }} />
                  </div>
                  {isEnrolled ? (
                    <button onClick={() => setLocation(`/course/${course.id}/view`)} className="w-full py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold hover:opacity-90 transition-opacity">
                      {t('enterCourse')}
                    </button>
                  ) : (
                    <button onClick={() => handleEnroll(course.id)} disabled={isEnrolling} className="w-full py-2 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-semibold hover:bg-[hsl(var(--accent)/.1)] transition-colors">
                      {isEnrolling ? t('enrolling') : t('enrollNow')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* RIGHT SIDEBAR PANEL */}
      <div className="w-full xl:w-[320px] shrink-0 space-y-6">
        {/* Tools */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">{t('quickTools')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {tools.map((tool, i) => {
              const Icon = tool.icon;
              return (
                <button key={i} onClick={() => setLocation(tool.path)} className="flex flex-col items-center justify-center p-3 rounded-xl bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent)/.1)] border border-[hsl(var(--border))] transition-colors gap-2">
                  <Icon size={20} className="text-[hsl(var(--primary))]" />
                  <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">{t(tool.name.toLowerCase() as any) || tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Exams */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-[hsl(var(--primary))]" /> {t('upcomingExams')}
          </h3>
          <div className="flex flex-col gap-3">
             <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">{t('noExams')}</div>
          </div>
        </div>

        {/* Activity */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-[hsl(var(--primary))]" /> {t('recentActivity')}
          </h3>
          <div className="flex flex-col gap-3">
             <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">{t('noActivity')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
