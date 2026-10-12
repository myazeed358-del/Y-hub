import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';

import { useAuth } from '@/contexts/AuthContext';
import { ENGINE_CATALOG, searchEngines } from '@/config/majorEngineAccess';
import { getCourses } from '@/utils/courseStorage';
import { useLanguage } from '@/i18n/LanguageContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { buildNavigationGroups } from '@/components/layout/navigation';


export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const { language, t } = useLanguage();
  const {
    profile: authProfile,
    user,
    signOut,
  } = useAuth();
  const [activeCourseName, setActiveCourseName] = useState<string | null>(null);
  const [engineSearch, setEngineSearch] = useState('');
  const [engineInfoTooltip, setEngineInfoTooltip] = useState<{
    engineId: string;
    top: number;
    anchorX: number;
  } | null>(null);

  const dynamicNavItems = useMemo(
    () => buildNavigationGroups(
      authProfile?.role,
      authProfile?.major
    ),
    [authProfile?.major, authProfile?.role]
  );

  useEffect(() => {
    const courseMatch = location.match(/\/course\/([^/]+)/);

    if (courseMatch && courseMatch[1]) {
      getCourses()
        .then((courses) => {
          const course = courses.find((item) => item.id === courseMatch[1]);
          setActiveCourseName(course ? course.title : null);
        })
        .catch(() => setActiveCourseName(null));
    } else if (location.startsWith('/lesson/')) {
      setActiveCourseName(
        language === 'ar' ? 'المجموعات الضبابية' : 'Fuzzy Sets'
      );
    } else if (
      [
        '/lab',
        '/matrix-calc',
        '/simplex',
        '/calculus',
        '/solver',
        '/sandbox',
        '/med-sim',
      ].includes(location)
    ) {
      // Keep the active course context when moving into a related tool.
    } else {
      setActiveCourseName(null);
    }
  }, [location, language]);

  const currentTitle =
    location === '/' || location === '/dashboard'
      ? t('overview')
      : location === '/profile'
        ? language === 'ar'
          ? 'الملف الشخصي'
          : 'Profile'
        : location === '/lab'
          ? t('lab')
          : location === '/solver'
            ? t('solver')
            : location.startsWith('/course')
              ? t('coursePlan')
              : location === '/quiz'
                ? t('quickPractice')
                : location === '/calculus'
                  ? t('calculusPlotter')
                  : location === '/math-solver'
                    ? t('calculus3Solver')
                    : t('lessonPath');

  const majorLabels: Record<string, { ar: string; en: string }> = {
    mathematics: { ar: 'الرياضيات', en: 'Mathematics' },
    medicine: { ar: 'الطب والصيدلة', en: 'Medicine & Pharmacy' },
    engineering: { ar: 'الهندسة', en: 'Engineering' },
    humanities: { ar: 'العلوم الإنسانية', en: 'Humanities' },
    cs: { ar: 'علوم الحاسوب', en: 'Computer Science' },
    general: { ar: 'عام', en: 'General' },
    business_administration: {
      ar: 'إدارة الأعمال',
      en: 'Business Administration',
    },
    finance: { ar: 'التمويل', en: 'Finance' },
    accounting: { ar: 'المحاسبة', en: 'Accounting' },
    hotel_management: { ar: 'إدارة الفنادق', en: 'Hotel Management' },
    tourism_management: {
      ar: 'الإدارة السياحية',
      en: 'Tourism Management',
    },
    law: { ar: 'الحقوق', en: 'Law' },
    nursing: { ar: 'التمريض', en: 'Nursing' },
    biological_sciences: {
      ar: 'العلوم الحياتية',
      en: 'Biological Sciences',
    },
    applied_english: {
      ar: 'اللغة الإنجليزية التطبيقية',
      en: 'Applied English',
    },
    english_language_literature: {
      ar: 'اللغة الإنجليزية وآدابها',
      en: 'English Language & Literature',
    },
    arabic_language_literature: {
      ar: 'اللغة العربية وآدابها',
      en: 'Arabic Language & Literature',
    },
    french_language_literature: {
      ar: 'اللغة الفرنسية وآدابها',
      en: 'French Language & Literature',
    },
    computer_information_systems: {
      ar: 'نظم المعلومات الحاسوبية',
      en: 'Computer Information Systems',
    },
    business_information_technology: {
      ar: 'تكنولوجيا معلومات الأعمال',
      en: 'Business Information Technology',
    },
    cybersecurity: {
      ar: 'الأمن السيبراني',
      en: 'Cybersecurity',
    },
  };

  const roleLabels: Record<string, { ar: string; en: string }> = {
    student: { ar: 'طالب', en: 'Student' },
    instructor: { ar: 'مدرّس', en: 'Instructor' },
    admin: { ar: 'مدير', en: 'Admin' },
    super_admin: { ar: 'مدير رئيسي', en: 'Super Admin' },
  };

  const accountName =
    authProfile?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    (language === 'ar' ? 'مستخدم Y HUB' : 'Y HUB User');

  const firstName = accountName.split(/\s+/)[0] || accountName;
  const avatarInitial = accountName.charAt(0).toUpperCase() || '•';

  const majorLabel = authProfile?.major
    ? majorLabels[authProfile.major]?.[language] ??
      authProfile.major.replaceAll('_', ' ')
    : null;

  const studyYearLabel =
    authProfile?.role === 'student' && authProfile?.study_year
      ? language === 'ar'
        ? `السنة ${authProfile.study_year}`
        : `Year ${authProfile.study_year}`
      : null;

  const roleLabel = authProfile?.role
    ? roleLabels[authProfile.role]?.[language] ?? authProfile.role
    : language === 'ar'
      ? 'حساب أكاديمي'
      : 'Academic account';

  const academicMeta =
    [majorLabel, studyYearLabel].filter(Boolean).join(' · ') || roleLabel;

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const instructorSearchResults =
    authProfile?.role === 'instructor'
      ? searchEngines(engineSearch, language).slice(0, 6)
      : [];

  const normalizedEngineSearch = engineSearch.trim().toLowerCase();

  const quickPracticeSearchMatch =
    authProfile?.role === 'instructor' &&
    normalizedEngineSearch.length > 0 &&
    [
      'quick practice',
      'practice',
      'quiz',
      'quick',
      'تدريب سريع',
      'تدريب',
      'تمرين',
      'أسئلة',
      'اختبار',
    ].some((term) =>
      term.includes(normalizedEngineSearch) ||
      normalizedEngineSearch.includes(term)
    );

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-[100dvh] bg-background text-foreground"
      style={{
        backgroundImage:
          'radial-gradient(circle at 85% 0%, rgba(34,211,238,0.07), transparent 30%), radial-gradient(circle at 15% 100%, rgba(139,92,246,0.07), transparent 32%)',
      }}
    >
      {engineInfoTooltip &&
        typeof document !== 'undefined' &&
        (() => {
          const engine = ENGINE_CATALOG.find(
            (item) => item.id === engineInfoTooltip.engineId
          );

          if (!engine) return null;

          return createPortal(
            <div
              role="tooltip"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              className="pointer-events-none fixed z-[9999] w-72 -translate-y-1/2 rounded-2xl border border-slate-700/80 bg-[#0b1220]/98 p-4 text-start shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              style={{
                top: engineInfoTooltip.top,
                ...(language === 'ar'
                  ? {
                      right:
                        window.innerWidth -
                        engineInfoTooltip.anchorX +
                        12,
                    }
                  : {
                      left: engineInfoTooltip.anchorX + 12,
                    }),
              }}
            >
              <div className="text-sm font-bold text-slate-100">
                {engine.title[language]}
              </div>

              <p className="mt-2 text-xs font-normal leading-6 text-slate-400">
                {engine.description[language]}
              </p>
            </div>,
            document.body
          );
        })()}

      <AppSidebar
        mobileNav={mobileNav}
        onCloseMobileNav={() => setMobileNav(false)}
        activeCourseName={activeCourseName}
        isInstructor={authProfile?.role === 'instructor'}
        location={location}
        accountName={accountName}
        academicMeta={academicMeta}
        avatarInitial={avatarInitial}
        engineSearch={engineSearch}
        onEngineSearchChange={setEngineSearch}
        instructorSearchResults={instructorSearchResults}
        quickPracticeSearchMatch={quickPracticeSearchMatch}
        dynamicNavItems={dynamicNavItems}
        majorLabels={majorLabels}
        onEngineInfoTooltipChange={setEngineInfoTooltip}
      />

      {mobileNav && (
        <button
          aria-label={t('closeMenu')}
          data-testid="button-mobile-nav-backdrop"
          onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      <div
        className={`relative min-h-[100dvh] ${
          language === 'ar'
            ? 'md:mr-[288px]'
            : 'md:ml-[288px]'
        }`}
      >
        <AppHeader
          currentTitle={currentTitle}
          firstName={firstName}
          academicMeta={academicMeta}
          accountName={accountName}
          avatarInitial={avatarInitial}
          roleLabel={roleLabel}
          userEmail={user?.email}
          onOpenMobileNav={() => setMobileNav(true)}
          onSignOut={handleSignOut}
        />

        <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 md:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
