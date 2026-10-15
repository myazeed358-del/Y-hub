import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import YHubLogo from '@/components/YHubLogo';
import type { guestCopy } from '@/i18n/guestLandingCopy';

type GuestLandingHeroIntroProps = {
  language: 'ar' | 'en';
  copy: (typeof guestCopy)['ar' | 'en'];
};

export function GuestLandingHeroIntro({
  language,
  copy,
}: GuestLandingHeroIntroProps) {
  return (
        <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="relative z-10 max-w-xl">

          <div className="mb-6 yhub-display" dir="ltr">
            <div className="inline-flex rounded-2xl border border-[#36D5E8]/60 bg-[#E8EDF3] px-4 py-3 shadow-[0_0_22px_rgba(54,213,232,0.16)] dark:border-0 dark:bg-transparent dark:p-0 dark:shadow-none">
              <YHubLogo
                size="hero"
                className="[&_.font-black]:text-[#172B45] dark:[&_.font-black]:text-white"
              />
            </div>
          </div>

          <p
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="mt-7 max-w-lg text-base font-medium leading-8 text-[#334155] dark:text-slate-400 sm:text-lg"
          >
            {copy.description}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/login?mode=signup"
              className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-3.5 text-sm font-black text-[#031019] shadow-[0_0_40px_rgba(34,211,238,.2)] transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              {copy.createAccount}
              <ArrowLeft size={16} />
            </Link>

            <Link
              href="/login"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-border bg-card px-6 py-3.5 text-sm font-black text-foreground backdrop-blur transition hover:border-primary/30 hover:bg-muted/40 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07]"
            >
              {copy.signIn}
            </Link>
          </div>
        </div>
  );
}
