# Exact changed-file inventory

Each feature diff uses its actual merge-base with the intended PR target, so the grant UI follow-up is not misreported as a removal from its older child branches. No historical migration or math algorithm files were edited. Math HTTP transport/authentication port changes are explicitly in the engine-grant diff. The integration branch contains harness/docs, not a merge of feature branches.

## feature/exceptional-engine-access

Comparison base `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136`; implementation head `62a0565c75319e46881a473b1c6bcbc0bf8096f7`.

```text
A	artifacts/y-hub/python/api/authorization.py
A	artifacts/y-hub/python/tests/test_engine_authorization.py
A	artifacts/y-hub/src/features/engine-access/EngineAccessPage.tsx
A	artifacts/y-hub/src/features/engine-access/__tests__/page.test.tsx
A	artifacts/y-hub/src/features/engine-access/__tests__/repository.test.ts
A	artifacts/y-hub/src/features/engine-access/index.ts
A	artifacts/y-hub/src/features/engine-access/repository.ts
A	artifacts/y-hub/src/modules/__tests__/exceptionalAccess.test.ts
A	artifacts/y-hub/src/modules/engine-access/module.ts
A	artifacts/y-hub/src/services/math/python/transportHeaders.ts
A	artifacts/y-hub/supabase/migrations/0033_exceptional_engine_access.sql
A	artifacts/y-hub/supabase/tests/university/test_engine_grants.py
A	docs/university/ENGINE_ACCESS.md
A	docs/university/ENGINE_ACCESS_PR.md
A	scripts/test-university.sh
A	tools/export_module_policy.mjs
A	tools/export_module_policy.test.mjs
M	artifacts/y-hub/python/api/server.py
M	artifacts/y-hub/python/tests/test_api_contract.py
M	artifacts/y-hub/src/app/ApplicationFrame.tsx
M	artifacts/y-hub/src/components/layout/__tests__/navigation.test.ts
M	artifacts/y-hub/src/contexts/AuthContext.tsx
M	artifacts/y-hub/src/features/app-shell/__tests__/navigationRoutes.test.ts
M	artifacts/y-hub/src/features/app-shell/components/AppShellController.tsx
M	artifacts/y-hub/src/features/app-shell/components/navigation/buildNavigationGroups.ts
M	artifacts/y-hub/src/features/app-shell/domain/navigationRoutes.ts
M	artifacts/y-hub/src/features/app-shell/hooks/useAppNavigation.ts
M	artifacts/y-hub/src/main.tsx
M	artifacts/y-hub/src/modules/__tests__/registry.test.ts
M	artifacts/y-hub/src/modules/access.ts
M	artifacts/y-hub/src/modules/contracts.ts
M	artifacts/y-hub/src/modules/layout.ts
M	artifacts/y-hub/src/modules/navigation.ts
M	artifacts/y-hub/src/routing/AppRoutes.tsx
M	artifacts/y-hub/src/routing/ProtectedRoute.tsx
M	artifacts/y-hub/src/routing/__tests__/AppRoutes.test.tsx
M	artifacts/y-hub/src/services/math/ports/index.ts
M	artifacts/y-hub/src/services/math/python/adapter.ts
M	artifacts/y-hub/src/services/math/python/phaseClient.ts
M	artifacts/y-hub/supabase/tests/audit/test_audit.py
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
M	python_math_service/app/main.py
```

## feature/student-quick-access

Comparison base `db0ae2d7b57efee2ed85621d8a3e9f2488abda02`; implementation head `f862ae29b547940dfe1790a9d9f14f63b35d6b3f`.

```text
A	artifacts/y-hub/src/features/student-dashboard/__tests__/quickAccess.test.tsx
A	artifacts/y-hub/src/features/student-dashboard/components/QuickAccessEditor.tsx
A	artifacts/y-hub/src/features/student-dashboard/hooks/useQuickAccess.ts
A	artifacts/y-hub/src/features/student-dashboard/services/quickAccessRepository.ts
A	artifacts/y-hub/supabase/migrations/0034_student_quick_access.sql
A	artifacts/y-hub/supabase/tests/university/test_quick_access.py
A	docs/university/QUICK_ACCESS.md
A	docs/university/QUICK_ACCESS_PR.md
M	artifacts/y-hub/src/features/student-dashboard/components/StudentDashboardSidebar.tsx
M	artifacts/y-hub/src/features/student-dashboard/pages/StudentDashboardPage.tsx
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
```

## feature/y-attendance

Comparison base `db0ae2d7b57efee2ed85621d8a3e9f2488abda02`; implementation head `c1a4bd2dc286386230f2fe14103ff7f81da06e64`.

