import { LessonCard } from '../../components/ui/lesson-card';

export function LessonCardDemo() {
  return (
    <div className="space-y-3">
      <LessonCard number="01" title="From classical to fuzzy sets" subtitle="Support, core, height, and α-cuts" progress={37} meta="3 deep sections" />
      <LessonCard number="02" title="Membership functions" subtitle="Design a function that matches the concept" progress={100} meta="Complete" />
    </div>
  );
}