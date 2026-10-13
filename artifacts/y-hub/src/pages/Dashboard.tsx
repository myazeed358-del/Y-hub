import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { getDashboardCopy } from '@/i18n/dashboardCopy';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { DashboardCourseSection } from '@/components/dashboard/DashboardCourseSection';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import type { Course } from '@/components/dashboard/DashboardCourseCard';



export default function Dashboard() {
  const { user, profile, role } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [courses, setCourses] = useState<Course[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCode, setNewCode] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const copy = getDashboardCopy(isArabic);

  const loadCourses = async () => {
    if (!user) {
      setCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load instructor courses:', error);
      setCourses([]);
    } else {
      setCourses((data ?? []) as Course[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadCourses();
  }, [user]);

  const resetCourseForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewCode('');
  };

  const handleCreateCourse = async () => {
    if (!newTitle.trim()) {
      toast.error(copy.titleRequired);
      return;
    }

    if (!user) return;

    const { error } = await supabase.from('courses').insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      course_code: newCode.trim() || null,
      instructor_id: user.id,
      is_published: false,
    });

    if (error) {
      console.error('Failed to create course:', error);
      toast.error(copy.createError);
      return;
    }

    toast.success(copy.createSuccess);
    resetCourseForm();
    setIsOpen(false);
    await loadCourses();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(copy.deleteConfirm)) return;

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete course:', error);
      toast.error(copy.deleteError);
      return;
    }

    toast.success(copy.deleteSuccess);
    await loadCourses();
  };

  const handleToggleStatus = async (course: Course) => {
    const { error } = await supabase
      .from('courses')
      .update({ is_published: !course.is_published })
      .eq('id', course.id);

    if (error) {
      console.error('Failed to update course status:', error);
      toast.error(copy.statusError);
      return;
    }

    toast.success(
      course.is_published
        ? copy.unpublishSuccess
        : copy.publishSuccess
    );

    await loadCourses();
  };

  const accountName =
    profile?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    (isArabic ? 'مستخدم Y HUB' : 'Y HUB User');

  const firstName = accountName.split(/\s+/)[0] || accountName;

  const publishedCount = courses.filter(
    (course) => course.is_published
  ).length;

  const draftCount = courses.length - publishedCount;

  const roleLabel =
    role === 'super_admin'
      ? copy.roleSuperAdmin
      : role === 'admin'
        ? copy.roleAdmin
        : copy.roleInstructor;

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1320px] space-y-7 animate-in fade-in duration-500"
    >
      <DashboardHeader
        copy={copy}
        roleLabel={roleLabel}
        firstName={firstName}
        isArabic={isArabic}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        newCode={newCode}
        setNewCode={setNewCode}
        newDesc={newDesc}
        setNewDesc={setNewDesc}
        handleCreateCourse={handleCreateCourse}
      />
      <DashboardStats
        copy={copy}
        loading={loading}
        courses={courses}
        publishedCount={publishedCount}
        draftCount={draftCount}
      />
      <DashboardCourseSection
        copy={copy}
        loading={loading}
        courses={courses}
        setIsOpen={setIsOpen}
        handleDelete={handleDelete}
        handleToggleStatus={handleToggleStatus}
      />
    </div>
  );
}
