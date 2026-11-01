# AI Practice: bounded derivative equivalence — 2026-10-31

## Delivery and approved scope

The user authorized merging completed work, migrating and continuing. The previous verified branch commit `b8333e9596362d4d03ac9c9ad5f9dd5d2fc12a06` was normally merged and pushed to **main `ed784c012a01a4522dc2cf59602545c07c615126`**. `git ls-remote` confirmed the remote merge SHA; its tree is identical to the previously tested feature tree. No reset, force push, worktree or discarded files.

This subsequent package is on **`feature/approved-practice-equivalence`**, independently reviewable and not automatically merged. It advances **decision17**, using the trusted structured derivative contract delivered under18. Input identity is now known precisely; extending repetition checks here before free-form grading avoids introducing a speculative general-purpose algebra classifier. Decision17 remains partial: unsupported mathematics and theoretical paraphrases have no proven semantic equivalence detector, and histories remain scoped to the actual section rather than combining separate sections of an academic definition. Decisions72–80 are excluded.

## Problem and implementation

Before this change, the publisher compared normalized question text and sent only20 recent prompts to the model. A derivative repeated in another language, with a renamed variable or a changed additive constant could bypass that check. Two different sessions could admit equivalent tasks. Three new PostgreSQL regression cases failed against0050, while the122 existing academic cases passed.

New additive migration **`0051_ai_practice_equivalence.sql`**:

- Defines a private, immutable input-identity function for `polynomial-derivative-v1`, over the existing integer-coefficient, degree0–8, single-variable real-polynomial contract. It removes the additive constant, trailing zero coefficients and variable-name differences. Choice order, distractors and prose do not affect identity. Different nonconstant coefficients remain distinct. This is exact input normalization, not another differentiation algorithm or numerical sampling.
- Adds an indexed, generated private column derived from trusted verification metadata. No browser-supplied fingerprint is accepted. Unknown/unsupported historical contracts get no identity. Existing duplicate attempts, answers, citations and scores are retained; no retroactive penalty or deletion.
- Checks the full persisted history of the same actor and section under the **same transaction advisory lock** used by ordinary publication. This serializes equivalent proposals across sessions/devices. A rejected proposal leaves both question count and revision unchanged. A lost acknowledgement still returns success for the already stored position without replacing its question/key.
- Retains deliberate repeats from older sessions when the user explicitly selected that existing setting; repeated exercises within the same session remain rejected. Other students and sections neither block nor expose one another's histories.
- Adds at most20 previous structured inputs to the existing service-only generation context as bounded guidance. Correct answers, explanations, citations and private identities are not added to the public session response. The actual decision uses the indexed full history, not the model's judgement or the20-item guidance window.

The existing worker maps only the two allowlisted duplicate messages to a safe duplicate response. The existing UI handles that result without clearing the current session or misreporting a source/device conflict. It explains retry, broader sources and deliberate retraining in Arabic and English. There is no automatic additional provider request: a rejected proposal may consume the existing single request quota, and the user chooses whether to retry. Current session/enrollment/source/engine authorization, protected feedback release and review suspension are unchanged.

## Files

All application paths below are relative to `artifacts/y-hub`:

- Added `supabase/migrations/0051_ai_practice_equivalence.sql`.
- Updated `supabase/functions/_shared/tutor/{core,practice}.ts` (optional typed database error message, safe duplicate mapping and bounded model guidance).
- Updated `src/features/ai-generator/practice/{sessionsRepository,sessionCopy}.ts` and the two existing review panels' exhaustive error fallbacks.
- Added repository tests; expanded generation and session UI tests.
- Added isolated academic SQL, native Auth/JWT/HTTP and historical upgrade tests under `supabase/tests`.
- Added root `scripts/test-practice-equivalence-upgrade.sh`; expanded `scripts/test-practice-sessions-browser.mjs`.
- Updated decision progress, architecture handoff/progress and this report/PR body.

No math engine algorithms, historical migration files, dependencies, module registrations, Sheets, themes, global styling, Vercel or Python deployment configuration changed.

## Verification

