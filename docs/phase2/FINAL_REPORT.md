# Phase 2 — implementation and verification

Final local review: 2026-10-20. This report covers fullscreen Y-Sheets, additive academic modeling, syllabus integration and academic permissions. No main merge, production write/migration, historical migration edit, mathematical engine change or dependency change was performed.

## Branches and review status

| Stream | Branch / intended PR base | Verified remote checkpoint |
| --- | --- | --- |
| A: fullscreen | `feature/fullscreen-application-shell` → `main` | `39dd464dc67b29ccf5b03eca5651213cd93ca13e` |
| B: academic model | `feature/academic-course-sections` → `main` | `99852b5f006a94b0f021619bc6ad2c622f96f56b` |
| C: syllabus/permissions | `feature/syllabus-academic-permissions` → `feature/academic-course-sections` | `61236700cca3dcb7d9d8d1705e363556327bf2be` before the final read-security fix/report |

The final C commit contains this report and therefore cannot contain its own hash. Its Git history and the final `git ls-remote` verification establish the delivered SHA. Main remained `b86dc4266c7a24209b4638c10e529415f82666a3`; PRs #19–#22 are already merged into that baseline. Baseline complete verification passed before implementation. Existing uncommitted work was preserved across resumes.

**PR creation remains blocked**, not complete: all three authorized `gh pr create --draft` requests returned `Post "https://api.github.com/graphql": Forbidden`. Current network policy permits Git transport but excludes api.github.com. No new PR number exists and no CI/Vercel success is claimed. Prepared descriptions are `FULLSCREEN_PR.md` on A, `ACADEMIC_PR.md` on B and `SYLLABUS_PR.md` on C. When API access is available, create Draft PRs with the bases above, checking for an existing PR first.

These are **comparison/create links, not created PRs**:

