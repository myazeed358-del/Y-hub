import type { ExamInfo } from '../types';
import { Link } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Clock, ArrowRight } from 'lucide-react';

interface Props {
  exam: ExamInfo;
  isSubmitted: boolean;
  timeLeft: number;
  formatTime: (seconds: number) => string;
}

export function ExamRunnerHeader({
  exam,
  isSubmitted,
  timeLeft,
  formatTime,
}: Props) {
  return (
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href={`/course/${exam.course_id}/view`}>
            <Button variant="outline" size="icon" className="shrink-0"><ArrowRight size={16} /></Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{exam.title}</h1>
        </div>
        {!isSubmitted && (
          <div className="flex items-center gap-2 text-destructive font-mono text-xl mt-2 md:mt-0 md:mr-auto bg-destructive/10 px-4 py-2 rounded-lg font-bold">
            <Clock size={20} /> {formatTime(timeLeft)}
          </div>
        )}
      </div>
  );
}
