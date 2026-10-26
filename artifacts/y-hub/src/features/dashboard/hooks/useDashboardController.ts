import { profileName } from '@/shared/identity/profileName';
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { getDashboardCopy } from "@/i18n/dashboardCopy";
import type { Course } from "../types";
import { dashboardRepository } from "../services/dashboardRepository";

export function useDashboardController() {
  const { user, profile, role } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [courses, setCourses] = useState<Course[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCode, setNewCode] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingEnrollmentId, setUpdatingEnrollmentId] = useState<
    string | null
  >(null);

  const copy = getDashboardCopy(isArabic);
  const deleting = useRef(new Set<string>());
  const viewer = useRef(user?.id);
  viewer.current = user?.id;

  const loadCourses = async () => {
    if (!user) {
      setCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await dashboardRepository.listManagedCourses(
      user.id,
      role,
    );

    if (error) {
      console.error("Failed to load instructor courses:", error);
      setCourses([]);
    } else {
      setCourses((data ?? []) as Course[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadCourses();
  }, [user, role]);

  const resetCourseForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewCode("");
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
      console.error("Failed to create course:", error);
      toast.error(copy.createError);
      return;
    }

    toast.success(copy.createSuccess);
    resetCourseForm();
    setIsOpen(false);
    await loadCourses();
  };

  const handleDelete = async (id: string) => {
    if (!user || deleting.current.has(id)) return;
    if (!window.confirm(copy.deleteConfirm)) return;
    const actor = user.id;
    deleting.current.add(id);
    try {
      const { data, error } = await dashboardRepository.deleteCourse(id);
      if (viewer.current !== actor) return;
      if (error) {
        toast.error(
          error.code === "P0002"
            ? copy.deleteMissing
            : error.code === "42501"
              ? copy.deleteDenied
              : copy.deleteError,
        );
        return;
      }
      if (data !== id) {
        toast.error(copy.deleteUnconfirmed);
        return;
      }
      toast.success(copy.deleteSuccess);
      // Deletion is already confirmed; a refresh error must not report it failed.
      try {
        await loadCourses();
      } catch {
        toast.error(copy.refreshError);
      }
    } catch {
      if (viewer.current === actor) toast.error(copy.deleteUnconfirmed);
    } finally {
      deleting.current.delete(id);
    }
  };

  const handleToggleStatus = async (course: Course) => {
    const { error } = await dashboardRepository.setPublished(
      course.id,
      !course.is_published,
    );

    if (error) {
      console.error("Failed to update course status:", error);
      toast.error(copy.statusError);
      return;
    }

    toast.success(
      course.is_published ? copy.unpublishSuccess : copy.publishSuccess,
    );

    await loadCourses();
  };

  const handleToggleEnrollmentOpen = async (course: Course) => {
    if (updatingEnrollmentId) return;
    setUpdatingEnrollmentId(course.id);
    try {
      const { error } = await dashboardRepository.setEnrollmentOpen(
        course.id,
        !course.enrollment_open,
      );
      if (error) throw error;
      toast.success(
        course.enrollment_open
          ? copy.registrationClosedSuccess
          : copy.registrationOpenedSuccess,
      );
      await loadCourses();
    } catch (error) {
      console.error("Failed to update enrollment availability:", error);
      toast.error(copy.registrationUpdateError);
    } finally {
      setUpdatingEnrollmentId(null);
    }
  };

  const accountName =
    profileName(profile, language) ||
    user?.email?.split("@")[0] ||
    (isArabic ? "مستخدم Y HUB" : "Y HUB User");

  const firstName = accountName.split(/\s+/)[0] || accountName;

  const publishedCount = courses.filter((course) => course.is_published).length;

  const draftCount = courses.length - publishedCount;

  const roleLabel =
    role === "super_admin"
      ? copy.roleSuperAdmin
      : role === "admin"
        ? copy.roleAdmin
        : copy.roleInstructor;

  return {
    isArabic,
    copy,
    roleLabel,
    firstName,
    viewerId: user?.id ?? null,
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
    handleToggleStatus,
    handleToggleEnrollmentOpen,
    updatingEnrollmentId,
  };
}
