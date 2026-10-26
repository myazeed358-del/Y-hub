import { profileName } from '@/shared/identity/profileName';
import type { Language } from '@/i18n/uiCopy';

export interface AcademicProfileIdentity {
  full_name?: string | null;
  full_name_ar?: string | null;
  full_name_en?: string | null;
  role?: string | null;
  major?: string | null;
  study_year?: number | string | null;
}

export interface AcademicIdentityInput {
  language: Language;
  profile?: AcademicProfileIdentity | null;
  email?: string | null;
}

export const majorLabels: Record<string, { ar: string; en: string }> = {
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

  export const roleLabels: Record<string, { ar: string; en: string }> = {
    student: { ar: 'طالب', en: 'Student' },
    instructor: { ar: 'مدرّس', en: 'Instructor' },
    admin: { ar: 'مدير', en: 'Admin' },
    super_admin: { ar: 'Owner', en: 'Owner' },
  };

export function buildAcademicIdentity({
  profile: authProfile,
  email,
  language,
}: AcademicIdentityInput) {
  const user = email == null ? null : { email };

  const accountName =
    profileName(authProfile, language) ||
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

  return {
    accountName,
    firstName,
    avatarInitial,
    majorLabel,
    studyYearLabel,
    roleLabel,
    academicMeta,
  };
}
