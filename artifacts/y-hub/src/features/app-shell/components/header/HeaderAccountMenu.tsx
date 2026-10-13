import * as React from 'react';
import { ArrowRight, UserRound } from 'lucide-react';
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
import { useLanguage } from '@/i18n/LanguageContext';

interface HeaderAccountMenuProps {
  accountName: string;
  academicMeta: string;
  avatarInitial: string;
  roleLabel: string;
  userEmail?: string;
  onSignOut: () => void | Promise<void>;
}

export function HeaderAccountMenu({
  accountName,
  academicMeta,
  avatarInitial,
  roleLabel,
  userEmail,
  onSignOut,
}: HeaderAccountMenuProps) {
  const { language } = useLanguage();

  return (
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
  );
}
