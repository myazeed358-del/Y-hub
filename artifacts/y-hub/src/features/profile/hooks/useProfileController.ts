import { profileName } from '@/shared/identity/profileName';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { majorLabels, roleLabels } from '@/i18n/profileLabels';
import { getProfileCopy } from '@/i18n/profileCopy';
import { profileAuthService } from '../services/profileAuthService';
import type { ProfileFormData, ProfilePasswordData } from '../types';

export function useProfileController() {
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
  const [passwordData, setPasswordData] = useState<ProfilePasswordData>({
    current: '',
    next: '',
    confirm: '',
  });
  const [formData, setFormData] = useState<ProfileFormData>({
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
    const name = profileName(profile, language);
    if (!name) return 'Y';

    const parts = name.split(/\s+/).filter(Boolean);

    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }, [profile?.full_name, profile?.full_name_ar, profile?.full_name_en, language]);

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

  const handleSave = async (event: FormEvent) => {
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

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
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
      const verified = await profileAuthService.verifyCurrentPassword(
        user.email, passwordData.current, user.id
      );

      if (!verified) {
        toast.error(copy.passwordVerifyError);
        return;
      }

      const { error: updateError } =
        await profileAuthService.updatePassword(passwordData.next);

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


  return {
    status,
    profile,
    isArabic,
    isStudent,
    saving,
    passwordSaving,
    passwordData,
    setPasswordData,
    formData,
    setFormData,
    copy,
    majorLabel,
    roleLabel,
    accountEmail,
    initials,
    memberSince,
    hasChanges,
    handleSave,
    handlePasswordChange,
  };
}
