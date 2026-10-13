import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { ProfileAccountInfo } from '@/components/profile/ProfileAccountInfo';
import { ProfileEditableForm } from '@/components/profile/ProfileEditableForm';
import { ProfilePasswordForm } from '@/components/profile/ProfilePasswordForm';
import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import { supabase } from '@/utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { useLanguage } from '@/i18n/LanguageContext';
import { majorLabels, roleLabels } from '@/i18n/profileLabels';
import { getProfileCopy } from '@/i18n/profileCopy';



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

  const copy = getProfileCopy(isArabic);

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
        <ProfileSidebar
          profile={profile}
          copy={copy}
          initials={initials}
          accountEmail={accountEmail}
          roleLabel={roleLabel}
          majorLabel={majorLabel}
          memberSince={memberSince}
        />

        <main className="space-y-6">
          <ProfileAccountInfo
            profile={profile}
            copy={copy}
            accountEmail={accountEmail}
            roleLabel={roleLabel}
            majorLabel={majorLabel}
          />

          <ProfileEditableForm
            copy={copy}
            formData={formData}
            setFormData={setFormData}
            isStudent={isStudent}
            saving={saving}
            hasChanges={hasChanges}
            handleSave={handleSave}
          />

          <ProfilePasswordForm
            copy={copy}
            passwordData={passwordData}
            setPasswordData={setPasswordData}
            passwordSaving={passwordSaving}
            handlePasswordChange={handlePasswordChange}
          />
        </main>
      </div>
    </div>
  );
}
