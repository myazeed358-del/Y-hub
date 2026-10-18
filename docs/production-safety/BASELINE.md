# Phase 1 baseline — 2026-10-18 (Asia/Baghdad)

Captured before application/SQL edits. Clean single checkout; no untracked user files. New work branches start at remote main `57f3103b273285c27802e35f47189e16a8318035`. Do not merge or modify main.

## Verified remote state

- Git fetch/ls-remote succeeded. Contrary to the request's snapshot, PR #18 **is merged**: main merge `57f3103b`, head `1c0bc5cca3174ebab6d698475410c706768e90e4`. Confirmed with Git history and public PR HTML (`state: MERGED`). Existing Y-Sheets implementation is now the baseline; do not repeat it or add changes to a merged PR.
- PR #18 HTML reports **1 of 2 checks passed** and a Vercel deployment **Error**. This is an unresolved deployment gate, not attributed to a specific source change. GitHub GraphQL returns `Forbidden`; live check details/current main checks and PR creation are blocked by the active environment policy. No `.github` workflow files exist in the current tree.
- PR #14 is untouched. No merge/ready action is authorized.

## Environment and verification limits

Node 24, pinned pnpm 9.12, prepared Python virtualenv, local PostgreSQL Docker test scripts and Chromium harness are available. Only configured Supabase bindings are VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, for the previously identified production project. GET `/auth/v1/health` returned HTTP 200; no user records or mutating endpoints were requested. No confirmed staging connection, test JWT identities, privileged database connection or migration-history access is available. Applied production migrations, live RLS/roles, authenticated flows and schema drift are **unverified**. Never infer them from migration files or anonymous health.

Repository migrations are 0001–0024; 0023/0024 are included by the merged PR. Applied versions cannot be inferred. Reserve 0025 for exam attempts and 0026 for independently reviewable course deletion, checking remote changes before delivery. Historical migrations remain unchanged.

## Confirmed defects / existing protections

- `features/exam-runner/hooks/useExamRunner.ts`: sets isSubmitted before RPC success, with no retry state; timer resets from time_limit_minutes on every load and auto-submits on local zero. Result/query errors are ignored/cast without runtime validation in examRunnerRepository.
- Latest `submit_exam` is defined in 0006: server grading and active enrollment checks exist; `(exam_id,student_id)` uniqueness from 0003 prevents duplicate stored results. No durable attempts/server deadline; repeat submissions raise instead of reconciling a lost response. Keep the unique constraint and historical results.
- `get_exam_questions` currently permits students to read questions before any timed attempt begins; closing only submit RPC would leave unlimited pre-reading time.
- `dashboardRepository.deleteCourse` does not request affected rows; controller treats error:null as success. Existing confirmation does not describe dependent data loss. Courses cascade to materials, exams/questions/results, enrollment and syllabus. Audit triggers from 0022 must remain transactional and append-only.
- Y-Sheets contains completed CAS/receipt saves, local recovery, scoped CSS, bounded worker import and pinned unofficial @e965/xlsx 0.20.3. Existing verification is evidence to revalidate, not a staging pass.
- Python deployment routes `/api/*` to `api/index.py`; no deployment fix or math-engine modification is assumed necessary. Local Python contracts are in the full verification script.

## Reproducible checks

`bash scripts/verify-architecture-refactor.sh` runs all workspace TypeScript, architecture/module boundaries, Vitest, build and Python. `scripts/test-audit-log.sh` and `scripts/test-y-sheets.sh` use disposable local PostgreSQL containers without network and never accept a database URL. Y-Sheets Chromium harness is `scripts/test-y-sheets-browser.mjs`. New regression tests and isolated SQL tests will record failures before fixes and final results per workstream. Prior 1790/29/8 Y-Sheets SQL counts are historical, not new phase results.
