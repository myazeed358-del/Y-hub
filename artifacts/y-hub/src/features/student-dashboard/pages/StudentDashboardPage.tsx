import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { StudentDashboardMain } from '../components/StudentDashboardMain';
import { StudentDashboardSidebar } from '../components/StudentDashboardSidebar';
export default function StudentDashboard() {
 const {t,firstName,enrolledIds,courses,enrollingId,handleEnroll,setLocation,tools}=useStudentDashboard();
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
