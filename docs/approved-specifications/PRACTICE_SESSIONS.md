# AI Practice — saved sessions and incremental generation

Date: 2026-10-29. Branch: `feature/approved-practice-sessions`.
Base / authorized merge: `16bca9af290fcd3c8c446996b2de5e5964b15cf7` on main.

## What was merged and what remains separate

The user explicitly requested “merge, migrate, then continue development.” The completed source-scope branch `dfcbc2ed54921f951ffabb9382aae88f072d6714` was merged normally on an integration branch. The merged tree exactly matched that verified feature tree. A normal push and `git ls-remote` confirmed main at **16bca9af290fcd3c8c446996b2de5e5964b15cf7**. No force push, new worktree, lost changes or unrelated edits.

This subsequent session/generation package is on its own branch for review. Do not infer authorization to merge every subsequent change automatically. Recommendations 72–80 remain excluded.

Production migrations are authorized but **NOT executed**. Runtime inspection again found only the project URL and public anonymous key, no administrative PostgreSQL connection, database TCP grant or alternative Supabase SQL connector. `SUPABASE_DB_URL` was already requested in the saved environment draft; that draft is not the running configuration. Securely supply the administrative connection and allow its actual hostname, then review/save/publish the environment. Never send credentials in chat. Before applying anything, reconcile the real production migration ledger and schema with the repository. Do not blindly replay 0001–0048 or claim anonymous REST access can apply SQL.

The draft also already includes `api.github.com`, but current enforced runtime access still excludes it. The previous actual PR request failed with GraphQL Forbidden. No new PR number is claimed; retry when runtime configuration changes. Git pushes remain available through the existing platform Git proxy. PR body: [PRACTICE_SESSIONS_PR.md](PRACTICE_SESSIONS_PR.md).

## Working behavior

The existing Tutor route and source panel now support:

- Creating separate persistent sessions from the validated selected sources/pages/units, preserving all previous sessions. History is paged on the server, 20 rows at a time, scoped to the current account and section.
- Arabic/English explanation, manual easy/medium/hard difficulty, practice or self-test mode, 1–100 requested questions, and an explicit option to deliberately repeat older questions.
- An actual Edge handler generating **one multiple-choice question per request**, using the existing authenticated Tutor runtime, provider adapter pattern and shared user/platform/concurrency quotas. It does not invoke the old mock quiz generator.
- A six-passage retrieval window rotates through the selected scope as questions are requested. Each passage is at most 1800 characters; at most 20 previous prompts of 600 characters are sent as repetition hints. A fixed provider endpoint, bounded request/response, 25-second provider timeout and 2200-token completion limit are used. No automatic infinite retries or provider calls on page load.
- Actual source IDs/revisions/page positions/unit IDs are selected by the server. The model returns evidence IDs only; final persistence reconstructs title/text/page from the authorized index. Empty/unreadable/changed scope fails clearly, without invented references or a general-knowledge fallback.
- Exact normalized prompt duplicates are rejected across the account's section history; deliberate older repeats are allowed only when selected, while same-session repeats remain rejected. A section/account advisory lock closes the simultaneous-session duplicate race. This is **not** proof of mathematical or semantic equivalence detection.
- Autosave after a 750 ms choice debounce, explicit draft save, server revision checks and two-device conflict detection. A failed request retains the choice. Retry of an already applied identical choice, session creation, generation position or submission does not duplicate work.
- Local recovery stores only account/session-scoped question position, selected option and expected revision. It stores no question text, answer key, file, citation or token. Recovery is offered only after authenticated current-session retrieval and requires review before saving. Storage failure is visible. Unsaved choices block session switching/new-session creation; page-unload warning and local recovery protect an interrupted edit. Focus/reload rechecks the server for account synchronization; this is not real-time collaborative editing.
- The browser receives no suggestion key, explanation or question citation until confirming an answer in practice, or submitting the whole self-test. Draft saving alone reveals nothing. Submission is immutable and idempotent; incomplete generation cannot be submitted. Unanswered items stay unanswered.
- The same LaTeX renderer and protected source opener are reused. UI remains Arabic/English, RTL prose/LTR mathematics, light/dark and responsive. No duplicate Tutor application or central registration change.

The answer is visibly labelled an **AI suggestion**, not a verified calculation, official grade or instructor-approved answer. Matching a suggested option is deterministic; the suggestion's mathematical correctness is not established by that comparison. No performance aggregate or university grade is written.