```text
A	artifacts/y-hub/src/features/y-attendance/AttendancePage.tsx
A	artifacts/y-hub/src/features/y-attendance/AttendanceReport.tsx
A	artifacts/y-hub/src/features/y-attendance/QrPanel.tsx
A	artifacts/y-hub/src/features/y-attendance/__tests__/attendance.test.tsx
A	artifacts/y-hub/src/features/y-attendance/index.ts
A	artifacts/y-hub/src/features/y-attendance/repository.ts
A	artifacts/y-hub/src/modules/y-attendance/module.ts
A	artifacts/y-hub/src/shared/academic/lectures.ts
A	artifacts/y-hub/supabase/migrations/0035_academic_attendance.sql
A	artifacts/y-hub/supabase/tests/university/test_attendance.py
A	docs/university/ATTENDANCE.md
A	docs/university/ATTENDANCE_PR.md
M	artifacts/y-hub/package.json
M	artifacts/y-hub/src/components/layout/__tests__/navigation.test.ts
M	artifacts/y-hub/src/features/app-shell/__tests__/navigationPresentationBoundary.test.ts
M	artifacts/y-hub/src/features/app-shell/__tests__/navigationRoutes.test.ts
M	artifacts/y-hub/src/modules/__tests__/registry.test.ts
M	artifacts/y-hub/src/routing/__tests__/AppRoutes.test.tsx
M	artifacts/y-hub/supabase/tests/audit/test_audit.py
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
M	pnpm-lock.yaml
```

## feature/online-lectures

Comparison base `c1a4bd2dc286386230f2fe14103ff7f81da06e64`; implementation head `09168c2f0229e27952180be33a0d5cf47a0789e9`.

```text
A	artifacts/y-hub/src/features/online-lectures/LectureRoom.tsx
A	artifacts/y-hub/src/features/online-lectures/OnlineLecturesPage.tsx
A	artifacts/y-hub/src/features/online-lectures/__tests__/page.test.tsx
A	artifacts/y-hub/src/features/online-lectures/__tests__/room.test.tsx
A	artifacts/y-hub/src/features/online-lectures/index.ts
A	artifacts/y-hub/src/features/online-lectures/provider.ts
A	artifacts/y-hub/src/features/online-lectures/repository.ts
A	artifacts/y-hub/src/modules/online-lectures/module.ts
A	artifacts/y-hub/supabase/functions/lecture-access/handler.test.ts
A	artifacts/y-hub/supabase/functions/lecture-access/handler.ts
A	artifacts/y-hub/supabase/functions/lecture-access/index.ts
A	artifacts/y-hub/supabase/migrations/0036_online_lectures.sql
A	artifacts/y-hub/supabase/tests/university/test_lectures.py
A	docs/university/ONLINE_LECTURES.md
A	docs/university/ONLINE_LECTURES_PR.md
M	artifacts/y-hub/package.json
M	artifacts/y-hub/src/components/layout/__tests__/navigation.test.ts
M	artifacts/y-hub/src/features/app-shell/__tests__/navigationPresentationBoundary.test.ts
M	artifacts/y-hub/src/features/app-shell/__tests__/navigationRoutes.test.ts
M	artifacts/y-hub/src/modules/__tests__/registry.test.ts
M	artifacts/y-hub/src/routing/__tests__/AppRoutes.test.tsx
M	artifacts/y-hub/src/shared/academic/lectures.ts
M	artifacts/y-hub/supabase/tests/audit/test_audit.py
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
M	pnpm-lock.yaml
```

## feature/owner-display-name

Comparison base `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136`; implementation head `b150fddc6cae053e9aa765ac5f3905b5d7156ffe`.

```text
A	docs/university/OWNER_LABEL.md
A	docs/university/OWNER_LABEL_PR.md
M	artifacts/y-hub/src/features/app-shell/__tests__/academicIdentity.test.ts
M	artifacts/y-hub/src/features/app-shell/domain/academicIdentity.ts
M	artifacts/y-hub/src/features/audit-log/domain/copy.ts
M	artifacts/y-hub/src/i18n/dashboardCopy.ts
M	artifacts/y-hub/src/i18n/profileLabels.ts
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
```

## test/university-integration

Comparison base `09168c2f0229e27952180be33a0d5cf47a0789e9`; implementation head `d6b5fd5293c9192966f07bf946d2395925b30822` (before final report-only commit).

```text
A	artifacts/y-hub/supabase/tests/integration/bootstrap.sql
A	artifacts/y-hub/supabase/tests/integration/runtime.py
A	artifacts/y-hub/supabase/tests/integration/test_http.py
A	scripts/test-supabase-http.sh
A	scripts/verify-university-snapshot.sh
A	tools/export_university_snapshot.py
A	tools/university-tests/quickAccessEditor.test.tsx
M	docs/architecture/AGENT_HANDOFF.md
M	docs/architecture/REFACTOR_PROGRESS.md
M	docs/university/ATTENDANCE.md
A	docs/university/CHANGED_FILES.md
A	docs/university/DEPENDENCY_REVIEW.md
M	docs/university/ENGINE_ACCESS.md
M	docs/university/ENGINE_ACCESS_PR.md
A	docs/university/FINAL_REPORT.md
A	docs/university/INTEGRATION_PR.md
M	docs/university/ONLINE_LECTURES.md
A	docs/university/OWNER_LABEL.md
A	docs/university/OWNER_LABEL_PR.md
A	docs/university/QUICK_ACCESS.md
A	docs/university/QUICK_ACCESS_PR.md
```
