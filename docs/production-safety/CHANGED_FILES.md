# Changed-file inventory

Paths are grouped by independent review branch; the implementations are not merged into main.

## Exam implementation — e6a41004e899da4e1321cc9c10448cbfb63b4bd6

- `artifacts/y-hub/src/features/exam-runner/__tests__/attemptProtocol.test.ts`
- `artifacts/y-hub/src/features/exam-runner/__tests__/submission.test.tsx`
- `artifacts/y-hub/src/features/exam-runner/domain/attemptProtocol.ts`
- `artifacts/y-hub/src/features/exam-runner/hooks/useExamRunner.ts`
- `artifacts/y-hub/src/features/exam-runner/pages/ExamRunnerPage.tsx`
- `artifacts/y-hub/src/features/exam-runner/services/examRunnerRepository.ts`
- `artifacts/y-hub/supabase/migrations/0025_exam_attempt_integrity.sql`
- `artifacts/y-hub/supabase/tests/exams/test_attempts.py`
- `docs/production-safety/BASELINE.md`
- `docs/production-safety/EXAMS.md`
- `docs/production-safety/EXAMS_PR.md`
- `scripts/test-exam-attempts.sh`

## Course implementation — 8f32d6eb20f60a0581617e56119f760b186a63fd

- `artifacts/y-hub/src/features/dashboard/hooks/useDashboardController.delete.test.tsx`
- `artifacts/y-hub/src/features/dashboard/hooks/useDashboardController.ts`
- `artifacts/y-hub/src/features/dashboard/services/dashboardRepository.delete.test.ts`
- `artifacts/y-hub/src/features/dashboard/services/dashboardRepository.ts`
- `artifacts/y-hub/src/i18n/dashboardCopy.ts`
- `artifacts/y-hub/supabase/migrations/0026_confirm_course_deletion.sql`
- `artifacts/y-hub/supabase/tests/courses/test_deletion.py`
- `docs/production-safety/BASELINE.md`
- `docs/production-safety/COURSES.md`
- `docs/production-safety/COURSES_PR.md`
- `scripts/test-course-deletion.sh`

## Dependency security — ac778eec4b1671a74b3e3f49e1ce9be811a4fef3

- `artifacts/y-hub/package.json`
- `artifacts/y-hub/src/shared/security/__tests__/mathjsDependency.test.ts`
- `docs/production-safety/DEPENDENCY_PR.md`
- `docs/production-safety/DEPENDENCY_SECURITY.md`
- `pnpm-lock.yaml`

## Release verification / handoff

- `artifacts/y-hub/supabase/tests/y-sheets/test_saves.py`
- `docs/architecture/AGENT_HANDOFF.md`
- `docs/architecture/REFACTOR_PROGRESS.md`
- `docs/production-safety/BASELINE.md`
- `docs/production-safety/CHANGED_FILES.md`
- `docs/production-safety/FINAL_REPORT.md`
- `docs/production-safety/VERIFICATION_PR.md`
- `docs/production-safety/Y_SHEETS_GATE.md`
- `scripts/test-production-safety-combined.sh`
- `scripts/verify-production-safety-snapshot.sh`
