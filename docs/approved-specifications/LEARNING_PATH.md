# Decision26 — real section learning path

Date:2026-10-28. Branch:`feature/approved-learning-path`.
Base:latest remote main `7e57e9abb2015a0ba20936770dc12fb0ee7c54ef`, which externally merged decision24 through PR44. Do not repeat or recreate that PR. This branch is independent and not merged by this task.

## Implemented

The existing `/legacy-home` and `/legacy-course` routes now receive one shared `LearningPathPanel` from the application composition wrappers. It belongs to `course-syllabus` and is exported through that feature's public entry. No new module, route, dashboard or QuickAccess card was registered.

The student directory uses the existing `courses` table joined to `course_enrollments!inner`, filtered to the authenticated student's active enrollment and published sections. Instructor directory is restricted to assigned sections; Admin/Owner retain their existing RLS visibility. Pages have25 sections plus one lookahead, ordered by title/ID. Users explicitly choose a section; equal course titles never substitute for section IDs.

The existing `read_course_syllabus` RPC and `SyllabusPanel` supply actual units/topics. Material links retain `/course/:id/view` for students and `/course/:id` for staff. On refresh, visibility/focus restoration, page or account/role changes, cached views are cleared/revalidated. Aborted directory responses are ignored; failed/denied read-only syllabus reloads no longer show the previous snapshot as current. Existing editor drafts and conflict handling are preserved.

Removed fictitious learner/session identity, hardcoded fuzzy-learning path,37% progress, invented milestone and static completion badges from the active learning presentation. Original `/lesson/:slug` reference articles, previous/next navigation, Fuzzy Lab and quiz URLs/content remain. The independent reference is labelled as such and has no claimed personal completion. Historic course-plan helpers remain as unused compatibility code; the route no longer imports their hardcoded progress model. No algorithms changed.

Completion and practice performance are presented as separate concepts with honest unavailable states, not inferred zeros or percentages. Opening a topic does not write anything. Decisions27/41 (manual/verified activity completion with instructor rules) and42 (weighted performance) are still unimplemented and require their own server contracts. This package completes26 only.

## Permissions and database

No new migration or database policy was necessary: existing0018/0028/0041-era contracts already enforce identity, published/active enrollment, assignment and syllabus read access. UI filters are convenience filters, not an authorization substitute. Tests exercise manipulated student query IDs, same-title sections, withdrawal, unpublishing, foreign instructor access, Admin/Owner visibility and anonymous rejection through actual local JWT/PostgREST.

An already received response cannot be recalled from a browser. Refresh/focus revalidates visibility, and the server rechecks every new request. This package does not claim immediate pushed revocation while an idle tab remains focused. No local persistence of syllabus or completion records was added.

No SQL was applied to production; no production data/account changed. Migration0045 from merged PR44 is retained unchanged. The next migration number is0046 unless another remote change reserves it first.

## Verification

| Verification | Result |
|---|---|
| Full `scripts/verify-architecture-refactor.sh` | PASS:2127Vitest /244files;36Python;8architecture guard tests;full workspace TypeScript;strict architecture/math/module boundaries;production build |
| Targeted learning/syllabus/reference tests |68PASS (subset of2127), including a final exact accessible-label regression rerun |
| `scripts/test-academic.sh` |55PostgreSQL/RLS tests PASS plus immutable-number checks |
| `scripts/test-supabase-http.sh` |74real localAuth/JWT/PostgREST tests PASS;four new learning-path cases, existing exam/Sheets/audit/Tutor/attendance contracts retained |
| `scripts/test-learning-path-browser.mjs` |4PASS:home390pxArabic/dark/student,home1280pxEnglish/light/instructor,plan390pxArabic/light/student,plan1280pxEnglish/dark/admin |

Final failed tests:0. Browser screenshot evidence was inspected locally; source harness is committed. Unit fixtures do not substitute for the separate native HTTP authorization tests.

The browser checks use real routes, React and CSS with all non-local HTTP intercepted. They are not hosted Supabase evidence. Separate HTTP tests use real disposable GoTrue/JWT/PostgREST/PostgreSQL. No external database URL is accepted by those runners.

Initial browser verification exposed an accessible-name issue: wrapping the select and its options inside its label made its exact name include option text. The label is now explicitly associated with the select. Four browser cases then passed, including mobile width and permission refresh. No tests were disabled. Existing PDF.js Node-build, Vite chunk-size and Starlette/httpx warnings are unchanged. Vercel Python bundle size remains a known deferred issue; not investigated or modified.

## Changed files

- `course-syllabus`:new public LearningPathPanel, scoped directory repository, bilingual copy and unit/component tests; existing SyllabusPanel read-only reload visibility and public export.
- `pages/legacy/Home.tsx`, `pages/legacy/CoursePlan.tsx`:composition of the real syllabus into the existing routes.
- `legacy-home`:hero, learning slot, tool milestone wording, hook and tests.
- `legacy-course-plan/pages/CoursePlanPage.tsx` and tests:real section plan instead of fabricated duration/stages/completion.
- `legacy-lesson`:header/sidebar reference presentation and tests, preserving article/math/navigation content.
- `supabase/tests/integration/test_http.py`:four additional real permission/integration cases.
- `scripts/test-learning-path-browser.mjs`:four browser scenarios.
- This report, PR body,71-decision progress table, architecture handoff/progress.

## Pending

Hosted Staging, deployment configuration and production migration ledger remain PENDING; local tests do not establish production readiness. No main merge or production deployment was performed. Next independent group:27/41 completion records and verifiable activity rules, then AI Practice15–23/38–40 and performance42 according to the approved dependency order.72–80 remain excluded.

Git history and `git ls-remote` establish the final pushed SHA. A PR number must only be reported after a successful GitHub API result.

## Remote delivery

Remote checkpoint verified with `git ls-remote`: `656d464f41664bd895c984c9c95825c1a28a1a60` (implementation `97e075f`). The actual Draft PR creation returned `Post "https://api.github.com/graphql": Forbidden`; no new PR number is confirmed. This follow-up documentation commit records the previous verified SHA. Git/ls-remote establish its final SHA. Review creation link (not an existing PR): https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-learning-path

