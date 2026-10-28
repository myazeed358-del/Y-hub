import CoursePlanPage from '@/features/legacy-course-plan/pages/CoursePlanPage';
import { LearningPathPanel } from '@/features/course-syllabus';
export default function CoursePlan() {
  return <CoursePlanPage learningPath={<LearningPathPanel />} />;
}
