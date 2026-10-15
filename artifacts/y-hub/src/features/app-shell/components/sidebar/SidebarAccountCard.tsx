import * as React from 'react';
import { UserRound } from 'lucide-react';
import { Link } from 'wouter';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/y-hub-ds/components/ui/avatar';

interface SidebarAccountCardProps {
  accountName: string;
  academicMeta: string;
  avatarInitial: string;
  onCloseMobileNav: () => void;
}

export function SidebarAccountCard({
  accountName,
  academicMeta,
  avatarInitial,
  onCloseMobileNav,
}: SidebarAccountCardProps) {
  return (
      <Link
        href="/profile"
        onClick={() => onCloseMobileNav()}
        className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3 transition-all hover:border-cyan-300 hover:bg-cyan-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:hover:border-cyan-400/15 dark:hover:bg-cyan-400/[0.04]"
      >
        <Avatar className="h-10 w-10 rounded-xl border border-cyan-400/15">
          <AvatarImage src={undefined} alt={accountName} />
          <AvatarFallback className="rounded-xl bg-cyan-100 font-black text-cyan-700 dark:bg-cyan-400/[0.08] dark:text-cyan-300">
            {avatarInitial}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-foreground dark:text-slate-200">
            {accountName}
          </div>
          <div className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-600">
            {academicMeta}
          </div>
        </div>

        <UserRound size={16} className="shrink-0 text-slate-500 dark:text-slate-600" />
      </Link>
  );
}
