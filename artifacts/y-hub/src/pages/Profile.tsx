import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  GraduationCap,
  Hash,
  LockKeyhole,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { useLanguage } from '../App';

import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';

const majorLabels: Record<string, { ar: string; en: string }> = {
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

const roleLabels = {
  student: { ar: 'طالب', en: 'Student' },
  instructor: { ar: 'مدرّس', en: 'Instructor' },
  admin: { ar: 'مدير', en: 'Admin' },
  super_admin: { ar: 'مدير رئيسي', en: 'Super Admin' },
} as const;

export default function Profile() {
  const {
    user,
    profile,
    role,
    status,
    updateProfile,
  } = useAuth();

  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const isStudent = role === 'student';

  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [formData, setFormData] = useState({
    age: '',
    study_year: '',
    phone: '',
  });

  useEffect(() => {
    if (!profile) return;

    setFormData({
      age: profile.age?.toString() ?? '',
      study_year: profile.study_year ?? '',
      phone: profile.phone ?? '',
    });
  }, [profile]);

  const copy = isArabic
    ? {
        eyebrow: 'الحساب الأكاديمي',
        title: 'الملف الشخصي',
        subtitle:
          'راجع بياناتك الأكاديمية وحدّث المعلومات المسموح بتعديلها في حساب Y HUB.',
        accountInfo: 'معلومات الحساب',
        academicInfo: 'المعلومات الأكاديمية',
        editableInfo: 'المعلومات القابلة للتعديل',
        fullName: 'الاسم الكامل',
        email: 'البريد الإلكتروني',
        role: 'نوع الحساب',
        major: 'التخصص الأكاديمي',
        age: 'العمر',
        studyYear: 'السنة الدراسية',
        phone: 'رقم الهاتف',
        readonly: 'غير قابل للتعديل',
        verifiedMajor:
          'التخصص مرتبط بصلاحيات المحركات الأكاديمية، لذلك لا يمكن تغييره مباشرة من الحساب.',
        year1: 'السنة الأولى',
        year2: 'السنة الثانية',
        year3: 'السنة الثالثة',
        year4: 'السنة الرابعة',
        year5: 'السنة الخامسة',
        selectYear: 'اختر السنة الدراسية',
        save: 'حفظ التعديلات',
        saving: 'جاري الحفظ...',
        saved: 'تم تحديث الملف الشخصي بنجاح',
        saveError: 'تعذر تحديث الملف الشخصي',
        invalidAge: 'يجب أن يكون العمر رقمًا صحيحًا بين 13 و120',
        missingTitle: 'الملف الشخصي غير متوفر',
        missingText:
          'تم تسجيل الدخول، لكن لم يتم العثور على سجل الملف الشخصي المرتبط بهذا الحساب.',
        errorTitle: 'تعذر تحميل الملف الشخصي',
        errorText:
          'حدثت مشكلة أثناء قراءة بيانات حسابك من قاعدة البيانات. حاول تحديث الصفحة.',
        loading: 'جاري تحميل الملف الشخصي...',
        memberSince: 'عضو منذ',
        notAvailable: 'غير متوفر',
        secured: 'محمي بواسطة Supabase',
        passwordTitle: 'تغيير كلمة المرور',
        passwordDescription: 'يمكنك تغيير كلمة المرور مباشرة دون إرسال رسالة إلى بريدك الإلكتروني.',
        currentPassword: 'كلمة المرور الحالية',
        newPassword: 'كلمة المرور الجديدة',
        confirmPassword: 'تأكيد كلمة المرور الجديدة',
        changePassword: 'تغيير كلمة المرور',
        changingPassword: 'جاري تغيير كلمة المرور...',
        passwordSaved: 'تم تغيير كلمة المرور بنجاح',
        passwordMismatch: 'كلمتا المرور الجديدتان غير متطابقتين',
        passwordShort: 'يجب أن تحتوي كلمة المرور الجديدة على 8 أحرف على الأقل',
        passwordSame: 'يجب أن تختلف كلمة المرور الجديدة عن الحالية',
        passwordVerifyError: 'تعذّر التحقق من كلمة المرور الحالية. تأكد منها وحاول مجددًا.',
        passwordUpdateError: 'تعذّر تغيير كلمة المرور. قد تتطلب إعدادات أمان الحساب تحققًا إضافيًا.',
      }
    : {
        eyebrow: 'Academic account',
        title: 'Profile',
        subtitle:
          'Review your academic information and update the fields available to your Y HUB account.',
        accountInfo: 'Account information',
        academicInfo: 'Academic information',
        editableInfo: 'Editable information',
        fullName: 'Full name',
        email: 'Email address',
        role: 'Account role',
        major: 'Academic major',
        age: 'Age',
        studyYear: 'Study year',
        phone: 'Phone number',
        readonly: 'Read only',
        verifiedMajor:
          'Your major determines academic engine access, so it cannot be changed directly from your account.',
        year1: 'First year',
        year2: 'Second year',
        year3: 'Third year',
        year4: 'Fourth year',
        year5: 'Fifth year',
        selectYear: 'Select study year',
        save: 'Save changes',
        saving: 'Saving...',
        saved: 'Profile updated successfully',
        saveError: 'Could not update your profile',
        invalidAge: 'Age must be a whole number between 13 and 120',
        missingTitle: 'Profile unavailable',
        missingText:
          'You are signed in, but no profile record was found for this account.',
        errorTitle: 'Could not load profile',
        errorText:
          'There was a problem reading your account data. Try refreshing the page.',
        loading: 'Loading profile...',
        memberSince: 'Member since',
        notAvailable: 'Not available',
        secured: 'Secured by Supabase',
        passwordTitle: 'Change password',
        passwordDescription: 'Change your password directly without requesting a recovery email.',
        currentPassword: 'Current password',
        newPassword: 'New password',
        confirmPassword: 'Confirm new password',
        changePassword: 'Change password',
        changingPassword: 'Changing password...',
        passwordSaved: 'Password changed successfully',
        passwordMismatch: 'The new passwords do not match',
        passwordShort: 'Your new password must contain at least 8 characters',
        passwordSame: 'Your new password must differ from the current one',
        passwordVerifyError: 'Could not verify your current password. Check it and try again.',
        passwordUpdateError: 'Could not change your password. Additional verification may be required by your account security settings.',
      };

  const majorLabel = useMemo(() => {
    if (!profile?.major) return copy.notAvailable;

    const labels = majorLabels[profile.major];
    return labels ? labels[language] : profile.major;
  }, [profile?.major, language, copy.notAvailable]);

  const roleLabel = role
    ? roleLabels[role]?.[language] ?? role
    : copy.notAvailable;

  const accountEmail = profile?.email || user?.email || copy.notAvailable;

  const initials = useMemo(() => {
    const name = profile?.full_name?.trim();
    if (!name) return 'Y';

    const parts = name.split(/\s+/).filter(Boolean);

    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }, [profile?.full_name]);

  const memberSince = useMemo(() => {
    if (!profile?.created_at) return copy.notAvailable;

    try {
      return new Intl.DateTimeFormat(isArabic ? 'ar-JO' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(profile.created_at));
    } catch {
      return copy.notAvailable;
    }
  }, [profile?.created_at, copy.notAvailable, isArabic]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;

    const originalAge = profile.age?.toString() ?? '';
    const originalStudyYear = profile.study_year ?? '';
    const originalPhone = profile.phone ?? '';

    return (
      formData.age !== originalAge ||
      (isStudent && formData.study_year !== originalStudyYear) ||
      formData.phone !== originalPhone
    );
  }, [formData, profile]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedAge = formData.age.trim();
    const ageValue = trimmedAge === '' ? null : Number(trimmedAge);

    if (
      ageValue !== null &&
      (!Number.isInteger(ageValue) || ageValue < 13 || ageValue > 120)
    ) {
      toast.error(copy.invalidAge);
      return;
    }

    setSaving(true);

    try {
      await updateProfile({
        age: ageValue,
        ...(isStudent
          ? { study_year: formData.study_year || null }
          : {}),
        phone: formData.phone.trim() || null,
      });

      toast.success(copy.saved);
    } catch (error: any) {
      toast.error(error?.message || copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.email) {
      toast.error(copy.passwordVerifyError);
      return;
    }

    if (passwordData.next.length < 8) {
      toast.error(copy.passwordShort);
      return;
    }

    if (passwordData.next !== passwordData.confirm) {
      toast.error(copy.passwordMismatch);
      return;
    }

    if (passwordData.next === passwordData.current) {
      toast.error(copy.passwordSame);
      return;
    }

    setPasswordSaving(true);

    try {
      // Verify the current password without replacing the user's active session.
      const verificationClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      const { data, error: verificationError } =
        await verificationClient.auth.signInWithPassword({
          email: user.email,
          password: passwordData.current,
        });

      if (verificationError || data.user?.id !== user.id) {
        toast.error(copy.passwordVerifyError);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.next,
      });

      if (updateError) {
        toast.error(copy.passwordUpdateError);
        return;
      }

      setPasswordData({ current: '', next: '', confirm: '' });
      toast.success(copy.passwordSaved);
    } catch {
      toast.error(copy.passwordUpdateError);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4">
        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-8 py-7 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-2xl bg-[hsl(var(--primary)/.18)]" />
          <p className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">
            {copy.loading}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'profile_error') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4">
        <div className="max-w-lg rounded-3xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--card))] p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-[hsl(var(--destructive))]" />
          <h1 className="text-2xl font-black">{copy.errorTitle}</h1>
          <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
            {copy.errorText}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'profile_missing' || !profile) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4">
        <div className="max-w-lg rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
          <UserRound className="mx-auto mb-4 h-12 w-12 text-[hsl(var(--primary))]" />
          <h1 className="text-2xl font-black">{copy.missingTitle}</h1>
          <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
            {copy.missingText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="mb-8">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[hsl(var(--primary))]">
          {copy.eyebrow}
        </p>

        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          {copy.title}
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          {copy.subtitle}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div className="relative overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[hsl(var(--primary)/.12)] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-[hsl(var(--accent)/.12)] blur-3xl" />

              <div className="relative">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.1)] text-2xl font-black text-[hsl(var(--primary))]">
                  {initials}
                </div>

                <h2 className="text-xl font-black">
                  {profile.full_name || copy.notAvailable}
                </h2>

                <p className="mt-1 truncate text-sm text-[hsl(var(--muted-foreground))]">
                  {accountEmail}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.08)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">
                    {roleLabel}
                  </span>

                  <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] px-3 py-1.5 text-xs font-bold">
                    {majorLabel}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]">
                <CalendarDays size={18} />
              </div>

              <div>
                <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">
                  {copy.memberSince}
                </p>
                <p className="mt-1 text-sm font-black">{memberSince}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-[hsl(var(--border))] pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.12)]">
                <ShieldCheck size={18} />
              </div>

              <div>
                <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">
                  {copy.secured}
                </p>
                <p className="mt-1 text-sm font-black">Y HUB</p>
              </div>
            </div>
          </section>
        </aside>

        <main className="space-y-6">
          <section className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7">
            <div className="mb-6">
              <h2 className="text-xl font-black">{copy.accountInfo}</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <ReadOnlyField
                icon={<UserRound size={17} />}
                label={copy.fullName}
                value={profile.full_name || copy.notAvailable}
                badge={copy.readonly}
              />

              <ReadOnlyField
                icon={<Mail size={17} />}
                label={copy.email}
                value={accountEmail}
                badge={copy.readonly}
                ltr
              />

              <ReadOnlyField
                icon={<ShieldCheck size={17} />}
                label={copy.role}
                value={roleLabel}
                badge={copy.readonly}
              />

              <ReadOnlyField
                icon={<GraduationCap size={17} />}
                label={copy.major}
                value={majorLabel}
                badge={copy.readonly}
              />
            </div>

            <div className="mt-5 flex gap-3 rounded-2xl border border-[hsl(var(--primary)/.16)] bg-[hsl(var(--primary)/.05)] p-4">
              <LockKeyhole
                size={18}
                className="mt-0.5 shrink-0 text-[hsl(var(--primary))]"
              />
              <p className="text-xs leading-6 text-[hsl(var(--muted-foreground))]">
                {copy.verifiedMajor}
              </p>
            </div>
          </section>

          <form
            onSubmit={handleSave}
            className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"
          >
            <div className="mb-6">
              <h2 className="text-xl font-black">{copy.editableInfo}</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="profile-age"
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <Hash size={16} className="text-[hsl(var(--primary))]" />
                  {copy.age}
                </label>

                <Input
                  id="profile-age"
                  type="number"
                  min={13}
                  max={120}
                  step={1}
                  value={formData.age}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      age: event.target.value,
                    }))
                  }
                  className="h-12"
                />
              </div>

              {isStudent && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <GraduationCap
                      size={16}
                      className="text-[hsl(var(--primary))]"
                    />
                    {copy.studyYear}
                  </label>

                  <Select
                    value={formData.study_year}
                    onValueChange={(value) =>
                      setFormData((current) => ({
                        ...current,
                        study_year: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={copy.selectYear} />
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
              )}

              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="profile-phone"
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <Phone size={16} className="text-[hsl(var(--primary))]" />
                  {copy.phone}
                </label>

                <Input
                  id="profile-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  dir="ltr"
                  className="h-12"
                />
              </div>
            </div>

            <div className="mt-7 flex justify-end">
              <Button
                type="submit"
                disabled={saving || !hasChanges}
                className="h-12 min-w-44 gap-2 rounded-xl px-6 font-black"
              >
                <Save size={17} />
                {saving ? copy.saving : copy.save}
              </Button>
            </div>
          </form>

          <form
            onSubmit={handlePasswordChange}
            className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"
          >
            <div className="mb-6">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <LockKeyhole size={21} className="text-[hsl(var(--primary))]" />
                {copy.passwordTitle}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
                {copy.passwordDescription}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="profile-current-password" className="text-sm font-bold">
                  {copy.currentPassword}
                </label>
                <Input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passwordData.current}
                  onChange={(event) =>
                    setPasswordData((current) => ({
                      ...current,
                      current: event.target.value,
                    }))
                  }
                  dir="ltr"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="profile-new-password" className="text-sm font-bold">
                  {copy.newPassword}
                </label>
                <Input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={passwordData.next}
                  onChange={(event) =>
                    setPasswordData((current) => ({
                      ...current,
                      next: event.target.value,
                    }))
                  }
                  dir="ltr"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="profile-confirm-password" className="text-sm font-bold">
                  {copy.confirmPassword}
                </label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={passwordData.confirm}
                  onChange={(event) =>
                    setPasswordData((current) => ({
                      ...current,
                      confirm: event.target.value,
                    }))
                  }
                  dir="ltr"
                  className="h-12"
                />
              </div>
            </div>

            <div className="mt-7 flex justify-end">
              <Button
                type="submit"
                disabled={passwordSaving}
                className="h-12 min-w-44 gap-2 rounded-xl px-6 font-black"
              >
                <LockKeyhole size={17} />
                {passwordSaving ? copy.changingPassword : copy.changePassword}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function ReadOnlyField({
  icon,
  label,
  value,
  badge,
  ltr = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.18)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="text-[hsl(var(--primary))]">{icon}</span>
          {label}
        </div>

        <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background)/.5)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
          {badge}
        </span>
      </div>

      <p
        dir={ltr ? 'ltr' : undefined}
        className={`truncate text-sm font-semibold ${
          ltr ? 'text-left' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
