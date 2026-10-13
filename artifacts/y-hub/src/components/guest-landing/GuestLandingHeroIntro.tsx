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
            <YHubLogo size="hero" />
          </div>

          <p
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="mt-7 max-w-lg text-base font-medium leading-8 text-slate-400 sm:text-lg"
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
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-6 py-3.5 text-sm font-black text-slate-200 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              {copy.signIn}
            </Link>
          </div>
        </div>
  );
}
