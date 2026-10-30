# AI Practice engine verification — 2026-10-30

## Delivered scope and merge

The user authorized merge, migration and continued development. The completed review branch `90484439552a37de8cc2b7e007e03a214a5468fd` was normally merged into **main `902779e7d3f3fad1a22d341ff623a5fa1f22261a`**, pushed and verified with `git ls-remote`. Its tree equals the previously tested branch; no reset, force push or discarded files. New work is on **`feature/approved-practice-math-verification`** from that main, independently reviewable and not merged.

This advances **decision18** with one complete server-supported computation: first derivatives of real single-variable polynomials with bounded integer coefficients, in the existing multiple-choice practice/self-test flow. It also preserves delayed feedback21/22 and review23/39. Decision18 remains **partial**: free-form answers, integrals, rational functions, ODE/linear algebra, general symbolic equivalence and theoretical automatic grading are not claimed. No new engine, duplicate Tutor, module registration, math algorithm rewrite, Sheets or Vercel change.

## Trusted computation instead of trusting an AI key

The existing generation worker advertises the structured task only after the current user's `authorize_engine_compute('ast','derive')` check succeeds. The alternative proposal contains only task data and retrieved evidence IDs. It cannot supply a trusted correct index, prose prompt, solution, score or verification badge.

`src/services/practice-math/polynomialDerivative.ts` validates the task, constructs the existing canonical AST and delegates to **DerivativeEngine**, **PolynomialExtractor** and **ASTEvaluator**. It compares exact bounded integer coefficient vectors, not numeric samples. It validates four distinct normalized options and requires one exact match. It renders the question, options, term-by-term solution and final LaTeX answer from the same task and actual engine result, in Arabic or English. This binds the wording to the calculation; an unrelated model-written question cannot inherit a valid calculation badge.

Supported contract `polynomial-derivative-v1`:

- Variable `x` or `t`; one variable, real domain.
- Coefficient arrays are constant-first, degree0–8, input integers between−100 and100, option integers between−800 and800. Trailing zeros normalize; duplicate equivalent options reject.
- Four options; unsupported data, nonintegers, excessive sizes, extra fields, absent correct option or forged evidence fail closed without publishing a partially verified question.
- Zero and constant polynomials, negative coefficients and degree8 boundary cases are tested.
- Ordinary generated questions retain the prior unverified workflow. No mathematical meaning is inferred from arbitrary free text, LaTeX or documents. Trusted citations establish the retrieved source identity, not a guarantee that the model selected the most pedagogically relevant passage.

The server uses a **30KB generated ESM artifact** of that adapter and existing engine. `tools/build-practice-verifier.mjs` generates it using the repository's pinned Vite/esbuild dependency; `--check` compares it byte-for-byte with current source. The full verification script includes that drift check. There is no separately maintained copy of the algorithm and no Python deployment workaround. Tests execute both the typed source and actual server artifact. Regenerate when a dependency changes; review semantic changes and version the verifier contract when its guarantees change. Do not hand-edit generated code.

## Persistence, access and review

New additive **`0050_ai_practice_math_verification.sql`** adds nullable private verification metadata and a **service-only** publication RPC. It reuses0048 source validation, locking, fingerprint deduplication, owner/session guards and atomic publication. Current Calculus I policy/grants are checked in PostgreSQL before publication; policy and existing grant rows are locked. There is no browser-supplied proof or frontend-only authorization. A service key remains part of the trusted server boundary: PostgreSQL validates scope/contract, while the trusted worker computes the proof; it does not rerun the TypeScript algorithm inside SQL.

An existing question cannot be upgraded or have its answer overwritten through a retry, including a prior ordinary AI question. Concurrent same-position requests produce one row/revision. The metadata and question insert commit together; invalid evidence/source changes/withdrawal abort both. Private schema restrictions and forced RLS remain. No historical SQL or existing question data is rewritten.

Before practice confirmation or self-test submission, neither verification metadata nor score/solution is exposed. After release, a verified mathematical answer contributes0 or1. Unverified questions remain outside the denominator. Starting a review immediately suspends that question's score; pending automated/human review remains excluded. Human resolution or exclusion takes precedence over the original engine result, and existing mandatory review audit protects that decision. A failed provider call never promotes a suggestion to a verified answer. No official university grades or performance42 are changed.

