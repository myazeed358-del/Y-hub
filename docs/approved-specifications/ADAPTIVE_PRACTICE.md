# AI Practice: adaptive requested difficulty — 2026-11-02

## Scope and checkpoint

This package implements approved decision16 in the existing AI Practice session workflow, on **feature/approved-adaptive-practice**, based on verified remote main **a31429b51abd67e9a276d9cded42b8c3b5d8ff4d**. The earlier all-branch reconciliation is complete; this new package is independently reviewable. No duplicate Tutor, registration list, math algorithm, historical migration, dependency, unrelated feature or global design change. Decisions72–80 are excluded.

Decision16 is complete locally for the supported practice workflow: manual easy/medium/hard remains available, with a fourth adaptive option. Adaptive generation uses trusted released performance within the actual section and selected study scope. This does not complete free-form grading18, general semantic equivalence17, PDF chapter mapping20 or weighted course performance42. Provider difficulty calibration and hosted deployment are not established by local success.

## Behavior and trust boundary

Before this package, difficulty was solely a manual prompt setting. New additive **0052_ai_practice_adaptive_difficulty.sql** extends the session constraint and existing generation/read RPCs:

- A stored scope identity canonicalizes source IDs and generations, physical page sets, syllabus unit IDs and trimmed/case-normalized query. UUID spelling and ordering do not split equivalent scopes. Histories never cross user or actual section boundaries, even for equally named courses. Different source generations, pages, units or queries do not mix. PDF chapter or semantic-topic equivalence is not inferred; the current source/unit selection defines the study topic.
- Only released scores from engine-verified questions or authorized human resolution are eligible. Human resolution takes precedence. Ordinary AI suggestions, drafts, unsubmitted self-tests, pending reviews and excluded answers never become adaptive performance data. The same rules are checked against the existing assessment contract.
- At most20 distinct exercises contribute; equivalent supported derivatives share the existing identity, other questions use the existing text fingerprint. The most recently answered eligible occurrence of each identity counts once. This prevents repeated identical exercises inflating the sample count, but does not claim semantic deduplication of arbitrary theory questions.
- Fewer than5 eligible exercises requests medium. With5 or more, accuracy below50% requests easy,50% to below80% medium, and80% or more hard. This is a versioned, deterministic teaching heuristic (`confirmed-scope-v1`), not an official grade or a validated measure of question difficulty.
- A private per-position plan is saved on the first authorized generation-context request, **before provider invocation**. Session locking serializes simultaneous requests. The saved plan survives a lost acknowledgement, provider failure, quota rejection or changed later results; retries for that position reuse it. Subsequent positions get a fresh plan from then-visible committed results. Review/answer commits concurrent with planning influence either that snapshot or a later position, never retroactively rewrite an issued plan.
- A question publication trigger requires the saved plan for adaptive sessions across both ordinary and math publishers. Mandatory plan persistence failure rolls back and prevents publication. Old manual questions and publishers remain valid; no historical questions, answers, reviews, revisions or scores are rewritten.
- The browser receives only its authorized question's requested level, reason and eligible sample count. It cannot provide a score/level to the generation endpoint, invoke the service-only context RPC, read the private plan store, or insert/update/delete plans. Existing current enrollment/role/source checks and protected feedback release remain in force. A role or enrollment withdrawal is rechecked before reading or publishing.
- The worker rejects invalid plan levels before quota reservation/provider calls. Existing request bounds, leases, quotas, source evidence, math authorization and generation artifact are unchanged. No automatic additional provider request was introduced.

The UI explains the policy in Arabic and English, displays requested level/reason per adaptive question, and preserves KaTeX, RTL text/LTR math, recovery, manual difficulty and delayed answer/source feedback. It explicitly calls this a *requested* level: the provider can produce an easier/harder question and requires separate calibration.

## Files

Application paths are relative to `artifacts/y-hub`:

- Added `supabase/migrations/0052_ai_practice_adaptive_difficulty.sql` (scope identity/index, private plan table/helpers/guard, three replaced RPC bodies).
- Updated `supabase/functions/_shared/tutor/practice.ts` (strict server-plan level check).
- Updated `src/features/ai-generator/practice/{PracticeSessions,PracticeSessionView}.tsx`, `sessionCopy.ts`, `sessionsRepository.ts` and their existing generation/UI tests.
- Added `supabase/tests/academic/test_practice_adaptive.py`, `supabase/tests/integration/test_practice_adaptive.py`, `supabase/tests/upgrade/practice_adaptive.py`.
- Extended root `scripts/test-practice-equivalence-upgrade.sh` with an explicit adaptive upgrade mode; existing default behavior retained. Extended `scripts/test-practice-sessions-browser.mjs` with an adaptive mode.
- Updated this report/PR body, the71-decision progress table and architecture handoff/progress.

