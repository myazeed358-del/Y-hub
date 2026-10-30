# AI Practice answer review — 2026-10-30

## Delivery and approved scope

The user authorized merging the completed work, migrating Supabase, then continuing development. The previously verified session branch `5c07883e5b0c2a37f5b75e1166a4bf9c8b4fd84f` was normally merged into main **`cc62fd4f9e247f5f221cf3b8c0b3a2f84892f12f`**. The merge tree equals the tested session tree and `git ls-remote` confirmed main. No reset, force push or discarded files.

Subsequent work is on **`feature/approved-practice-review`** from that main. It implements decisions **23/39** for the existing multiple-choice practice/self-test flow. Decision18 remains partial: this package does not implement free-form or engine-verified hybrid grading, adaptive difficulty16, semantic deduplication17, or weighted performance42. Recommendations72–80 remain excluded. The current student answer must be confirmed, or the self-test submitted, before review is possible.

## Implemented behavior

1. A student starts an independent automatic recheck of a released answer. The server supplies the original trusted question/evidence, without supplying the prior suggested key, student's choice or identity to the model.
2. The result records agreement, disagreement, uncertainty or unavailability. A model agreeing with itself is **not** proof: all outcomes remain excluded from the confirmed score.
3. After that attempt, the student may explicitly request a human review. The assigned course reviewer sees only these requested/resolved reviews, in server-paginated lists with localized names and immutable nine-digit numbers. Merely starting a recheck does not share the answer with the instructor.
4. The authorized reviewer selects a correct option or explicitly excludes an ambiguous/invalid question, supplies an explanation and confirms. Resolution uses a revision check, current assignment/role/enrollment checks, and mandatory audit in the same transaction. An identical lost-ack retry succeeds; a competing different decision conflicts. A resolved decision cannot subsequently be overwritten.
5. The student sees the human explanation, trusted citations and updated confirmed result. Pending/unverified answers and explicitly excluded questions are absent from both numerator and denominator. This is a practice review result, not an official university grade or performance42.

The existing Tutor route and source panel contain the controls. Arabic/English, RTL text with LTR math/numbers, the existing KaTeX renderer, protected source opening and mobile/theme styles are reused. No new module registration, duplicate Tutor, math algorithm, Sheets or Vercel change.

## Database and security contract

New additive **`0049_ai_practice_review.sql`** follows0048; historical migrations are untouched. `public.ai_practice_reviews` contains scoped metadata, while `practice_private.review_details` holds automatic/human answer explanations. Both use forced RLS and explicit grants. App roles cannot directly insert/update/delete reviews; the private schema is inaccessible to browsers. All new definer functions pin an empty search path and revoke default public execution.

- Student reads require own session and current section access. Draft/self-test keys are not released early. Current source versions must still match when reading or resolving protected content.
- Reviewer access requires current course management authorization, the student's continuing eligibility and an explicit requested/resolved review. Self-review is denied. Admin/Owner status alone grants no access to private student answers; an administrative reviewer must already have the existing assigned-course management entitlement. No new delegation or platform-wide content-reading permission is inferred.
- The existing authorization/session/source locks serialize with role revocation, enrollment withdrawal, course reassignment and source changes. Revision checks serialize conflicting decisions. A late automated response cannot overwrite a human result.
- Service-only context/publication RPCs accept actor identifiers solely from the authenticated Edge runtime. Browser RPCs derive identity from `auth.uid()`. The Edge request accepts only a review ID; client questions, citations, grades and actor arguments are rejected.
- Existing Tutor quota/concurrency leases apply. The provider call uses a fixed endpoint,25-second timeout,1,800 output-token limit,64KB response bound and at most six bounded trusted passages. Response fields and evidence IDs are validated; the model never chooses source titles/pages or writes a grade.
- Provider/configuration/invalid-response failure is recorded as **unavailable**, retaining the human-review path without claiming successful verification. Quota/concurrency rejection before provider execution leaves the request pending. Session/access/source validation runs again before publication; denial blocks persistence.
- Mandatory audit captures IDs, state, actor and affected-person metadata; it excludes question/answer/explanation content. Audit failure rolls back the private resolution and score as well as the metadata. Automated publication has a system actor; it does not impersonate the student. Existing Admin/Owner audit read scopes are preserved.
- A revoked-access response clears protected review UI and propagates from details to the enclosing session/queue. A conflict retains an unsaved human decision for explicit reload/review; it never blindly retries a stale revision.

Database owners/superusers remain outside application append-only protections. No claim is made to prevent screenshots, reverse already-delivered data, or retain rolled-back denied attempts using a transactional trigger.

## Verification evidence

