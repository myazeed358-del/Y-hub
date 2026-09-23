import { BookOpen, FlaskConical, Home, Sparkles } from 'lucide-react';

import { LearningSidebar } from '../../components/ui/learning-sidebar';

export function LearningSidebarDemo() {
  return (
    <div className="rounded-2xl border bg-background p-5">
      <LearningSidebar
        title="Academy"
        subtitle="Fuzzy sets"
        items={[
          { label: 'Overview', active: true, icon: <Home size={17} /> },
          { label: 'Course plan', icon: <BookOpen size={17} /> },
          { label: 'Membership lab', icon: <FlaskConical size={17} /> },
          { label: 'Quick practice', icon: <Sparkles size={17} /> },
        ]}
        footer={<div className="rounded-2xl bg-sidebar-accent p-4 text-xs text-sidebar-foreground/70">Deep navy navigation keeps the learning path visible.</div>}
      />
    </div>
  );
}