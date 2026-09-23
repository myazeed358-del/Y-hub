import { ProgressRing } from '../../components/ui/progress-ring';
import { Row } from '../parts';

export function ProgressRingDemo() {
  return (
    <div className="rounded-2xl border bg-card p-8">
      <Row label="Progress states">
        <ProgressRing value={0} />
        <ProgressRing value={37} />
        <ProgressRing value={72} />
        <ProgressRing value={100} />
      </Row>
    </div>
  );
}