import { CalendarDays, ShieldCheck } from 'lucide-react';
import type { getProfileCopy } from '@/i18n/profileCopy';

interface ProfileSidebarProps {
  profile: { full_name?: string | null };
  copy: ReturnType<typeof getProfileCopy>;
  initials: string;
  accountEmail: string;
  roleLabel: string;
  majorLabel: string;
  memberSince: string;
}

export function ProfileSidebar({
  profile,
  copy,
  initials,
  accountEmail,
  roleLabel,
  majorLabel,
  memberSince,
}: ProfileSidebarProps) {
  return (
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
  );
}
