import { LearningKicker } from '../../components/ui/learning-kicker';

export function LearningKickerDemo() {
  return (
    <div className="rounded-2xl border bg-card p-8">
      <LearningKicker>Learning path</LearningKicker>
      <h2 className="mt-3 text-2xl font-bold">Fuzzy membership functions</h2>
      <p className="mt-2 text-sm text-muted-foreground">Short uppercase labels establish the lesson hierarchy.</p>
    </div>
  );
}