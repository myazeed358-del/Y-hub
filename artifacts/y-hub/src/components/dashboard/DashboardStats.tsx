import { BookMarked, FileEdit, Globe2 } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import type { getDashboardCopy } from '@/i18n/dashboardCopy';

interface DashboardStatsProps {
  copy: ReturnType<typeof getDashboardCopy>;
  loading: boolean;
  courses: { length: number };
  publishedCount: number;
  draftCount: number;
}

export function DashboardStats({
  copy,
  loading,
  courses,
  publishedCount,
  draftCount,
}: DashboardStatsProps) {
  return (
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={copy.totalCourses}
          value={loading ? '—' : courses.length.toString()}
          description={copy.totalDescription}
          icon={BookMarked}
          tone="cyan"
        />

        <StatCard
          title={copy.published}
          value={loading ? '—' : publishedCount.toString()}
          description={copy.publishedDescription}
          icon={Globe2}
          tone="violet"
        />

        <StatCard
          title={copy.drafts}
          value={loading ? '—' : draftCount.toString()}
          description={copy.draftsDescription}
          icon={FileEdit}
          tone="slate"
        />
      </section>
  );
}
