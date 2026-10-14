import { describe, expect, it } from 'vitest';
import { generateTimeline, generateLessonPlan } from '../pdfEngine';
import { generateTimeline as directTimeline } from '@/features/course-manager/domain/generateTimeline';
import { generateLessonPlan as directLesson } from '@/features/ai-generator/lesson-plan/generateLessonPlan';
import { getCourses as oldGetCourses } from '../courseStorage';
import { getCourses as newGetCourses } from '@/features/course-manager/storage/indexedDbCourseStore';
import { exportToPDF as legacyPdf } from '../pdfExport';
import { exportToPDF as directPdf } from '@/features/solver/services/printSolverReport';

describe('legacy exports stay compatible after domain separation', () => {
  it('retains the AI/PDF entry points', () => {
    expect(generateTimeline).toBe(directTimeline);
    expect(generateLessonPlan).toBe(directLesson);
  });
  it('retains the local course store entry point', () => {
    expect(oldGetCourses).toBe(newGetCourses);
  });
  it('retains the solver report entry point', () => {
    expect(legacyPdf).toBe(directPdf);
  });
});