Historical authorized session reads retain their saved computation result if a separate engine grant expires; new computation is denied. Section withdrawal/source revision guards still block protected history, consistent with0048. This is not an attempt to revoke previously learned information or guarantee tamper resistance against database owners.

## Verification evidence

| Check | Final result |
|---|---|
| Full Vitest | **2,244 passing /257 files**;27 new cases |
| Focused practice + adapter | **105 passing /11 files**, a subset |
| Python | **36 passing** |
| Academic PostgreSQL/RLS | **122 passing**, including10 new cases |
| Audit PostgreSQL | **39 passing +1 concurrent upgrade**, immutable student-number assertions pass |
| Native local Auth/JWT/PostgREST | **100 passing**, including6 new cases |
| Chromium | **21 passing**:4 new engine cases +17 existing practice/review/source/Tutor cases |
| TypeScript | Workspace and portable generation worker PASS |
| Architecture | Strict audits/boundaries,8 guard tests, generated-artifact drift check PASS |
| Production build | Local Vite PASS |

The HTTP tests execute the actual mathematical artifact and submit its output through native local GoTrue/JWT/PostgREST. They verify current engine policy, exceptional grants/revocation, no browser publication, source/section isolation, delayed scores, retry safety and review suspension. They do **not** execute a hosted Supabase Edge runtime or a real model provider. Browser tests run actual React/KaTeX at390/1280px with Arabic/English and light/dark themes; network replies are fixtures and the mathematical fixture comes from the real artifact. Unit worker provider responses are mocked.

Initial HTTP verification rejected three positive fixtures because newly signed-up users had no mathematics major/grant; the server correctly returned403. The fixture was corrected, not the policy. A new grant test initially called the legacy API with a null expiry; it correctly returned400. The test now uses the existing batch grant API that supports enrollment-lifetime grants, proves actual computation while granted, then proves denial after revocation. A browser assertion initially matched both the question count and score `1/1`; it now selects the assessment region explicitly. Final failures:0. Existing PDF.js Node, Vite chunk-size and Starlette/httpx warnings remain. Vercel Python size issue is known/deferred.

Commands: `scripts/verify-architecture-refactor.sh`, `scripts/test-academic.sh`, `scripts/test-audit-log.sh`, `scripts/test-supabase-http.sh`; browser regression runners `test-practice-sessions-browser.mjs`, `test-practice-review-browser.mjs`, `test-practice-sources-browser.mjs`, `test-ai-tutor-browser.mjs`. Run session browser again with `YHUB_PRACTICE_MATH=1` for the four additional engine cases. Run browsers after Docker test networking completes. Use AGENTS.md's prepared tool paths; no SQL runner accepts production targets.

## Files and deployment

- Added `src/services/practice-math/polynomialDerivative.ts` and tests; generated `_shared/tutor/polynomialVerifier.mjs` and type declaration; reproducible build/check tool.
- Updated existing `_shared/tutor/practice.ts`; no new Edge entry or credentials.
- Added0050 and SQL/HTTP tests. Updated existing session/review contracts, labels and controls to distinguish trusted mathematical results; reuse existing LaTeX and source components.
- Extended unit/browser regressions and the architecture verification script. Updated this report, PR body,71-decision progress and handoff.

Production migration remains **authorized but not performed**: current runtime has only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, no administrative `SUPABASE_DB_URL` or DB TCP grant. The saved environment draft requests that binding and GitHub API access but is not published. Securely add the database connection/actual permitted host and publish environment settings; never send credentials in chat. Reconcile the actual production migration ledger before applying missing SQL. Main now includes0049, but its production application is unverified.0050 is local-only, requires0048/0049, and needs schema deployment before the updated worker/UI. No production writes, Supabase deployment or user-account modifications occurred.

Hosted Staging, real provider structured-output quality/cost, deployed Edge/Deno packaging and role smoke tests remain **PENDING**. The old worker continues ordinary generation, but a new worker requires0050 before mathematical publication. An old UI may not recognize the new assessment state, so coordinate deployment of schema, worker and UI. Do not relabel old questions as verified.

Git push works; GitHub API remains blocked by enforced network policy. No actual PR number is claimed. Body: `PRACTICE_MATH_VERIFICATION_PR.md`; **creation link**: https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-practice-math-verification . This subsequent group remains unmerged. Next: free-form answer storage/verification and additional explicitly supported operations under18, then adaptive16/equivalence17/performance42. Decisions72–80 remain excluded.
