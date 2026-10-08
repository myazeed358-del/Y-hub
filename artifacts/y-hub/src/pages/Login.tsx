import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  GraduationCap,
  Layers3,
  LockKeyhole,
  Mail,
  Phone,
  User,
  Users,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import YHubLogo from '@/components/YHubLogo';
import ScientificBackdrop from '@/components/ScientificBackdrop';

import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';

const loginCopy = {
  ar: {
    backHome: 'العودة للرئيسية',

    createTitle: 'إنشاء حساب جديد',
    loginTitle: 'تسجيل الدخول',

    createDescription: 'أنشئ حسابك وابدأ تجربتك الأكاديمية على Y HUB.',
    loginDescription: 'أدخل بيانات حسابك للعودة إلى مساحتك الأكاديمية.',

    brandHeading: 'أكثر من مجرد تعلم',
    brandDescription:
      'منصة أكاديمية تجمع المحتوى التعليمي، الحلول المتخصصة، الاختبارات ومتابعة تقدمك في تجربة واحدة مصممة للطالب الجامعي.',

    organizedTitle: 'محتوى أكاديمي منظم',
    organizedDescription: 'مساقات ومحتوى مرتب حسب تخصصك',

    toolsTitle: 'أدوات متخصصة',
    toolsDescription: 'محركات علمية وأكاديمية حسب مجال دراستك',

    progressTitle: 'متابعة التقدم',
    progressDescription: 'راقب إنجازك ونشاطك الأكاديمي',

    integratedTitle: 'تجربة جامعية متكاملة',
    integratedDescription: 'بيئة واحدة ترافقك خلال رحلتك الجامعية',

    fullName: 'الاسم الثنائي',
    fullNamePlaceholder: 'مثال: أحمد عبد الله',

    age: 'العمر',
    phone: 'رقم الهاتف',

    major: 'التخصص الأكاديمي',
    majorPlaceholder: 'اختر تخصصك',

    mathematics: 'رياضيات',
    medicine: 'طب وصيدلة',
    engineering: 'هندسة',
    humanities: 'علوم إنسانية',
    cs: 'برمجة',
    general: 'عام',
    businessAdministration: 'إدارة الأعمال',
    finance: 'التمويل',
    accounting: 'المحاسبة',
    hotelManagement: 'إدارة الفنادق',
    tourismManagement: 'الإدارة السياحية',
    law: 'الحقوق',
    nursing: 'التمريض',
    biologicalSciences: 'العلوم الحياتية',
    appliedEnglish: 'اللغة الإنجليزية التطبيقية',
    englishLanguageLiterature: 'اللغة الإنجليزية وآدابها',
    arabicLanguageLiterature: 'اللغة العربية وآدابها',
    frenchLanguageLiterature: 'اللغة الفرنسية وآدابها',
    computerInformationSystems: 'نظم المعلومات الحاسوبية',
    businessInformationTechnology: 'تكنولوجيا معلومات الأعمال',
    cybersecurity: 'الأمن السيبراني',

    studyYear: 'السنة الدراسية',
    studyYearPlaceholder: 'اختر السنة الدراسية',

    year1: 'السنة الأولى',
    year2: 'السنة الثانية',
    year3: 'السنة الثالثة',
    year4: 'السنة الرابعة',
    year5: 'أخرى / تخرج',

    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    forgotLink: 'نسيت كلمة المرور؟',
    forgotTitle: 'استعادة كلمة المرور',
    forgotDescription: 'أدخل بريدك الإلكتروني لإرسال رابط استعادة كلمة المرور.',
    forgotAction: 'إرسال رابط الاستعادة',
    forgotSent: 'إذا كان البريد مرتبطًا بحساب، ستصلك رسالة تحتوي على رابط استعادة كلمة المرور.',
    forgotFailed: 'تعذّر إرسال طلب الاستعادة. حاول مرة أخرى لاحقًا.',
    backToLogin: 'العودة إلى تسجيل الدخول',

    loading: 'جاري التحميل...',
    createAction: 'إنشاء الحساب',
    loginAction: 'تسجيل الدخول',

    or: 'أو',

    haveAccount: 'لديك حساب بالفعل؟',
    noAccount: 'ليس لديك حساب؟',
    goLogin: 'تسجيل الدخول',
    goCreate: 'إنشاء حساب جديد',

    emailNotice:
      'بعد التسجيل قد نطلب منك تأكيد بريدك الإلكتروني قبل تسجيل الدخول إلى حسابك.',

    nameError:
      'الاسم يجب أن يحتوي على حروف فقط بدون أرقام أو رموز.',

    requiredError:
      'يرجى تعبئة التخصص والسنة الدراسية.',

    unexpectedError:
      'حدث خطأ غير متوقع',

    success:
      'تم التسجيل بنجاح! يرجى مراجعة بريدك الإلكتروني وتأكيده قبل تسجيل الدخول.',
  },

  en: {
    backHome: 'Back to home',

    createTitle: 'Create a new account',
    loginTitle: 'Sign in',

    createDescription:
      'Create your account and start your academic journey on Y HUB.',

    loginDescription:
      'Enter your account details to return to your academic space.',

    brandHeading: 'More than just learning',

    brandDescription:
      'An academic platform that combines learning content, specialized tools, assessments, and progress tracking in one university-focused experience.',

    organizedTitle: 'Organized academic content',
    organizedDescription:
      'Courses and content structured around your major',

    toolsTitle: 'Specialized tools',
    toolsDescription:
      'Scientific and academic engines for your field of study',

    progressTitle: 'Progress tracking',
    progressDescription:
      'Track your academic activity and achievements',

    integratedTitle: 'Integrated university experience',
    integratedDescription:
      'One environment that supports your university journey',

    fullName: 'Full name',
    fullNamePlaceholder: 'Example: Ahmad Abdullah',

    age: 'Age',
    phone: 'Phone number',

    major: 'Academic major',
    majorPlaceholder: 'Choose your major',

    mathematics: 'Mathematics',
    medicine: 'Medicine & Pharmacy',
    engineering: 'Engineering',
    humanities: 'Humanities',
    cs: 'Computer Science',
    general: 'General',
    businessAdministration: 'Business Administration',
    finance: 'Finance',
    accounting: 'Accounting',
    hotelManagement: 'Hotel Management',
    tourismManagement: 'Tourism Management',
    law: 'Law',
    nursing: 'Nursing',
    biologicalSciences: 'Biological Sciences',
    appliedEnglish: 'Applied English',
    englishLanguageLiterature: 'English Language & Literature',
    arabicLanguageLiterature: 'Arabic Language & Literature',
    frenchLanguageLiterature: 'French Language & Literature',
    computerInformationSystems: 'Computer Information Systems',
    businessInformationTechnology: 'Business Information Technology',
    cybersecurity: 'Cybersecurity',

    studyYear: 'Study year',
    studyYearPlaceholder: 'Choose your study year',

    year1: 'First year',
    year2: 'Second year',
    year3: 'Third year',
    year4: 'Fourth year',
    year5: 'Other / Graduation',

    email: 'Email address',
    password: 'Password',
    forgotLink: 'Forgot password?',
    forgotTitle: 'Reset your password',
    forgotDescription: 'Enter your email address to receive a password recovery link.',
    forgotAction: 'Send recovery link',
    forgotSent: 'If this email belongs to an account, you will receive a password recovery link.',
    forgotFailed: 'Unable to process the recovery request. Please try again later.',
    backToLogin: 'Back to sign in',

    loading: 'Loading...',
    createAction: 'Create account',
    loginAction: 'Sign in',

    or: 'or',

    haveAccount: 'Already have an account?',
    noAccount: "Don't have an account?",
    goLogin: 'Sign in',
    goCreate: 'Create a new account',

    emailNotice:
      'After registration, you may need to confirm your email before signing in.',

    nameError:
      'The name must contain letters only, without numbers or symbols.',

    requiredError:
      'Please select your major and study year.',

    unexpectedError:
      'An unexpected error occurred',

    success:
      'Registration successful! Please check your email and confirm it before signing in.',
  },
} as const;