## Migration and trust boundary

New additive **0048_ai_practice_sessions.sql** only. Historical migrations are unchanged.

| Storage / RPC | Boundary |
|---|---|
| `public.ai_practice_sessions` | Own-session SELECT via forced RLS + current Tutor access; no direct browser/service-role writes. Configuration, revision and timestamps only. |
| `practice_private.questions` | Unexposed schema, forced RLS, no application-role table/schema access. Stores immutable generated questions, private suggestions/evidence and guarded choices. |
| `create_ai_practice_session` | `auth.uid()` owner, current section access, existing strict source-scope contract, idempotent caller-generated UUID; no client prompt/key/evidence accepted. |
| `read_ai_practice_session` | Own account + current authorization/source-generation checks; projects only fields allowed by practice/self-test phase. |
| `list_ai_practice_sessions` | SECURITY INVOKER; own-row RLS, bounded offset and page size; no answers. |
| `retrieve_ai_practice_evidence` | SECURITY INVOKER; current own-session RLS, current source/page/unit validation, bounded rotating passage window. |
| `save_ai_practice_answer` | Current identity/scope, session-row lock, expected revision; explicit confirmation only for revealing practice feedback. |
| `submit_ai_practice_session` | Own session, all requested questions generated, expected revision; atomic immutable submission. |
| `ai_practice_generation_context` / `publish_ai_practice_question` | Execute granted only to service_role. Edge derives actor from verified `getUser()`, never the request body. Publisher rechecks access, source versions and all evidence inside the transaction. |

All definers use an empty pinned search path and explicit schema-qualified relations. Private helper execution is revoked from application roles. Mutations lock current section/user/enrollment state before session/source rows: a concurrent revocation either precedes and rejects the mutation or follows the already-authorized transaction. Subsequent requests are denied. The Edge also revalidates JWT and section access after the provider wait. Database owners/superusers and a compromised service-role server are outside the application-role protection boundary.

Question and citation snapshots stay stored when a source changes, but current content retrieval fails with 409 until a new session is created from current sources. They are not silently rebound to replacement material. History metadata remains available while the account still has section access. Course/account deletion cascades these private learning records according to existing account/course behavior; no new retention policy is invented.

Private answer drafts are deliberately not copied into Central Audit Log. The existing audited instructor reference-classification path remains unchanged. No new administrative review/grade-edit capability is introduced; future authorized human review must add its own audit contract.

## Verification

Final verification figures are recorded after the last complete run below. No remote production writes or external AI-provider calls were made.

| Verification | Final result |
|---|---|
| Complete `scripts/verify-architecture-refactor.sh` | **2185 Vitest / 252 files**, **36 Python**, **8 architecture guard cases**, full workspace TypeScript, strict architecture/math/module boundaries, production build **PASS** |
| Focused practice unit/UI/portable worker tests | **46 PASS** (subset of full Vitest) |
| Portable Edge handler TypeScript | Explicit `tsc --noEmit` for `_shared/tutor/practice.ts` and imported core **PASS**; hosted Deno runtime not exercised |
| `scripts/test-academic.sh` | **98 SQL/RLS PASS**, including **15 new session cases**, full 100-question storage/submission, and immutable-number checks |
| `scripts/test-audit-log.sh` | **39 audit + 1 concurrent migration upgrade PASS**, immutable-number checks |
| `scripts/test-supabase-http.sh` | **88 native local Auth/JWT/PostgREST PASS**, including **6 new session cases** |
| New session browser script | **4 PASS**, Arabic/English, 390/1280px, light/dark, practice/self-test, failed-save reload/recovery and revocation |
| Existing source / Tutor browser scripts | **4 + 5 PASS** |
| `git diff --check` | **PASS** |

Final failures: **0**. SQL/audit total: **138**; browser total: **13**. No tests disabled. The 100-question test validates real database storage/bounds/submission, not 100 real provider responses. Native HTTP used actual isolated GoTrue JWTs and PostgREST. Browser tests used real page/React/CSS/KaTeX with intercepted network responses; provider behavior used explicit fixtures. Browser screenshots were inspected.

