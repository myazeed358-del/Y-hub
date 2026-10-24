import {useAuth} from '@/contexts/AuthContext';
import {useLanguage} from '@/i18n/LanguageContext';
import {useQuickAccess} from '../hooks/useQuickAccess';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { StudentDashboardMain } from '../components/StudentDashboardMain';
import { StudentDashboardSidebar } from '../components/StudentDashboardSidebar';
export default function StudentDashboard() {
 const {t,firstName,enrolledIds,courses,enrollingId,handleEnroll,setLocation}=useStudentDashboard();
 const {user}=useAuth();const {language}=useLanguage();const quickAccess=useQuickAccess(user?.id,language);
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
        tools={quickAccess.tools}
        quickAccess={quickAccess}
        language={language}
        setLocation={setLocation}
      />
    </div>
  );
}
