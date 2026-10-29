# Decisions 27/41 — reversible lesson completion

Date: 2026-10-29. Branch: `feature/approved-lesson-completion`.
Base: verified remote main `00ff09f0d0fe47b89d3ea532716add0829a42454`.

## Authorized merge and production request

The user explicitly requested merging the latest completed work, applying Supabase migrations, then continuing the approved decisions. Decision 26's verified branch `b30c0a9cc80bf5104d5cd00367e94d8feb63f232` was merged normally into main and pushed; `git ls-remote` confirmed main `00ff09f0d0fe47b89d3ea532716add0829a42454`. The previous main was `7e57e9abb2015a0ba20936770dc12fb0ee7c54ef` (decision 24 already merged through PR #44). No force push or duplicate PR.

Production migration work is now authorized, but **not executed**: this environment has only `VITE_SUPABASE_URL` and the public anonymous key. No privileged SQL connection, migration ledger access, or database-host network grant is configured. The requested secure `SUPABASE_DB_URL` environment binding is pending. Do not put credentials in chat, commit them, or replay historical SQL blindly. First inspect the actual production ledger and schema; determine missing migrations and dependencies before application. No production data, accounts, or permissions were modified. New development 0046 stays on its independent review branch.

## Implemented behavior

The existing course-syllabus feature now presents lesson completion on the existing course and learning-path pages. A lesson is the existing `syllabus_sections.id`, so course/section/topic identities and all URLs are retained. There is no new dashboard, duplicated module or central registration list.

- A currently enrolled student can mark a topic complete or incomplete and reverse that choice. Opening a topic creates no completion record.
- The assigned current instructor can choose manual completion, all selected activities, or any selected activity. Conditions are separate from editing the syllabus text.
- The first verifiable activity type is a submitted exam in the same section: the server checks `exam_attempts.status='submitted'`. Starting an attempt, opening a document, a browser-supplied score or a simulated AI quiz never qualifies. A submitted exam with a zero grade still qualifies; completion is not academic performance.
- Student manual choices override automatic evaluation, including a deliberate incomplete choice. “Use activity rules” clears that override without losing its revision history. Automatic completion is evaluated from current published activities and current conditions at read time; it is not a fabricated stored event.
- Unpublishing/deleting an exam removes its contribution to automatic completion. Its identifier remains in the condition until the instructor revises it; unavailable activities can be removed in the editor. Retained topic IDs preserve completion and conditions across syllabus text edits/reordering. Actual topic deletion removes its dependent records transactionally and preserves audit events.
- Arabic/English, light/dark themes, responsive controls, explicit loading/error/conflict/retry states and LTR numeric fractions within RTL prose. Failed mutations do not falsely display success; instructor drafts survive mutation errors. Reloading intentionally replaces the local snapshot.

## Database and security

Only additive `0046_lesson_completion.sql` is new. Historical migrations are unchanged.

| Contract | Purpose |
|---|---|
| `lesson_completion_rules` | One rule per existing topic; section ID, manual/all/any, up to 20 same-section published exam IDs, positive revision |
| `lesson_completion_overrides` | One learner/topic override; nullable completion, section ID, positive revision, database timestamp |
| `read_lesson_progress(p_course)` | Authorized section snapshot, own student progress, rules and at most 200 published exam choices |
| `set_lesson_completion(p_topic,p_expected_revision,p_state)` | Current student's completed/incomplete/automatic choice; actor comes only from `auth.uid()` |
| `set_lesson_completion_rule(p_topic,p_expected_revision,p_mode,p_exam_ids)` | Assigned current owner's validated rule update |

Both tables enable and force RLS. Authenticated users have SELECT only; anonymous/client/service-role table mutation is explicitly revoked. RPCs are `SECURITY DEFINER` with an empty pinned search path and no PUBLIC/anonymous/service-role execution grant. Existing `academic_section_visible` and `lock_managed_syllabus` define section visibility and ownership. Admin/Owner keep existing section-read scope, but reading does not permit editing another instructor's conditions. Staff responses do not contain another student's progress, answers or scores. Student progress table reads are self-only and require current active enrollment and published parent section.

Writes lock current role, course and enrollment/activities before changing state. Student updates share-lock the course and serialize only the same student/topic using a transaction advisory lock, including concurrent first inserts. Conditions use the existing parent syllabus lock. Expected revisions reject conflicting changes with terminal `PT409`; an already-applied identical retry returns the existing revision without a duplicate audit event. No client-supplied actor, timestamp, grade or completion evidence is accepted. Withdrawal, demotion and section unpublishing are checked again on subsequent requests.

Both tables have mandatory existing audit capture triggers. Rule changes use ordinary sensitivity; personal overrides are reserved. Actor/affected-person snapshots and append-only permissions come from the existing audit system. Required audit failure rolls back the domain change. The audit UI can filter both new entities. Automatic evaluation is read-only; the underlying exam submission remains the source of evidence rather than inventing an event at read time. Database-owner/superuser tampering is outside app-level guarantees.