type LoginProps = {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
};

export default function Login({
  language,
  onToggleLanguage,
}: LoginProps) {
  const copy = loginCopy[language];
  const [isSignUp, setIsSignUp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'signup';
  });

  const [isRecoveryRequest, setIsRecoveryRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const { signIn, signUp } = useAuth();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    age: '',
    major: '',
    study_year: '',
    phone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const switchMode = () => {
    setIsRecoveryRequest(false);
    setMessage({ text: '', type: '' });
    setIsSignUp((current) => !current);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (isRecoveryRequest) {
        const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
        const redirectTo = `${window.location.origin}${basePath}/reset-password`;

        const { error } = await supabase.auth.resetPasswordForEmail(
          formData.email.trim(),
          { redirectTo }
        );

        if (error) throw error;

        setMessage({
          text: copy.forgotSent,
          type: 'success',
        });
      } else if (isSignUp) {
        const nameRegex = /^[\p{L}\s]+$/u;

        if (!nameRegex.test(formData.full_name)) {
          throw new Error(copy.nameError);
        }

        if (!formData.major || !formData.study_year) {
          throw new Error(copy.requiredError);
        }

        await signUp(formData);

        setMessage({
          text: copy.success,
          type: 'success',
        });

        setIsSignUp(false);
      } else {
        await signIn(formData.email, formData.password);
        setLocation('/');
      }
    } catch (error: any) {
      setMessage({
        text: isRecoveryRequest ? copy.forgotFailed : (error.message || copy.unexpectedError),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="relative min-h-[100dvh] overflow-hidden bg-[#020817] text-white"
    >
      <ScientificBackdrop />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(14,165,233,0.08),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(124,58,237,0.08),transparent_34%)]" />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid w-full max-w-[1320px] overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[#06101f]/85 shadow-[0_0_80px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">

          {/* Brand side */}
          <section className="relative hidden min-h-[760px] overflow-hidden border-l border-white/5 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.05] via-transparent to-violet-500/[0.08]" />

            <div className="relative z-10 px-12 pt-12">
              <div className="flex flex-col items-center text-center">
                <YHubLogo size="hero" showText={false} />

                <div className="mt-5 text-4xl font-black tracking-[0.14em] text-white">
                  Y HUB
                </div>

                <div className="mt-2 text-[11px] font-semibold tracking-[0.34em] text-slate-500">
                  ACADEMIC PLATFORM
                </div>
              </div>

              <div className="mt-12 text-center">
                <h2 className="text-3xl font-black leading-tight">
                  {copy.brandHeading}
                </h2>

                <p className="mx-auto mt-4 max-w-md text-base leading-8 text-slate-400">
                  {copy.brandDescription}
                </p>
              </div>

              <div className="mx-auto mt-10 grid max-w-md gap-3">
                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold">{copy.organizedTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {copy.organizedDescription}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold">{copy.toolsTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {copy.toolsDescription}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold">{copy.progressTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {copy.progressDescription}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold">{copy.integratedTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {copy.integratedDescription}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-12 h-28 overflow-hidden">
              <div className="absolute inset-x-[-15%] bottom-[-85px] h-44 rounded-[50%] border border-cyan-400/20 shadow-[0_-20px_60px_rgba(14,165,233,0.10)]" />
              <div className="absolute inset-x-[-5%] bottom-[-105px] h-44 rounded-[50%] border border-violet-400/20" />
            </div>
          </section>

          {/* Form side */}
          <section className="relative flex items-center justify-center px-5 py-8 sm:px-10 lg:px-14">
            <button
              type="button"
              onClick={onToggleLanguage}
              className={`absolute top-5 z-20 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-400/10 sm:top-8 ${
                language === 'en'
                  ? 'right-5 sm:right-8'
                  : 'left-5 sm:left-8'
              }`}
              aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              {language === 'ar' ? 'EN' : 'AR'}
            </button>

            <div className="w-full max-w-[560px]">

              <div className="mb-8 lg:mb-0">
                <div className="lg:hidden">
                  <YHubLogo size="sm" />
                </div>

                <button
                  type="button"
                  onClick={() => setLocation('/')}
                  className={`absolute top-5 z-20 text-sm font-semibold text-slate-400 transition hover:text-white sm:top-8 ${
                    language === 'ar'
                      ? 'right-5 sm:right-8'
                      : 'left-5 sm:left-8'
                  }`}
                >
                  {copy.backHome}
                </button>
              </div>

              <div className="mb-8">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">
                  <span className="h-px w-8 bg-cyan-400/50" />
                  Y HUB
                </div>

                <h1 className="text-3xl font-black sm:text-4xl">
                  {isRecoveryRequest ? copy.forgotTitle : isSignUp ? copy.createTitle : copy.loginTitle}
                </h1>

                <p className="mt-3 leading-7 text-slate-400">
                  {isRecoveryRequest
                      ? copy.forgotDescription
                      : isSignUp
                        ? copy.createDescription
                        : copy.loginDescription}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <label
                        htmlFor="full_name"
                        className="text-sm font-bold text-slate-300"
                      >
                        {copy.fullName}
                      </label>

                      <div className="relative">
                        <User className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                        <Input
                          id="full_name"
                          type="text"
                          name="full_name"
                          required
                          value={formData.full_name}
                          onChange={handleChange}
                          placeholder={copy.fullNamePlaceholder}
                          className="h-12 border-white/[0.08] bg-white/[0.025] pr-11 text-white placeholder:text-slate-600 focus-visible:ring-cyan-400/40"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="age"
                          className="text-sm font-bold text-slate-300"
                        >
                          {copy.age}
                        </label>

                        <div className="relative">
                          <Layers3 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                          <Input
                            id="age"
                            type="number"
                            name="age"
                            min="10"
                            max="99"
                            required
                            value={formData.age}
                            onChange={handleChange}
                            placeholder="20"
                            className="h-12 border-white/[0.08] bg-white/[0.025] pr-11 text-white placeholder:text-slate-600 focus-visible:ring-cyan-400/40"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="phone"
                          className="text-sm font-bold text-slate-300"
                        >
                          {copy.phone}
                        </label>

                        <div className="relative">
                          <Phone className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                          <Input
                            id="phone"
                            type="tel"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="07XXXXXXXX"
                            dir="ltr"
                            className="h-12 border-white/[0.08] bg-white/[0.025] px-11 text-left text-white placeholder:text-slate-600 focus-visible:ring-cyan-400/40"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-300">
                        {copy.major}
                      </label>

                      <Select
                        value={formData.major}
                        onValueChange={(value: string) =>
                          handleSelectChange('major', value)
                        }
                      >
                        <SelectTrigger className="h-12 border-white/[0.08] bg-white/[0.025] text-white focus:ring-cyan-400/40">
                          <div className="flex items-center gap-3">
                            <GraduationCap className="h-4 w-4 text-slate-500" />
                            <SelectValue placeholder={copy.majorPlaceholder} />
                          </div>
                        </SelectTrigger>

                        <SelectContent className="max-h-[320px] overflow-y-auto">
                          <SelectItem value="mathematics">
                            {copy.mathematics}
                          </SelectItem>

                          <SelectItem value="medicine">
                            {copy.medicine}
                          </SelectItem>

                          <SelectItem value="engineering">
                            {copy.engineering}
                          </SelectItem>

                          <SelectItem value="humanities">
                            {copy.humanities}
                          </SelectItem>

                          <SelectItem value="cs">
                            {copy.cs}
                          </SelectItem>

                          <SelectItem value="general">
                            {copy.general}
                          </SelectItem>

                          <SelectItem value="business_administration">
                            {copy.businessAdministration}
                          </SelectItem>

                          <SelectItem value="finance">
                            {copy.finance}
                          </SelectItem>

                          <SelectItem value="accounting">
                            {copy.accounting}
                          </SelectItem>

                          <SelectItem value="hotel_management">
                            {copy.hotelManagement}
                          </SelectItem>

                          <SelectItem value="tourism_management">
                            {copy.tourismManagement}
                          </SelectItem>

                          <SelectItem value="law">
                            {copy.law}
                          </SelectItem>

                          <SelectItem value="nursing">
                            {copy.nursing}
                          </SelectItem>

                          <SelectItem value="biological_sciences">
                            {copy.biologicalSciences}
                          </SelectItem>

                          <SelectItem value="applied_english">
                            {copy.appliedEnglish}
                          </SelectItem>

                          <SelectItem value="english_language_literature">
                            {copy.englishLanguageLiterature}
                          </SelectItem>

                          <SelectItem value="arabic_language_literature">
                            {copy.arabicLanguageLiterature}
                          </SelectItem>

                          <SelectItem value="french_language_literature">
                            {copy.frenchLanguageLiterature}
                          </SelectItem>

                          <SelectItem value="computer_information_systems">
                            {copy.computerInformationSystems}
                          </SelectItem>

                          <SelectItem value="business_information_technology">
                            {copy.businessInformationTechnology}
                          </SelectItem>

                          <SelectItem value="cybersecurity">
                            {copy.cybersecurity}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-300">
                        {copy.studyYear}
                      </label>

                      <Select
                        value={formData.study_year}
                        onValueChange={(value: string) =>
                          handleSelectChange('study_year', value)
                        }
                      >
                        <SelectTrigger className="h-12 border-white/[0.08] bg-white/[0.025] text-white focus:ring-cyan-400/40">
                          <div className="flex items-center gap-3">
                            <Layers3 className="h-4 w-4 text-slate-500" />
                            <SelectValue placeholder={copy.studyYearPlaceholder} />
                          </div>
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="1">{copy.year1}</SelectItem>
                          <SelectItem value="2">{copy.year2}</SelectItem>
                          <SelectItem value="3">{copy.year3}</SelectItem>
                          <SelectItem value="4">{copy.year4}</SelectItem>
                          <SelectItem value="5">{copy.year5}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-bold text-slate-300"
                  >
                    {copy.email}
                  </label>

                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                    <Input
                      id="email"
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@example.com"
                      dir="ltr"
                      className="h-12 border-white/[0.08] bg-white/[0.025] px-11 text-left text-white placeholder:text-slate-600 focus-visible:ring-cyan-400/40"
                    />
                  </div>
                </div>

                {!isRecoveryRequest && (
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-bold text-slate-300"
                  >
                    {copy.password}
                  </label>

                  <div className="relative">
                    <LockKeyhole className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                    <Input
                      id="password"
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      minLength={6}
                      dir="ltr"
                      className="h-12 border-white/[0.08] bg-white/[0.025] px-11 text-left text-white focus-visible:ring-cyan-400/40"
                    />
                  </div>
                </div>
                )}

                {!isSignUp && !isRecoveryRequest && (
                  <div className="text-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveryRequest(true);
                        setMessage({ text: '', type: '' });
                      }}
                      className="text-sm font-semibold text-cyan-400 transition hover:text-cyan-300"
                    >
                      {copy.forgotLink}
                    </button>
                  </div>
                )}

                {message.text && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
                      message.type === 'error'
                        ? 'border-red-400/20 bg-red-500/10 text-red-300'
                        : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-gradient-to-l from-violet-600 via-blue-500 to-cyan-400 text-base font-black text-white shadow-[0_10px_35px_rgba(34,211,238,0.12)] transition hover:opacity-90"
                >
                  {loading
                    ? copy.loading
                    : isRecoveryRequest
                      ? copy.forgotAction
                      : isSignUp
                        ? copy.createAction
                        : copy.loginAction}
                </Button>

                {!isRecoveryRequest ? (
                  <>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.07]" />
                  </div>

                  <div className="relative flex justify-center text-xs">
                    <span className="bg-[#07111f] px-4 text-slate-600">
                      {copy.or}
                    </span>
                  </div>
                </div>

                <div className="text-center text-sm text-slate-400">
                  {isSignUp
                    ? copy.haveAccount
                    : copy.noAccount}{' '}

                  <button
                    type="button"
                    onClick={switchMode}
                    className="font-bold text-cyan-400 transition hover:text-cyan-300"
                  >
                    {isSignUp ? copy.goLogin : copy.goCreate}
                  </button>
                </div>
                  </>
                ) : (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveryRequest(false);
                        setMessage({ text: '', type: '' });
                      }}
                      className="text-sm font-bold text-cyan-400 transition hover:text-cyan-300"
                    >
                      {copy.backToLogin}
                    </button>
                  </div>
                )}

                {isSignUp && (
                  <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-6 text-slate-500">
                    <Mail className="mt-1 h-4 w-4 shrink-0" />

                    <p>
                      {copy.emailNotice}
                    </p>
                  </div>
                )}
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
