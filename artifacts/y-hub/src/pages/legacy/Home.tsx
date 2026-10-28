import HomePage from '@/features/legacy-home/pages/HomePage';
import { LearningPathPanel } from '@/features/course-syllabus';
export default function Home() {
  return <HomePage learningPath={<LearningPathPanel />} />;
}
