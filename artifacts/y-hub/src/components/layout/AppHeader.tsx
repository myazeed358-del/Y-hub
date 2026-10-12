import {
  ArrowRight,
  ChevronLeft,
  Menu,
  UserRound,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/y-hub-ds/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/y-hub-ds/components/ui/dropdown-menu';

import { ThemeToggle } from '@/components/ThemeToggle';
import { useLanguage } from '@/i18n/LanguageContext';

interface AppHeaderProps {
  currentTitle: string;
  firstName: string;
  academicMeta: string;
  accountName: string;
  avatarInitial: string;
  roleLabel: string;
  userEmail?: string;
  onOpenMobileNav: () => void;
  onSignOut: () => void | Promise<void>;
}

export function AppHeader({
  currentTitle,
  firstName,
  academicMeta,
  accountName,
  avatarInitial,
  roleLabel,
  userEmail,
  onOpenMobileNav,
  onSignOut,
}: AppHeaderProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-2xl sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          aria-label={t('openMenu')}
          data-testid="button-open-mobile-nav"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-slate-300 transition-colors hover:border-cyan-400/20 hover:text-cyan-300 md:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <div className="hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 sm:flex">
            <span>Y HUB</span>
            <ChevronLeft
              size={13}
              className={language === 'en' ? 'rotate-180' : ''}
            />
            <span className="truncate text-slate-400">
              {t('academy')}
            </span>
          </div>

          <div className="truncate text-sm font-black text-foreground sm:mt-1 sm:text-base">
            {currentTitle}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden text-left lg:block">
          <div className="text-xs font-bold text-foreground">
            {language === 'ar'
              ? `مرحباً، ${firstName}`
              : `Welcome, ${firstName}`}
          </div>

          <div className="mt-1 max-w-[220px] truncate text-[10px] text-muted-foreground">
            {academicMeta}
          </div>
        </div>

        <button
          onClick={() =>
            setLanguage(language === 'ar' ? 'en' : 'ar')
          }
          className="h-9 rounded-xl border border-border bg-card px-3 text-[11px] font-black tracking-wide text-primary transition-all hover:bg-accent/10"
          aria-label={t('language')}
          data-testid="button-language-toggle"
        >
          {language === 'ar' ? 'EN' : 'AR'}
        </button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={
                language === 'ar' ? 'فتح قائمة الحساب' : 'Open account menu'
              }
              className="rounded-xl border border-transparent p-0.5 transition-colors hover:border-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              <Avatar className="h-10 w-10 rounded-xl">
                <AvatarImage src={undefined} alt={accountName} />
                <AvatarFallback className="rounded-xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.12] to-violet-500/[0.12] font-black text-cyan-200">
                  {avatarInitial}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-64 border-border bg-popover p-2 text-popover-foreground shadow-2xl"
          >
            <DropdownMenuLabel className="px-3 py-3">
              <div className="truncate text-sm font-black text-popover-foreground">
                {accountName}
              </div>

              <div className="mt-1 truncate text-[11px] font-normal text-muted-foreground">
                {userEmail || academicMeta}
              </div>

              <div className="mt-2 inline-flex rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-2.5 py-1 text-[10px] font-bold text-cyan-300">
                {roleLabel}
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-xl text-popover-foreground focus:bg-accent/10 focus:text-accent-foreground"
            >
              <Link
                href="/profile"
                className="flex w-full items-center gap-2.5"
              >
                <UserRound size={16} />
                {language === 'ar'
                  ? 'الملف الشخصي'
                  : 'Profile'}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem
              className="cursor-pointer rounded-xl text-red-400 focus:bg-red-500/10 focus:text-red-300"
              onClick={onSignOut}
            >
              <ArrowRight size={16} />
              {language === 'ar'
                ? 'تسجيل الخروج'
                : 'Log out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