- [A comparison](https://github.com/myazeed358-del/Y-hub/compare/main...feature/fullscreen-application-shell?expand=1)
- [B comparison](https://github.com/myazeed358-del/Y-hub/compare/main...feature/academic-course-sections?expand=1)
- [C comparison](https://github.com/myazeed358-del/Y-hub/compare/feature/academic-course-sections...feature/syllabus-academic-permissions?expand=1)

## Confirmed problems and implemented fixes

| Problem | Delivered behavior |
| --- | --- |
| Y-Sheets inherited host chrome and a fragile fixed height calculation | Validated optional manifest route layout selects a reusable fullscreen frame; flex/grid and 100dvh with fallback fill the viewport without the host sidebar/header |
| Internal/Back navigation could leave an unsaved workspace | Shared guarded location handles internal navigation and history; consent and existing recovery persistence protect dirty/saving/conflicted work; a failed recovery write blocks leaving |
| `courses` conflated catalog identity with an offered section | 0027 adds explicit definitions while retaining existing courses as the physical section store and a security-invoker compatibility view |
| Existing syllabus tables lacked manual manager/student integration | Independent course-syllabus feature, application-level composition, bilingual CRUD/reorder/read-only view, typed RPC repository and revision-aware drafts |
| Historical content policies admitted other instructors; catalog-major enrollment was not explicit | 0028 adds restrictive current-role/section/major policies and preserves existing active enrollments |
| Concurrent or RLS-denied syllabus writes could otherwise overwrite/appear successful | Transactional expected-revision save, actor/course locks, direct-DML revision triggers, exact final membership/write checks, mandatory audit rollback |
| A demoted instructor enrolled in their old section could read answer keys and other students' results | Restrictive direct-question SELECT requires a current staff role; result SELECT permits personal historical results or current authorized staff only |

The final security regression was demonstrated before the fix: after demotion, direct queries returned **one answer-key row and one other-student result**, where both should be zero. `/tmp/phase2-c-read-security-before.log` ran 30 tests with one failure. After the 0028 policy fix, both counts are zero. The regression also proves the current instructor can still author/read their question and review results, and the original student can still read their own historical result. Students continue through `get_exam_questions`, which enforces the server attempt and omits correct_answer; existing exam tests pass. No historical permissive policy is silently broadened or edited.

## Final design

### Application layout

Module Manifest API v2 gains optional route metadata `layout: 'standard' | 'fullscreen'` (standard by default), validated by the registry. Layout derives from accepted enabled routes and the shared access policy, not a hardcoded Y-Sheets URL. Existing authentication/providers, route authorization and module error isolation remain. Y-Sheets opts in; other modules retain their layouts.

The fullscreen frame and scoped workspace CSS reserve toolbar, formula bar, sheet tabs and status bar while the grid scrolls internally. A persistent Arabic/English return button uses the guarded router and restores the ordinary host shell on leaving. Recovery uses the existing Y-Sheets system, not a second save protocol. The guard's fallback for history entries without its own index restores the current URL with a new history entry; it cannot reconstruct an external browser history stack.

### Academic data and compatibility

0027 adds `course_definitions` (catalog metadata, explicit major, UUID identity), immutable `courses.course_definition_id`, optional section label/term and an updatable `course_sections` security-invoker view. Existing course IDs and all child FKs remain authoritative. Backfill creates one definition per old course, including identical names/codes; it never merges by text. Original course attributes, enrollments, materials, syllabus, exams, results and audit references survive. Legacy inserts receive a fresh definition transactionally. Explicit definitions allow multiple independent sections. Definitions with live sections cannot be deleted.

0028 adds current-role/section restrictions and server-managed syllabus revision, plus `read_course_syllabus` and `save_course_syllabus`. Actual syllabus mutations are SECURITY INVOKER under existing RLS; a narrow definer helper locks the current actor role and owned section. Empty search paths and private function privilege revocation prevent search-path/client invocation abuse. Save validates the complete graph before writing, rejects stale revisions/foreign identities/denied writes, and rolls back on required audit failure. Same-value saves do not increment revision or duplicate content audit. Deleted section IDs present in retained audit cannot be reused.

| Actor | Database behavior |
| --- | --- |
| Student | Published metadata for matching/unclassified major or retained active enrollment; section content only when actively enrolled; no syllabus writes or direct answer keys; own historical results retained |
| Instructor | Owned sections/content and owned syllabus writes, with current DB role checked; no shared catalog edits |
| Admin / super_admin | Existing table-specific read permissions retained; catalog management allowed; syllabus editing retains existing section ownership requirement |
| Anonymous / missing profile | No new access through the new views/RPCs; no syllabus write access |

Catalog audit events are reserved for super_admin. Instructor section/syllabus actions retain the existing admin audit visibility. Catalog kind/major, UI visibility and JWT role hints do not substitute for database permissions. Existing public Storage behavior is unchanged.

## Files and migrations

The exact per-stream added/modified paths are in [CHANGED_FILES.md](CHANGED_FILES.md). Key implementation boundaries:

- A: application frame/layout CSS, module contract/registry/layout resolver, Y-Sheets workspace/host adapter/scoped CSS, shared guarded navigation, unit and Chromium tests.
- B: shared academic contracts, **0027_academic_course_definitions.sql**, pre-migration fixtures and compatibility/RLS tests.
- C: **0028_syllabus_and_academic_permissions.sql**, `features/course-syllabus/`, public feature entry points/composition slots in manager/student pages, catalog audit labels, SQL/frontend/browser tests.
- Handoff/progress and per-stream contracts/review descriptions were updated. Historical migrations 0001–0026, math algorithms and lockfiles are unchanged.

## Verification evidence

| Scope | Result |
| --- | --- |
| Main baseline | Full script PASS; 1819 Vitest / 206 files |
| A source checkpoint | Full script PASS; 1830 Vitest / 208 files; final additional CSS assertion passed in the focused five-test suite and later combined suite |
| B source checkpoint | Full script PASS; 1819 Vitest / 206 files; 12 academic SQL tests plus existing audit/exam/course suites |
| C source checkpoint 6123670 | Full script PASS; 1843 Vitest / 209 files |
| Combined A + C frontend source export | **1855 Vitest / 211 files**, **29 Python**, **8 boundary guard tests**, root/all-workspace TypeScript, architecture/math/module audits and production build PASS |
| Final SQL after read-security fix | **91 PostgreSQL tests: 30 academic + 26 audit + 16 exam + 9 course deletion + 10 Y-Sheets**, all PASS |
| Additional SQL assertions | Immutable user-number checks and 14 historical Y-Sheets RLS assertions PASS |
| Chromium fullscreen | **16 geometry cases**: 1920×1080, 1366×768, 768×1024, 390×844 × Arabic/English × dark/light; Back/return guards, conflict recovery, ordinary-shell restoration and guest denial PASS |
| Chromium syllabus | Actual manager/student composition, Arabic dark mobile and English light laptop; manual units/topics/save, conflict draft retention, confirmed reload and student read-only behavior PASS |

The combined export is produced by `scripts/verify-phase2-snapshot.sh`: it overlays A's source on C's temporary Git archive, without merging any branch or modifying main. The successful combined run used A `39dd464` and C `6123670`. The only subsequent product change is the SQL read-policy fix, covered by the freshly rerun five SQL suites; no TS/UI source changed after the combined run. No skipped/disabled tests or relaxed boundary checks were used to obtain passing results.

Commands: `bash scripts/verify-architecture-refactor.sh`; `YHUB_PHASE2_BROWSER=1 bash scripts/verify-phase2-snapshot.sh` with the prepared pnpm/Python/Playwright paths; `bash scripts/test-{academic,audit-log,exam-attempts,course-deletion,y-sheets}.sh`. Database scripts force the local Docker socket, disposable PostgreSQL 16, network none and no published ports; they accept no production DB URL.

Local logs: `/tmp/phase2-baseline.log`, `/tmp/phase2-{a,b,c}-full.log`, `/tmp/phase2-combined-full.log`, `/tmp/phase2-c-final-{academic,audit,exams,courses,sheets}.log`, and the before/after security proof logs. Fullscreen PNGs: `/tmp/yhub-phase2-screenshots/{en,ar}-{light,dark}-{1920,1366,768,390}.png`; these are local artifacts, not durable CI attachments. Browser traffic uses synthetic intercepted HTTP and real UI/router/CSS, not real Supabase accounts.

Existing warnings: large generated chunks, PDF.js Node legacy-build warning and Starlette/httpx deprecation. None was suppressed. Successful local production bundling is not a Vercel deployment result.

## Remaining gates and limits

**Ready for code/local-behavior review; not production-ready and not approved to merge.**

1. **Staging PENDING:** no confirmed isolated Supabase exists. Validate real signed JWT sessions for student/instructor/admin/super_admin, PostgREST RLS/RPC/view access, role revocation, real-device concurrent saves and Storage behavior. Local auth stand-ins and synthetic browser requests cannot establish this integration.
2. **Production ledger UNKNOWN:** application of 0025/0026 is not proven. A read-only anonymous OpenAPI request returned 401; that proves neither missing migrations nor a broken deployment. No potentially mutating attempt/status RPC was used as a production probe. 0027/0028 remain unapplied to production.
3. Before any authorized academic migration, rehearse backup/restore, inspect real historical rows and NULL major classification, audit volume, backfill duration/locks and PostgREST schema cache. Do not automatically merge same-code catalog rows.
4. GitHub API access blocks Draft PR creation. CI/Vercel status/log review remains pending; no check is waived and the known Python bundle limitation was not investigated.
5. Direct child DML and full-snapshot syllabus saves can deadlock due to lock order; PostgreSQL rolls one transaction back atomically. Clients preserve drafts and must reload/retry. Syllabus drafts are in-page only, not durable local/cross-device backup; failed saves retain them until navigation/reload.
6. Public material Storage URLs and nontransactional blob deletion are existing limits, not solved by academic RLS. Deleted-ID protection covers retained audit history, not deletions predating that history or database owners bypassing protections.
7. AI syllabus generation and section-specific exceptional engine grants do not exist as completed features and were not fabricated. Existing engine permissions remain fail-closed.

Next work is the blocked PR delivery plus isolated staging/release review, not another implementation restart. Do not apply migrations, merge branches or alter production permissions automatically.