Workspace logs: `/workspace/practice-sessions-verified.log`, `practice-sessions-sql-verified.log`, `practice-sessions-audit.log`, `practice-sessions-http-final.log`, `practice-sessions-browser-final.log`, `practice-sources-browser-regression.log`, `practice-tutor-browser-regression.log`, `practice-worker-types.log`. Logs are local artifacts, not required tracked application files.

Negative coverage includes forged actors/keys/evidence, cross-account and cross-section access, privileged browser roles without knowledge ownership, private PostgREST schema rejection, stale revisions, current-role withdrawal, concurrent generation/save, idempotent lost acknowledgements, transaction rollback on failed persistence, hidden draft answers, delayed self-test feedback, duplicate prompts, full 100-question bounds, pending local recovery and StrictMode effect cleanup.

The first HTTP negative test mistakenly queried the pre-existing public exam `questions` table rather than the private schema. It was corrected to request `Accept-Profile: practice_private`, which PostgREST rejects with 406; the final full native suite passed all 88 cases. Browser diagnostics identified `ERR_NETWORK_CHANGED` during concurrent Docker network creation/removal. Running browser verification after the isolated HTTP containers finished resolved the load failures; assertions were not weakened. Expected fixture 503/403 responses exercise connection failure/revocation; external fonts are intentionally intercepted.

A code review also caught an initial StrictMode cleanup race: an aborted initial read could block the replacement read. The new controller identity/abort checks and regression test cover both initial-effect invocations. Final tests use the corrected code. Existing PDF.js/Vite chunk-size/Python dependency deprecation warnings remain; the known Vercel Python bundle limitation stays deferred.

## Remaining work and deployment gates

- Real hosted Supabase migration-ledger/schema reconciliation, production/staging role smoke tests, hosted Edge runtime and real provider connectivity are **PENDING**. No Staging was supplied. The isolated PostgreSQL/GoTrue/PostgREST tests are real local authorization tests; browser/provider response fixtures are not proof of hosted integration or AI correctness.
- Deploy new `ai-practice-generate` only after reviewing/merging this group and applying 0048 in order. It needs the existing server-only Supabase/service-role/provider environment and allowed origins; no new browser secret. No Edge function was deployed by this work.
- Only multiple-choice practice is implemented here. Adaptive difficulty, equivalent-math deduplication, engine-verified/free-form hybrid grading, ambiguity/review workflow (18/23/39), performance weighting (42), trustworthy book chapter/topic mapping and general-knowledge fallback remain separate work. No mock grades are substituted for these.
- Repeated provider proposals may return a conflict; insufficient evidence may prevent generating the requested total. The UI offers an explicit next request, not an endless retry. Published sessions are bounded at 100; 100 provider-backed unique questions are not guaranteed.
- Source changes conservatively prevent reopening old question content. The stored history is preserved but a future content-retention policy may be needed before offering readable archived content after source withdrawal. No implicit permission restoration.
- The existing Tutor chat is still session-only and uses its existing single-source behavior; practice settings affect practice sessions only.

## Changed files

- `artifacts/y-hub/supabase/migrations/0048_ai_practice_sessions.sql`
- `artifacts/y-hub/supabase/functions/_shared/tutor/practice.ts`, `ai-practice-generate/index.ts`, `supabase/config.toml`
- Existing `src/features/ai-generator/practice/PracticeSourcesPanel.tsx` (composition only); new `PracticeSessions.tsx`, `PracticeSessionView.tsx`, `sessionsRepository.ts`, `sessionCopy.ts`, `answerRecovery.ts`
- Four new practice Vitest test files; new `supabase/tests/academic/test_practice_sessions.py` and `tests/integration/test_practice_sessions.py`; local HTTP harness accepts an optional validated schema profile for negative testing
- `scripts/test-practice-sessions-browser.mjs`
- This report, PR body, 71-decision progress table and architecture handoff/progress

No mathematical engine algorithm, Sheets code, historical SQL, theme, Vercel configuration or unrelated feature was modified.

## Remote checkpoint

Remote delivery checkpoint verified with `git ls-remote`: `e2a1aa0b9016230931e72e77462d5d525fd118b0` on `feature/approved-practice-sessions` (server commit7434e3c, UI583deff). Main remains16bca9a. No PR was created: the running API network policy remains unchanged/blocked; this is a **creation link**, not an existing PR: https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-practice-sessions . This documentation-only follow-up records the previous verified SHA; Git/ls-remote establish the final commit.
