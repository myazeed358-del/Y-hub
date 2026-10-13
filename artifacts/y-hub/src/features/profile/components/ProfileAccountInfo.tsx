import {
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { ReadOnlyField } from '@/features/profile/components/ReadOnlyField';
import type { getProfileCopy } from '@/i18n/profileCopy';

interface ProfileAccountInfoProps {
  profile: { full_name?: string | null };
  copy: ReturnType<typeof getProfileCopy>;
  accountEmail: string;
  roleLabel: string;
  majorLabel: string;
}

export function ProfileAccountInfo({
  profile,
  copy,
  accountEmail,
  roleLabel,
  majorLabel,
}: ProfileAccountInfoProps) {
  return (
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
  );
}
