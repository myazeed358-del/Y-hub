import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { getDashboardCopy } from '@/i18n/dashboardCopy';
import type { Course } from '../types';
import { dashboardRepository } from '../services/dashboardRepository';

export function useDashboardController() {
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

    const { data, error } =
      await dashboardRepository.listInstructorCourses(user.id);

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

    const { error } = await dashboardRepository.createCourse({
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

    const { error } = await dashboardRepository.deleteCourse(id);

    if (error) {
      console.error('Failed to delete course:', error);
      toast.error(copy.deleteError);
      return;
    }

    toast.success(copy.deleteSuccess);
    await loadCourses();
  };

  const handleToggleStatus = async (course: Course) => {
    const { error } =
      await dashboardRepository.setPublished(
        course.id, !course.is_published
      );

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


  return {
    isArabic,
    copy,
    roleLabel,
    firstName,
    isOpen,
    setIsOpen,
    newTitle,
    setNewTitle,
    newCode,
    setNewCode,
    newDesc,
    setNewDesc,
    handleCreateCourse,
    loading,
    courses,
    publishedCount,
    draftCount,
    handleDelete,
    handleToggleStatus
  };
}
