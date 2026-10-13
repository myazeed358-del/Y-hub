import * as React from 'react';
import { Check } from 'lucide-react';
import { Link } from 'wouter';
import type { LegacyLessonController } from '../hooks/useLegacyLesson';

type Props = Pick<
  LegacyLessonController,
  'language' | 'slug' | 'lessonItems'
>;

export function LessonSidebar({
  language,
  slug,
  lessonItems,
}: Props) {
  return (
<aside className="hidden lg:block">
          <div className="sticky top-28 rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="mb-4 text-xs font-bold text-[hsl(var(--muted-foreground))]">{language === 'ar' ? 'في هذا المسار' : 'In this path'}</div>
            <div className="space-y-1">{lessonItems.map(({ item, localizedItem }, itemIndex) => { return <Link key={item.slug} href={`/lesson/${item.slug}`} data-testid={`link-lesson-index-${itemIndex + 1}`} className={`flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-xs transition-colors ${item.slug === slug ? 'bg-[hsl(var(--primary)/.1)] font-bold text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/.55)]'}`}><span className="w-6 font-mono text-[10px]">{item.number}</span><span className="truncate">{localizedItem.title}</span>{item.progress === 100 && <Check size={13} className="mr-auto" />}</Link>; })}</div>
          </div>
        </aside>
  );
}
