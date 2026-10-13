import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import {
  LayoutDashboard,
  BookOpen,
  Calculator,
  FunctionSquare,
  LineChart,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import { StudentDashboardMain } from '@/components/student-dashboard/StudentDashboardMain';
import { StudentDashboardSidebar } from '@/components/student-dashboard/StudentDashboardSidebar';

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
      <StudentDashboardMain
        t={t}
        firstName={firstName}
        enrolledIds={enrolledIds}
        courses={courses}
        enrollingId={enrollingId}
        handleEnroll={handleEnroll}
        setLocation={setLocation}
      />

      {/* RIGHT SIDEBAR PANEL */}
      <StudentDashboardSidebar
        t={t}
        tools={tools}
        setLocation={setLocation}
      />
    </div>
  );
}
