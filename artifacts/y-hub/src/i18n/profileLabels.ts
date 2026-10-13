export const majorLabels: Record<string, { ar: string; en: string }> = {
  mathematics: { ar: 'الرياضيات', en: 'Mathematics' },
  medicine: { ar: 'الطب والصيدلة', en: 'Medicine & Pharmacy' },
  engineering: { ar: 'الهندسة', en: 'Engineering' },
  humanities: { ar: 'العلوم الإنسانية', en: 'Humanities' },
  cs: { ar: 'علوم الحاسوب والبرمجة', en: 'Computer Science' },
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

export const roleLabels = {
  student: { ar: 'طالب', en: 'Student' },
  instructor: { ar: 'مدرّس', en: 'Instructor' },
  admin: { ar: 'مدير', en: 'Admin' },
  super_admin: { ar: 'مدير رئيسي', en: 'Super Admin' },
} as const;
