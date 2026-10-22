# Phase 3 changed files

Relative to unchanged main `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136`. Independent branches; no merge performed. Generated from Git diff, including tests and docs. Final report/handoff additions are also on the integration branch.

## fix/phase3-supabase-security

Source checkpoint `56e5e3303e66a759336ec9a6ad2f474ea1ee4941` (later documentation commits may follow).

```text
A	artifacts/y-hub/supabase/migrations/0029_security_privileges_and_exam_access.sql
A	artifacts/y-hub/supabase/tests/academic/test_security.py
A	docs/phase3/SECURITY.md
A	docs/phase3/SECURITY_PR.md
```

## feature/phase3-exam-reliability

Source checkpoint `a9a814ef1e4b2a427d0357d18cdf79cfa83b9274` (later documentation commits may follow).

```text
A	artifacts/y-hub/src/features/exam-runner/__tests__/answerRecovery.test.ts
M	artifacts/y-hub/src/features/exam-runner/__tests__/submission.test.tsx
A	artifacts/y-hub/src/features/exam-runner/hooks/useAnswerRecovery.ts
M	artifacts/y-hub/src/features/exam-runner/hooks/useExamRunner.ts
M	artifacts/y-hub/src/features/exam-runner/pages/ExamRunnerPage.tsx
A	artifacts/y-hub/src/features/exam-runner/storage/answerRecovery.ts
A	artifacts/y-hub/supabase/migrations/0030_exam_question_snapshots.sql
M	artifacts/y-hub/supabase/tests/exams/test_attempts.py
A	docs/phase3/EXAMS.md
A	docs/phase3/EXAMS_PR.md
```

## feature/phase3-academic-management

Source checkpoint `caec7a29a11455b2ca2a242aa7dcde0dae865b92` (later documentation commits may follow).

```text
M	artifacts/y-hub/src/components/layout/__tests__/navigation.test.ts
A	artifacts/y-hub/src/features/academic-management/AcademicManagementPage.tsx
A	artifacts/y-hub/src/features/academic-management/__tests__/forms.test.tsx
A	artifacts/y-hub/src/features/academic-management/__tests__/module.test.ts
A	artifacts/y-hub/src/features/academic-management/__tests__/repository.test.ts
A	artifacts/y-hub/src/features/academic-management/__tests__/resource.test.tsx
A	artifacts/y-hub/src/features/academic-management/components/DefinitionForm.tsx
A	artifacts/y-hub/src/features/academic-management/components/InstructorPicker.tsx
A	artifacts/y-hub/src/features/academic-management/components/SectionForm.tsx
A	artifacts/y-hub/src/features/academic-management/components/SectionList.tsx
A	artifacts/y-hub/src/features/academic-management/domain/contracts.ts
A	artifacts/y-hub/src/features/academic-management/hooks/useAcademicResource.ts
A	artifacts/y-hub/src/features/academic-management/index.ts
A	artifacts/y-hub/src/features/academic-management/services/repository.ts
M	artifacts/y-hub/src/features/app-shell/__tests__/navigationRoutes.test.ts
M	artifacts/y-hub/src/features/dashboard/components/DashboardCourseCard.tsx
M	artifacts/y-hub/src/features/dashboard/services/courseEnrollmentRepository.ts
M	artifacts/y-hub/src/features/dashboard/types.ts
M	artifacts/y-hub/src/features/student-dashboard/components/StudentDashboardMain.tsx
M	artifacts/y-hub/src/features/student-dashboard/types.ts
M	artifacts/y-hub/src/modules/__tests__/registry.test.ts
A	artifacts/y-hub/src/modules/academic-management/module.ts
M	artifacts/y-hub/src/routing/__tests__/AppRoutes.test.tsx
A	artifacts/y-hub/src/shared/academic/enrollmentRepository.ts
A	artifacts/y-hub/supabase/migrations/0031_academic_management.sql
A	artifacts/y-hub/supabase/tests/academic/test_management.py
A	docs/phase3/ACADEMIC.md
A	docs/phase3/ACADEMIC_PR.md
```

## fix/phase3-rpc-conflicts

Source checkpoint `fa9c7e3d5d8cd38f0644a207f78703f24a9f3b3c` (later documentation commits may follow).

```text
M	artifacts/y-hub/src/features/course-syllabus/__tests__/repository.test.ts
M	artifacts/y-hub/src/features/course-syllabus/services/syllabusRepository.ts
M	artifacts/y-hub/src/features/y-sheets/integration/supabaseWorkbookStorage.ts
M	artifacts/y-hub/src/features/y-sheets/test/cloudStorage.test.ts
A	artifacts/y-hub/supabase/migrations/0032_rpc_application_conflicts.sql
M	artifacts/y-hub/supabase/tests/academic/test_syllabus.py
M	artifacts/y-hub/supabase/tests/y-sheets/test_saves.py
A	docs/phase3/RPC_CONFLICTS.md
A	docs/phase3/RPC_CONFLICTS_PR.md
```

## test/phase3-real-integration

Previous verified report checkpoint `627a13870dc63b9faa57a9a316f58a2730ae1afb`.

```text
A	artifacts/y-hub/supabase/tests/integration/bootstrap.sql
A	artifacts/y-hub/supabase/tests/integration/runtime.py
A	artifacts/y-hub/supabase/tests/integration/test_http.py
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
A	docs/phase3/CHANGED_FILES.md
A	docs/phase3/FINAL_REPORT.md
A	docs/phase3/INTEGRATION.md
A	docs/phase3/INTEGRATION_PR.md
A	scripts/test-supabase-http.sh
A	scripts/verify-phase3-snapshot.sh
```

## Protected scope

No historical 0001–0028 migration changes, mathematical algorithms, Vercel/Python deployment configuration, dependency manifests/lockfile, Supabase production credentials or global theme changes. The existing enrollment repository moves unchanged into a shared academic service, with its old public path re-exported. Existing route inventory tests gain the intended academic-management route; automatic manifest discovery stays unchanged.
