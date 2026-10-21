# Changed files — Phase 2

Generated from reviewed Git commits. Each stream has its own branch/base. Historical migrations 0001–0026, mathematical engines and dependency lockfiles are unchanged.

## A — Fullscreen application shell

Base `b86dc42`, verified implementation `39dd464dc67b29ccf5b03eca5651213cd93ca13e`.

```text
M	artifacts/y-hub/src/App.tsx
M	artifacts/y-hub/src/app/ApplicationFrame.tsx
M	artifacts/y-hub/src/app/__tests__/ApplicationFrame.test.tsx
A	artifacts/y-hub/src/app/application-layout.css
M	artifacts/y-hub/src/features/y-sheets/App.css
M	artifacts/y-hub/src/features/y-sheets/integration/YSheetsHostAdapter.tsx
M	artifacts/y-hub/src/features/y-sheets/test/cssIsolation.test.tsx
M	artifacts/y-hub/src/features/y-sheets/test/workspace.test.tsx
M	artifacts/y-hub/src/features/y-sheets/workspace/WorkbookWorkspace.tsx
M	artifacts/y-hub/src/features/y-sheets/workspace/useWorkbookWorkspace.ts
A	artifacts/y-hub/src/features/y-sheets/workspace/workspace.css
A	artifacts/y-hub/src/modules/__tests__/layout.test.ts
M	artifacts/y-hub/src/modules/contracts.ts
M	artifacts/y-hub/src/modules/index.ts
A	artifacts/y-hub/src/modules/layout.ts
M	artifacts/y-hub/src/modules/registry.ts
M	artifacts/y-hub/src/modules/y-sheets/module.ts
A	artifacts/y-hub/src/shared/navigation/__tests__/guardedLocation.test.ts
A	artifacts/y-hub/src/shared/navigation/guardedLocation.ts
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/PLUGIN_CONTRACT.md
M	docs/architecture/REFACTOR_PROGRESS.md
A	docs/phase2/FULLSCREEN.md
A	docs/phase2/FULLSCREEN_PR.md
A	scripts/test-fullscreen-browser.mjs
```

## B — Catalog/section compatibility

Base `b86dc42`, verified implementation `99852b5f006a94b0f021619bc6ad2c622f96f56b`.

```text
A	artifacts/y-hub/src/shared/academic/contracts.ts
A	artifacts/y-hub/supabase/migrations/0027_academic_course_definitions.sql
A	artifacts/y-hub/supabase/tests/academic/legacy.sql
A	artifacts/y-hub/supabase/tests/academic/support.py
A	artifacts/y-hub/supabase/tests/academic/test_architecture.py
M	artifacts/y-hub/supabase/tests/audit/test_audit.py
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
A	docs/phase2/ACADEMIC_MODEL.md
A	docs/phase2/ACADEMIC_PR.md
A	scripts/test-academic.sh
```

## C — Syllabus/permissions

Base `99852b5f006a94b0f021619bc6ad2c622f96f56b`, verified implementation `61236700cca3dcb7d9d8d1705e363556327bf2be`.

```text
M	artifacts/y-hub/src/features/audit-log/__tests__/AuditLogPage.test.tsx
M	artifacts/y-hub/src/features/audit-log/domain/auditLog.ts
M	artifacts/y-hub/src/features/audit-log/domain/copy.ts
A	artifacts/y-hub/src/features/course-manager/index.ts
M	artifacts/y-hub/src/features/course-manager/pages/CourseManagerPage.tsx
A	artifacts/y-hub/src/features/course-syllabus/__tests__/SyllabusPanel.test.tsx
A	artifacts/y-hub/src/features/course-syllabus/__tests__/repository.test.ts
A	artifacts/y-hub/src/features/course-syllabus/__tests__/useSyllabus.test.tsx
A	artifacts/y-hub/src/features/course-syllabus/components/SyllabusPanel.tsx
A	artifacts/y-hub/src/features/course-syllabus/domain/copy.ts
A	artifacts/y-hub/src/features/course-syllabus/domain/syllabus.ts
A	artifacts/y-hub/src/features/course-syllabus/hooks/useSyllabus.ts
A	artifacts/y-hub/src/features/course-syllabus/index.ts
A	artifacts/y-hub/src/features/course-syllabus/services/syllabusRepository.ts
M	artifacts/y-hub/src/features/student-course/components/StudentCourseContent.tsx
A	artifacts/y-hub/src/features/student-course/index.ts
M	artifacts/y-hub/src/features/student-course/pages/StudentCoursePage.tsx
M	artifacts/y-hub/src/pages/CourseManager.tsx
M	artifacts/y-hub/src/pages/StudentCourseView.tsx
A	artifacts/y-hub/supabase/migrations/0028_syllabus_and_academic_permissions.sql
M	artifacts/y-hub/supabase/tests/academic/test_architecture.py
A	artifacts/y-hub/supabase/tests/academic/test_syllabus.py
M	artifacts/y-hub/supabase/tests/audit/test_audit.py
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
A	docs/phase2/SYLLABUS_PERMISSIONS.md
A	docs/phase2/SYLLABUS_PR.md
A	scripts/test-syllabus-browser.mjs
A	scripts/verify-phase2-snapshot.sh
```

Final checkpoint additionally adds FINAL_REPORT.md and this inventory, updates handoff/progress/PR evidence, and removes trailing whitespace from the combined verification script. It also tightens question/result SELECT in new migration 0028 and adds a proven regression for demoted enrolled owners retaining access to answer keys/other students' results. Historical migrations remain unchanged.