## Verification

| Check | Result |
|---|---|
| Full Vitest | 2272 passed /258 files;12 new cases |
| Python engine/API regressions |36 passed |
| Academic PostgreSQL/RLS |153 passed, including18 new adaptive cases |
| Populated0051→0052 upgrade |1 passed; historical state preserved |
| Earlier0050→0051 upgrade regression |1 passed |
| Audit SQL/RLS + audit upgrade |39 +1 passed |
| Native local Auth/JWT/PostgREST |110 passed, including5 new adaptive cases |
| Chromium |25 passed:4 adaptive,4 manual,4 math,4 review,4 sources,5 Tutor |
| TypeScript | Workspace and portable generation worker PASS |
| Architecture/build | Strict architecture/math/module boundaries,8 guard tests, artifact drift and production build PASS |

The113 focused practice Vitest cases are a subset of2272. Academic cases exercise exact thresholds, minimum samples, released/self-test feedback, human-resolved theoretical questions, pending/excluded reviews, syllabus/page/source/actor/section isolation, duplicate exercises, the20-sample window, per-position adaptation, concurrent/lost-ack plan reuse, forged writes, mandatory failure rollback and access revocation. The populated upgrade compares existing sessions/questions/reviews byte-for-byte except the new derived scope column and verifies old manual publication/read/score behavior.

Native HTTP uses disposable local GoTrue-issued JWTs and PostgREST/RLS, plus the actual existing polynomial verifier artifact. It proves successful planning/publication, private feedback, role denial, HTTP409 without a plan, concurrent retry, page scope, exam release, withdrawal and expiry. No hosted or production writes occur. Chromium uses actual React/CSS/KaTeX with intercepted network fixtures; it does not prove provider or hosted Supabase connectivity.

Commands: `scripts/verify-architecture-refactor.sh`, `scripts/test-academic.sh`, `scripts/test-audit-log.sh`, `scripts/test-supabase-http.sh`, `scripts/test-practice-equivalence-upgrade.sh` both default and `adaptive`; portable worker TypeScript separately. Browser: `test-practice-sessions-browser.mjs` default, `YHUB_PRACTICE_MATH=1`, `YHUB_PRACTICE_ADAPTIVE=1`, plus source/review/Tutor runners. Final failing tests:0. Initial adaptive browser runs exposed an exact-label matcher and an assertion racing the creation request in the test harness; both were corrected by matching the existing label and waiting for rendered questions, without bypassing assertions. Existing PDF.js Node warning, Vite chunk-size warning and Starlette/httpx deprecation remain; tests are not disabled. Known Vercel Python bundle-size limitation remains deferred and was not investigated.

## Deployment and remaining limits

0052 was applied **only locally**, after0051. Production migration is previously authorized but unavailable: current managed runtime exposes only project URL/anon key, no administrative database connection/connector or active database network grant. No production schema/data writes, account edits or Edge deployments were performed. Reconcile the actual production ledger and prerequisite schema before applying any pending migration; never replay the historical directory blindly.

Adding the stored scope column rewrites/locks the session table; building the normal index and extending the constraint also need a controlled migration window. Inspect actual row volume, lock wait and query plans before rollout. The query reads only the indexed actor/section/scope history but aggregates/deduplicates that history before taking20 results; production-scale timing is **PENDING**, and this is not an unlimited-history performance guarantee. Plans are bounded by100 positions per session; no new provider call is added by planning. Privacy/retention stays with existing session ownership and deletion semantics.

Roll out schema before enabling the adaptive UI. The new UI accepts old responses without generation metadata for backward compatibility, but an older database cannot create adaptive sessions. Coordinate worker/UI/schema versions and test on isolated hosted Staging. Hosted Deno/Edge execution, provider quality/cost and difficulty calibration, real multi-device behavior, deployment sizing and production role smoke checks remain **PENDING**. Local Auth/RLS tests are real local integration, not proof of hosted deployment.

Git push remains available. GitHub API currently returns `Forbidden`; its hostname is outside the enforced allowlist. The subsequent escalated request was cancelled, so no PR number is claimed. PR body: `ADAPTIVE_PRACTICE_PR.md`. Creation link only: https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-adaptive-practice . Final commit SHA is verified through Git/ls-remote rather than self-referenced in its own commit.

Next independent group: free-form answer persistence/verification and supported operations18, general-equivalence gaps17, trusted chapter mapping20 and weighted performance42. Do not redo the completed source/session/review/equivalence/adaptive work.