## Verification

| Check on the final source snapshot | Result |
|---|---|
| `scripts/verify-architecture-refactor.sh` | PASS: 2139 Vitest tests / 246 files, 36 Python tests, 8 architecture guard tests, full workspace TypeScript, architecture/math/module boundaries, production build |
| Course-syllabus focused Vitest | 51 PASS across 7 files (subset of 2139; 12 new completion UI/repository cases) |
| `scripts/test-academic.sh` | 71 PostgreSQL/RLS tests PASS, including 16 new completion cases; immutable-number SQL checks PASS |
| `scripts/test-audit-log.sh` | 39 audit SQL/RLS tests and 1 concurrent migration-upgrade test PASS; immutable-number SQL checks PASS |
| `scripts/test-supabase-http.sh` | 77 actual local GoTrue/JWT/PostgREST tests PASS, including 3 new completion roundtrips |
| `scripts/test-lesson-completion-browser.mjs` | 4 PASS: 390px Arabic student (home dark/plan light), 1280px English instructor/home/light and admin/plan/dark |

Final failures: **0**. Tests run only against ephemeral local databases and native local GoTrue/JWT/PostgREST; no external database URL is accepted by the runners. Browser tests use actual routes/React/CSS but intercept remote API responses and are not hosted-Supabase evidence. Browser screenshots were inspected; numeric fractions retain LTR ordering in Arabic.

Cases cover manual undo/reset, no writes on view, zero-grade submitted activity, all/any rules, cross-section denial, current-role demotion, withdrawal/unpublishing, first-insert concurrency, terminal HTTP 409, lost-ack idempotency without duplicate audit, forbidden direct mutations, no other-student progress, no answer-key exposure, mandatory audit failure rollback (both tables), topic deletion and preservation through syllabus text edits. Existing exam, Sheets, Tutor, grant, attendance and audit HTTP regressions remain green.

Earlier failures were resolved, not suppressed: the initial audit coverage assertion needed the two explicitly classified new tables; one completion test counted unrelated fixtures instead of its own topic. An initial browser run timed out before the instructor's section selector while suites ran concurrently; a diagnostic rerun and the final four-scenario run passed without changing the route or suppressing the assertion. No product cause was established for that one timeout.

Local logs: `/workspace/completion-full-final.log`, `completion-focused-final.log`, `completion-sql-final2.log`, `completion-audit-final.log`, `completion-http-final.log`, `completion-browser-final.log`. These paths are disposable execution artifacts; the test runners and results above are the committed reproducible evidence.

## Limits and rollout

- Deploy 0046 before the new client; absent RPCs show an unavailable state, never invented completion. Check the real ledger first. The migration creates empty tables and adds foreign keys/triggers; no historical lesson completion or historical attempt evidence is invented. Review lock acquisition and migration duration against production-scale tables before deployment.
- Historical results without an `exam_attempts` submission do not automatically qualify. Additional verified activity types (including future AI Practice) need explicit server contracts; PDF opening and video watch claims are not trusted evidence.
- Automatic completion is based on **current** rules/publication, not a permanent achievement certificate. Legacy exam/grade data remain unchanged. Decision 42's weighted performance remains unimplemented.
- Published exam selection is capped at 200 choices with a visible notice; existing IDs outside the list are retained. Max 20 selected activities per rule. Existing syllabus bounds remain unchanged.
- Every new server request rechecks permissions. Already delivered browser data cannot be recalled. Reload and existing learning-path focus refresh revalidate snapshots; there is no claim of instant pushed revocation in an idle tab. No student completion cache is persisted in local storage.
- Hosted Staging, real production migration ledger, deployment and post-deploy role smoke tests remain **PENDING**. Local tests do not establish production readiness.
- Existing PDF.js Node-build, Vite chunk-size and Starlette/httpx warnings remain. Vercel Python bundle-size deployment issue remains deferred and untouched.

## Changed files

- `course-syllabus`: new `LessonProgressPanel.tsx`, `completionRepository.ts`, `completionCopy.ts`, and two test files; integration into `SyllabusPanel.tsx`, updated learning-path copy and existing component fixtures.
- `audit-log/domain/auditLog.ts`, `copy.ts`: two new filter values and bilingual labels, without changing reader permissions.
- `supabase/migrations/0046_lesson_completion.sql` and `tests/academic/test_completion.py`.
- Existing `tests/integration/test_http.py`: three native Auth/JWT/RPC scenarios; `tests/audit/test_audit.py`: explicit column classification for the two added audited tables.
- `scripts/test-lesson-completion-browser.mjs`: actual route/UI workflows at 390/1280 pixels across Arabic/English, student/instructor/admin, light/dark.
- This report/PR body, the 71-decision progress table and architecture handoff/progress.

Next independent group: AI Practice decisions 15–23/38–40, then performance 42. Reuse existing RAG and math ports; do not re-create the Tutor or implement recommendations 72–80.
