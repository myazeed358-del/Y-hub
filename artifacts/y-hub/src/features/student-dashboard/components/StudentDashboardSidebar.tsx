import { Calendar, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { useLanguage } from '@/i18n/LanguageContext';

interface Props {
  t: ReturnType<typeof useLanguage>['t'];
  tools: Array<{
    name: string;
    icon: LucideIcon;
    path: string;
  }>;
  setLocation: (path: string) => void;
}

export function StudentDashboardSidebar({
  t,
  tools,
  setLocation,
}: Props) {
  return (
      <div className="w-full xl:w-[320px] shrink-0 space-y-6">
        {/* Tools */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">{t('quickTools')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {tools.map((tool, i) => {
              const Icon = tool.icon;
              return (
                <button key={i} onClick={() => setLocation(tool.path)} className="flex flex-col items-center justify-center p-3 rounded-xl bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent)/.1)] border border-[hsl(var(--border))] transition-colors gap-2">
                  <Icon size={20} className="text-[hsl(var(--primary))]" />
                  <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">{t(tool.name.toLowerCase() as any) || tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Exams */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-[hsl(var(--primary))]" /> {t('upcomingExams')}
          </h3>
          <div className="flex flex-col gap-3">
             <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">{t('noExams')}</div>
          </div>
        </div>

        {/* Activity */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-[hsl(var(--primary))]" /> {t('recentActivity')}
          </h3>
          <div className="flex flex-col gap-3">
             <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">{t('noActivity')}</div>
          </div>
        </div>
      </div>
  );
}
