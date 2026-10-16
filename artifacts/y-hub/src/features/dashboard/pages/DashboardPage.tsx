import * as React from 'react';
import { DashboardStats } from '../components/DashboardStats';
import { DashboardCourseSection } from '../components/DashboardCourseSection';
import { DashboardHeader } from '../components/DashboardHeader';
import { useDashboardController } from '../hooks/useDashboardController';

export default function DashboardPage() {
  const {
    isArabic,
    copy,
    roleLabel,
    firstName,
    viewerId,
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
  } = useDashboardController();

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
        viewerId={viewerId}
        isArabic={isArabic}
        loading={loading}
        courses={courses}
        setIsOpen={setIsOpen}
        handleDelete={handleDelete}
        handleToggleStatus={handleToggleStatus}
        handleToggleEnrollmentOpen={handleToggleEnrollmentOpen}
        updatingEnrollmentId={updatingEnrollmentId}
      />
    </div>
  );
}
