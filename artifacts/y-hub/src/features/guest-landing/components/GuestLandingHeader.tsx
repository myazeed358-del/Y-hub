import type { guestCopy } from '@/i18n/guestLandingCopy';
import YHubLogo from '@/components/YHubLogo';

type GuestLandingHeaderProps = {
  language: 'ar' | 'en';
  copy: (typeof guestCopy)['ar' | 'en'];
  onToggleLanguage: () => void;
};

export function GuestLandingHeader({
  language,
  copy,
  onToggleLanguage,
}: GuestLandingHeaderProps) {
  return (
      <header dir="ltr" className="relative z-20 mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-6 lg:px-14">
        <YHubLogo size="sm" />

        <div className="flex items-center gap-5">
          <nav
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="hidden items-center gap-8 text-sm font-bold text-slate-400 md:flex"
          >
            <a href="#home" className="text-white transition hover:text-cyan-300">
              {copy.home}
            </a>
            <a href="#about" className="transition hover:text-white">
              {copy.about}
            </a>
            <a href="#contact" className="transition hover:text-white">
              {copy.contact}
            </a>
          </nav>

          <button
            type="button"
            onClick={onToggleLanguage}
            className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-400/10"
            aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>
      </header>
  );
}