| Check | Final result | Scope |
|---|---|---|
| Full Vitest | 2,217 passing /256 files | Includes32 new review cases |
| Focused practice regression | 78 passing /10 files | Subset of full suite; rerun after final UI revocation propagation |
| Python |36 passing | Existing server/math regression suite |
| Academic PostgreSQL |112 passing | Includes14 new real SQL/RLS/transaction tests |
| Audit PostgreSQL |39 passing +1 concurrent migration-upgrade test | Includes review metadata classification; immutable student-number assertions also pass |
| Native local Supabase services |94 passing | Includes6 new tests using real GoTrue login/JWT and PostgREST/RLS |
| Browser |17 passing |4 review +4 session +4 source +5 Tutor Chromium scenarios |
| Workspace TypeScript |PASS | Root and all artifact packages; final UI changes rechecked |
| Portable worker TypeScript |PASS | Shared review worker checked separately; no hosted Deno claim |
| Architecture/boundaries |PASS;8 guard tests | Existing strict audits, public feature boundaries and cycles |
| Production build |PASS | Local Vite build; not hosted deployment |

Reproducible commands: `scripts/verify-architecture-refactor.sh`, `scripts/test-academic.sh`, `scripts/test-audit-log.sh`, `scripts/test-supabase-http.sh`, and browser runners `test-practice-review-browser.mjs`, `test-practice-sessions-browser.mjs`, `test-practice-sources-browser.mjs`, `test-ai-tutor-browser.mjs`. Use the prepared pnpm/Python/Chromium paths described in AGENTS.md. Run browser tests after local Docker network lifecycle tests finish. Local runners accept no production target.

Tests cover denied direct/forged writes, actor/reviewer isolation, source changes and withdrawal, early-feedback prohibition, current roles, no self-review, bounded queue filtering, idempotency, conflicting concurrent resolutions, late automatic delivery, exclusions, audit rollback and protected-content redaction. Worker tests cover forged input/evidence, malformed replies, quota/provider failure and expired/revoked access. Browser tests execute actual UI/KaTeX at390/1280px in Arabic/English and both themes; their remote responses are intercepted fixtures. Provider responses in unit tests are mocked. **Neither proves a real hosted model call or deployed Supabase integration.**

Initial verification failures were corrected rather than hidden: a role-change SQL fixture restored the wrong original role and polluted subsequent tests; text matchers omitted the actual question-number prefix; Playwright's bare string option selection matched a one-based visible label instead of the zero-based value. The final test explicitly selects and asserts the value. Final failures:0. Existing PDF.js Node, Vite chunk-size and Starlette/httpx warnings remain; Vercel's Python size limitation is known/deferred.

An intermediate full run overlapped the final UI/test edit and reported one callback assertion failure (2,216 passing). The final focused run passed with the callback in place; the full suite was then restarted on the unchanged final source tree. Results above refer to the final run, not that intermediate mixed-version check.

## Files

- SQL: `supabase/migrations/0049_ai_practice_review.sql`.
- Worker: `_shared/tutor/practiceReview.ts`, `functions/ai-practice-recheck/index.ts`, `supabase/config.toml`.
- UI/contracts: `ai-generator/practice/review/{repository,copy,PracticeAssessment,ReviewDetailPanel,PracticeReviewQueue}`; composition in `PracticeSessionView.tsx` and `PracticeSourcesPanel.tsx`; citation-schema export in `sessionsRepository.ts`.
- Audit presentation: `audit-log/domain/{auditLog,copy}.ts`; domain-column coverage assertion updated.
- Tests: four review Vitest files, existing SessionView composition mock, SQL/HTTP `test_practice_review.py`, new review browser runner and existing session-browser assessment fixture.
- Documentation: this report/PR body,71-decision PROGRESS, architecture handoff/progress.

Paths above are under `artifacts/y-hub/src/features` or `artifacts/y-hub/supabase` as applicable; browser scripts are at repo root `scripts/`.

## Deployment status and remaining work

Production migration is **authorized but not performed**. Runtime inspection on2026-10-30 still exposes only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, with no administrative database binding or database TCP/network grant. The saved environment draft requests `SUPABASE_DB_URL` and GitHub API access but has not been activated. Securely supply the connection in environment settings, allow its actual database host, then review/save/publish the environment. Do not send credentials in chat. Once connected, reconcile the actual production migration ledger/schema before applying any missing migration; do not blindly replay0001–0049.

0049 was applied only in disposable local tests. Main already contains0048, but its production application is **not verified**. Deploy schema before dependent UI; deploy the new `ai-practice-recheck` entry only with explicit Edge deployment authorization and existing provider secrets/quota setup. No Edge deployment or production user/data mutation occurred. The feature's initial tables are empty; it does not backfill guessed grades. Stale-source sessions fail closed rather than silently using changed content.

Hosted Staging/provider/Deno, real deployed roles, representative load/cost, and production ledger/deployment verification are **PENDING**. No independent Staging was supplied. Git pushes work, but `api.github.com` remains absent from the enforced allowlist; the prior real API attempt returned GraphQL Forbidden. No new PR number is claimed. Body: `PRACTICE_REVIEW_PR.md`; creation link: https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-practice-review . This new branch remains independent and unmerged.

Next: supported-engine verification/free-form grading18, then adaptation16/equivalence17 and performance42, with PDF chapter metadata20 still pending. Reuse these session/source/review contracts; do not restart the legacy mock generator or completed packages.