| Check | Final result |
|---|---|
| Vitest, complete workspace app suite | **2259 passed /258 files**, including15 new cases |
| Python engine/API regression suite | **36 passed** |
| Isolated academic PostgreSQL/RLS | **134 passed**, including12 new equivalence cases |
| Historical practice upgrade0050→0051 | **1 passed**, real populated database |
| Audit SQL/RLS + concurrent audit upgrade | **39 +1 passed** |
| Native local GoTrue/JWT/PostgREST | **105 passed**, including5 new cases |
| Chromium | **21 passed**:4 engine/repeated-proposal,4 ordinary sessions,4 review,4 sources,5 Tutor |
| TypeScript | Workspace + portable generation worker **PASS** |
| Architecture | Strict audit, math/module boundaries,8 guard cases, artifact drift **PASS** |
| Production Vite build | **PASS** |

The101 focused practice Vitest cases are a subset of2259, not an additional total. Final failing tests:0. Existing PDF.js legacy Node warning, Vite chunk-size warning and Starlette/httpx deprecation remain. Browser logs intentionally include simulated403/409/503 responses and blocked external font requests; no uncaught page error or layout overflow. One regression runner initially lacked `YHUB_PLAYWRIGHT_MODULE`; setting the existing prepared Playwright path resolved startup without changing dependencies or assertions.

Commands: `scripts/verify-architecture-refactor.sh`, `scripts/test-academic.sh`, `scripts/test-audit-log.sh`, `scripts/test-supabase-http.sh`, `scripts/test-practice-equivalence-upgrade.sh`; shared worker checked separately with TypeScript. Browser runners: `test-practice-sessions-browser.mjs` (ordinary and `YHUB_PRACTICE_MATH=1`), `test-practice-review-browser.mjs`, `test-practice-sources-browser.mjs`, `test-ai-tutor-browser.mjs`. Run browser checks after Docker networking finishes.

The native HTTP tests execute the actual existing derivative artifact, obtain local GoTrue JWTs, and call PostgREST/RLS. They prove duplicate rejection, concurrent publication, explicit repeats, retry idempotency and current access checks without production writes. The new upgrade test creates duplicate0050 attempts and a confirmed answer before applying0051, then compares all historical rows byte-for-byte excluding the new derived column. It proves subsequent duplicate rejection and deliberate retraining.

Browser tests execute actual React/CSS/KaTeX at390/1280px in Arabic/English and light/dark themes with intercepted network fixtures. They are not proof of a hosted model or Edge deployment. Initial frontend verification caught a test matcher absent from this repository and an exhaustive error union used by review panels; both were corrected without suppressing checks.

## Deployment and remaining limits

**Production migration is authorized but NOT performed.** Current runtime inspection still shows only the ready `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; no administrative `SUPABASE_DB_URL`/database connector or database TCP grant. The saved environment draft is not active. Securely configure the administrative connection and its actual hostname, then save/publish the environment; do not send credentials in chat. Reconcile the real migration ledger/schema before applying missing migrations. Main now contains0050, but production application of0050 and preceding packages is unverified.

0051 was applied only in disposable local databases and requires0050. Adding a stored generated column rewrites existing rows and takes a table lock; plan a controlled migration window and inspect actual row volume/lock contention. The normal index is nonunique intentionally, because historical duplicates and deliberate repeats are valid. No production-scale migration timing is claimed. Coordinate schema, worker and UI rollout; an older worker can publish through the replaced database RPC, but will report a generic conflict instead of the new duplicate message.

No Edge function was deployed. Hosted Staging, deployed Deno/runtime, provider output quality/cost and production role smoke tests remain **PENDING**. The model may still suggest duplicates or unsupported unverified paraphrases; generation cannot promise unlimited unique questions. The input identity applies only to the explicitly supported derivative task. It does not compare arbitrary LaTeX, free-form solutions, integrals or theoretical answers, or infer equivalent tasks from ordinary model prose.

Git push works through the platform Git proxy; the current enforced network allowlist still excludes `api.github.com`. No PR number is claimed. Prepared body: `PRACTICE_EQUIVALENCE_PR.md`. This is a **creation link**, not an existing PR: https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-practice-equivalence . Git history and `ls-remote` establish the final branch SHA. Vercel's known Python size limitation remains deferred.

Next independent work: free-form answer persistence/verification and additional explicitly supported operations under18, adaptive difficulty16, weighted performance42 and trusted chapter metadata20. Do not rebuild completed source/session/review workflows or attach the legacy mock generator.
