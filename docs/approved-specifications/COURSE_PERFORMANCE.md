# Course practice performance — 2026-11-02

## Approved scope and branch

This package advances decision42 in the existing AI Practice UI. It is on **feature/approved-course-performance**, based on the previous verified remote feature commit **9d5a4347a36f677bde03abc354644303b43f3887** (adaptive difficulty16). Main remains **a31429b51abd67e9a276d9cded42b8c3b5d8ff4d**. This is a separate branch stacked on that completed package; it includes0052 when compared to main. Do not automatically merge either package. Decisions72–80 remain outside scope.

Decision42 is **partially complete**: the working indicator now distinguishes AI Practice from submitted self-tests, uses configurable course weights and trusted results, and groups by reliably cited syllabus units. Precise syllabus-topic/PDF-chapter attribution requires decision20 metadata that does not yet exist. Official course exams and instructor-facing individual/class performance reports are not added to this learning-only indicator. No official grade or completion rule is changed.

## Actual implementation

- Migration **0053_ai_practice_performance.sql** adds a course-scoped weight table, protected by RLS and grants. Default50/50 is read-only implicit configuration until the assigned instructor saves weights. Values are integer0–100 and sum to100; zero weights are supported. Current database role and actual course assignment are required, including for an Admin/Owner who is an assigned instructor. Platform role alone grants no content or weight-management bypass.
- Weight writes use expected revision and a transaction advisory lock. Concurrent different edits have one winner/HTTP409; retrying an already-saved value is idempotent. All actual weight changes are captured by the central Audit Log with trusted actor/role, old/new weights and course ID. Mandatory audit failure aborts the configuration write. The existing audit UI adds an Arabic/English entity filter; its reader authorization is unchanged.
- The read RPC accepts only a course and unit-page offset. The actor comes from `auth.uid()` and cannot be supplied by the client. Students and other authorized Tutor users see their **own** outcomes only; an instructor can configure weights without seeing students' private practice history. Unenrolled/unassigned users, anonymous access and direct writes are rejected. New private helpers have no browser/service execution grant and fixed empty search paths; only the authorized public reader can aggregate protected data.
- Only released answers are considered: confirmed practice answers or submitted self-tests. Engine verification or a resolved human review is required for scoring. Human resolution overrides the engine key; pending reviews and ordinary AI suggestions remain pending, exclusions stay excluded, and none enters the score denominator. Drafts, unanswered questions and unsubmitted tests reveal no outcome through the report.
- Within each category, accuracy equals correct/graded. The overall score is the weighted average of those category accuracies, not a raw average of all questions. Example: practice2/3, self-test0/1, weights30/70 gives20%, not50%. When a positively weighted category has no graded results, its weight is omitted and the response exposes **coverage**; partial coverage is prominently labeled. A genuine0% remains0; no available weighted results returns `null`, never an invented zero.
- Each released attempt counts, including deliberate repeats. No claim of unique-exercise mastery is made; adaptive planning's distinct20-exercise window remains a separate policy. The indicator is not an official grade, a calibrated ability estimate, or proof of lesson completion.
- A question maps to a unit only if **every** trusted cited passage has the same nonnull unit ID and that unit belongs to the current course. Mixed-unit/PDF/unmapped references remain explicitly unclassified; the model, selected session units and guessed chapter titles cannot assign a topic. No question counts twice in the overall total.
- Entire sessions with changed/deleted/unreadable source scopes are omitted, matching protected session access. Their count is disclosed as unavailable sessions without exposing their protected contents. Historical attempts remain stored. Reports recompute from current state without a stale score cache; resolved reviews affect the next read.
- SQL aggregates numeric counts per mode/unit before forming JSON, then returns20 unit rows per page with course-wide totals independent of the page. Existing user/course and question indexes are reused. No question text, choices, answer keys, references or other student data are returned.

The bilingual component is integrated into `PracticeSourcesPanel`, behind a lazy expandable section, within the existing Tutor route and APIv2 feature. There is no duplicate app/dashboard/module. Loading, empty/partial results, denied/error states, explicit refresh, unit pagination and current-role weight controls use existing theme classes. Focus/visibility refresh clears cached outcome display before revalidation. Editable weight drafts survive refresh and retain their original CAS revision; they can be explicitly replaced with current server values. Course/user/role boundaries unmount the enclosing keyed workspace; denied access clears report/configuration display. A manual refresh is required to see changes made elsewhere while the page stays focused; no realtime subscription or persistent performance cache is introduced.

## Files

Relative to `artifacts/y-hub`:

- New `supabase/migrations/0053_ai_practice_performance.sql`.
- New `src/features/ai-generator/practice/performance/{repository,copy}.ts`, `PracticePerformance.tsx`, `PerformanceSummary.tsx`, `WeightEditor.tsx`, and their unit tests.
- Existing `PracticeSourcesPanel.tsx`: import and render only.
- Existing audit `domain/{auditLog,copy}.ts` and `AuditLogPage` tests: one entity/filter label in both languages; the exhaustive SQL audit inventory includes all columns of the new table.
- New `supabase/tests/academic/test_practice_performance.py`, `integration/test_practice_performance.py`, `upgrade/practice_performance.py`.
- Root `scripts/test-practice-performance-browser.mjs`; new explicit `performance` mode in the existing upgrade runner (previous modes preserved).
- This report/PR body, decision progress and architecture handoff/progress.

No old migration, math engine algorithm, existing answer/review RPC, AI provider instruction, quota, dependency, route, module registration, global style, Sheets feature or Vercel setting is modified.

## Verification

All final checks below passed. One exhaustive audit-classification test initially failed because the new audited table was not yet in its explicit inventory. The inventory was updated; its column coverage assertions remain intact, and the complete audit suite was rerun successfully.

| Check | Result |
|---|---|
| Full Vitest |2297 passed /260 files;25 new cases |
| Python |36 passed |
| Academic PostgreSQL/RLS |168 passed;15 new performance cases |
| Native local Auth/JWT/PostgREST |115 passed;5 new performance cases |
| Populated0052→0053 upgrade |1 passed |
| Prior practice upgrades0050→0051,0051→0052 |1 +1 passed |
| Audit SQL/RLS + upgrade |39 +1 passed |
| Chromium |29 passed:4 performance,4 sources,4 adaptive,4 manual,4 math,4 review,5 Tutor |
| Workspace TypeScript, architecture and build |PASS;8 boundary guard tests and math artifact drift check also PASS |

The136 focused practice Vitest cases include23 new performance cases and are a subset of the full suite, not additional to it. Two new bilingual Audit UI cases cover the filter. Final failing tests:0. Existing PDF.js Node warning, Vite chunk-size warning and Starlette/httpx deprecation remain; browser fixtures deliberately exercise403/409/503 and blocked external fonts without page errors. No tests or assertions were disabled. SQL cases cover honest empty/zero/partial coverage, per-category weighting, release boundaries, pending/excluded/human outcomes, source invalidation, course/actor isolation, revoked role/assignment/enrollment, direct-write/private-helper rejection, validation, CAS and lost-ack behavior, required audit rollback, trusted/mixed unit attribution and server pagination. Upgrade testing compares existing attempts, reviews, difficulty plans and completion tables before/after0053.

Native HTTP tests use actual disposable local GoTrue JWTs, PostgREST/RLS and the existing math verifier artifact; no provider or production traffic. Browser tests execute real React/CSS with intercepted HTTP fixtures on390/1280px Arabic/English and light/dark themes. Hosted Supabase, hosted Edge runtime and provider quality are **not** proved by these tests.

Commands: `scripts/verify-architecture-refactor.sh`, `scripts/test-academic.sh`, `scripts/test-supabase-http.sh`, `scripts/test-audit-log.sh`, `scripts/test-practice-equivalence-upgrade.sh` with default/`adaptive`/`performance`; browser performance/source/session/review/Tutor runners.

## Deployment and remaining work

0053 applied only to disposable local databases, after0052 in the full migration sequence. It creates additive objects without rewriting historical attempts or redefining old grading functions. Transactional DDL still needs normal lock/rollback planning. SQL does the history scan/aggregation server-side with a bounded response; production-scale timing, row volume and query plans remain PENDING. Unit pagination reflects a fresh snapshot per request, not a pinned export snapshot.

Production migration was authorized earlier but remains technically unavailable: current runtime still has only project URL/anon key, no administrative connection/connector or active DB network grant. Reconcile real schema/migration ledger before applying missing prerequisites. No production write, account change, migration, Edge deployment or main merge occurred in this package. Hosted Staging, actual production role checks and provider calibration remain PENDING; Vercel's known Python bundle-size issue is deferred.

Git push is available; GitHub API remains blocked by the unchanged allowlist, with the earlier escalation cancelled. No actual PR number is claimed. Prepared body `COURSE_PERFORMANCE_PR.md`; creation link only: https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-course-performance . This branch builds on the separate adaptive branch; compare against9d5a434 to review only performance, or merge/review the prerequisite first.

Next: trusted fine-grained topic/chapter metadata20, additional/free-form hybrid grading18 and remaining equivalence17, then the approved Sheets groups. Do not count this unit-level indicator as complete precise topic attribution or implement speculative mappings.
