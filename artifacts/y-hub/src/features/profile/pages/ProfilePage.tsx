import { ProfileNamesForm } from '../components/ProfileNamesForm';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck, UserRound } from 'lucide-react';
import { ProfileAccountInfo } from '../components/ProfileAccountInfo';
import { ProfileEditableForm } from '../components/ProfileEditableForm';
import { ProfilePasswordForm } from '../components/ProfilePasswordForm';
import { ProfileSidebar } from '../components/ProfileSidebar';
import { useProfileController } from '../hooks/useProfileController';

export default function ProfilePage() {
  const { user } = useAuth();
  const {
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
  } = useProfileController();

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

          <ProfileNamesForm key={user?.id} />

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
