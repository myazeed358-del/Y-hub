import { ThemeToggle } from '@/components/ThemeToggle';
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
        <div className="rounded-xl border border-[#36D5E8]/60 bg-[#E8EDF3] px-3 py-2 shadow-[0_0_16px_rgba(54,213,232,0.14)] dark:border-0 dark:bg-transparent dark:p-0 dark:shadow-none">
          <YHubLogo
            size="sm"
            className="[&_.font-black]:text-[#172B45] [&_.text-slate-500]:text-[#536B80] dark:[&_.font-black]:text-white dark:[&_.text-slate-500]:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-5">
          <nav
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="hidden items-center gap-8 text-sm font-bold text-[#475569] dark:text-slate-400 md:flex"
          >
            <a href="#home" className="text-foreground transition hover:text-primary dark:text-white dark:hover:text-cyan-300">
              {copy.home}
            </a>
            <a href="#about" className="transition hover:text-foreground dark:hover:text-white">
              {copy.about}
            </a>
            <a href="#contact" className="transition hover:text-foreground dark:hover:text-white">
              {copy.contact}
            </a>
          </nav>

          <ThemeToggle />

          <button
            type="button"
            onClick={onToggleLanguage}
            className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-black text-primary transition hover:bg-primary/10 dark:border-cyan-400/20 dark:bg-cyan-400/[0.06] dark:text-cyan-300 dark:hover:bg-cyan-400/10"
            aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>
      </header>
  );
}
