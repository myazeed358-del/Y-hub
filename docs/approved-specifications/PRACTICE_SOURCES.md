# AI Practice — trusted references and scope

Date: 2026-10-29. Branch: `feature/approved-practice-sources`.
Base: verified main `17fc2912d36b967191c28eda29aa13e070c46ba9`.

## Authorized merge and Supabase status

The user explicitly requested “merge, migrate, and continue development.” The previous verified lesson-completion branch `221cda3e38482911d92170139330a25f77485c06` was merged normally on an integration branch and pushed to main. `git ls-remote` confirmed `17fc2912d36b967191c28eda29aa13e070c46ba9`; its tree is identical to the tested feature tree. No force push, discarded work or extra worktree.

Production migrations are authorized but **not executed**. Runtime reinspection found only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, no administrative database binding, no SQL ledger access and no database TCP grant. Requested secure `SUPABASE_DB_URL` plus its hostname/network setup; do not send credentials in chat. Once available, inspect the actual ledger/schema and reconcile missing migrations before applying any SQL. Never replay the historical files blindly. New 0047 is subsequent development on an independent review branch.

## Implemented and decision status

This is the first prerequisite package for AI Practice decisions **15/20/40**, not a completed question-generation system. Existing RAG already has authenticated section-specific PDF/syllabus indexes and source revisions, but no primary-book/reference classification or multi-source/page scope. The old quiz generator remains an unused simulation; no fake questions or grades were connected to the UI.

Implemented inside the existing `ai-generator` feature and Tutor route:

- The current assigned instructor can classify existing PDF sources as primary book, additional reference or lecture. At most one primary book exists per section. Replacing it atomically demotes the previous primary to a reference; both changes are audited.
- Users choose the primary book, an individual ready source, or up to ten sources. Each PDF can use all indexed text or an explicit list/range of actual indexed physical PDF positions. Arabic and Persian digits and Arabic commas are supported. Printed book page numbering is not guessed.
- Multiple **verified indexed syllabus units** may narrow the scope. PDFs currently have no trustworthy chapter/topic mapping, so selecting a unit does not pretend to map arbitrary PDF headings/pages to that unit. This part of decision 20 remains pending.
- A server RPC selects bounded passages from the chosen sources, pages and units. Original source IDs, revisions, titles, page/unit metadata and text come from the existing trusted index. Source priority is primary book, additional reference, lecture, then syllabus; round-robin ranking preserves diversity across sources within the six-passage bound. Arabic text normalization reuses the existing retrieval helpers.
- The UI previews verified passages using the existing LaTeX renderer and existing authorized source opener. Changing scope clears old evidence. Empty results remain empty; there is no silent fallback to other materials or invented general knowledge.
- Arabic/English, light/dark, mobile/desktop, safe errors, stale-source conflicts, primary-selection conflicts, loading, empty results, lost-ack retry and cancellation on closing/account/role/course changes.

The selection is a preparation/preview workflow and does **not yet change the Tutor chat's existing single-source selector** or call an AI provider. Questions, adaptive difficulty, deduplication, delayed citations, grading/review and persisted practice sessions remain later work. Decision 15 advances from missing to partial; 20/40 remain partial. Overall: **24 complete locally, 20 partial, 27 missing, 0 repair** out of 71. Recommendations 72–80 excluded.

## New migration and contracts

Only additive `0047_ai_practice_sources.sql`; no historical SQL edited.

| Contract | Behavior |
|---|---|
| `ai_practice_references` | Source FK, section FK, classification, CAS revision; unique primary per section; required audit trigger |
| `set_ai_practice_reference` | Current owner's role/section/source validation, expected source generation, policy revision and previous primary ID; atomic primary replacement and idempotent identical retry |
| `get_ai_practice_sources` | Authorized catalog of up to 100 sources with current generations/statuses, actual indexed pages, verified units and management capability |
| `preview_ai_practice_sources` | 1–10 strict `{sourceId,revision,pages}` selections, up to 100 units, optional 1500-character query; returns at most six trusted chunks, at most 10,800 text characters, plus `hasMore` |

Reference tables force RLS and expose SELECT only to authenticated callers; direct client/anonymous/service-role writes are revoked. Read/preview functions are **SECURITY INVOKER**, preserving existing source/chunk/material/section RLS. The setter is SECURITY DEFINER with pinned empty search path, current-role and assigned-owner checks through `lock_managed_syllabus`, course serialization and a source lock. PUBLIC/anonymous/service-role EXECUTE is revoked for all new RPCs. Admin/Owner receive no new cross-owner knowledge access: the existing Tutor access model is retained.

Input cannot contain asserted evidence, title, actor, score or arbitrary extra fields. Foreign/unavailable sources and units are rejected; stale revisions/unready indexes return terminal `PT409`, not an automatic retried transaction. Requested pages must have current indexed text. Final passages are selected again server-side, never trusted from a browser preview. Future generation must call the trusted retrieval contract with the current authenticated caller, preserving quotas and post-provider access/revision revalidation already present in Tutor.

Mandatory audit failure rolls back the reference edit and any old-primary demotion. Audit UI filters include the new entity. Source/material deletion cascades the classification and retains its audit events. In-place indexing keeps classification; the historical material update trigger may recreate the source ID (including material URL/title changes), which clears the old classification and requires explicit reassignment. No title-based matching restores approval to a new source silently.

## Verification

| Verification | Result |
|---|---|
| Full `scripts/verify-architecture-refactor.sh` | **2152 Vitest / 248 files**, **36 Python**, **8 architecture guard tests**, full workspace TypeScript, architecture/math/module boundaries, production build PASS |
| New source UI/repository unit tests | **13 PASS** (subset of full Vitest) |
| `scripts/test-academic.sh` | **83 SQL/RLS tests PASS**, including 12 new source cases; immutable-number checks PASS |
| `scripts/test-audit-log.sh` | **39 audit tests + 1 concurrent upgrade PASS**, immutable-number checks PASS |
| `scripts/test-supabase-http.sh` | **82 native local Auth/JWT/PostgREST cases PASS**, including five new source cases |
| `scripts/test-practice-sources-browser.mjs` | **4 PASS**: Arabic/English, 390/1280px, light/dark, student/instructor |
| Existing `scripts/test-ai-tutor-browser.mjs` | **5 PASS**: existing chat, math, language, trusted citations, indexing controls and revoked-access behavior |

Final failures: **0**. Direct SQL tests use isolated PostgreSQL; HTTP tests use actual local GoTrue sessions/JWT/PostgREST, not mocked authorization. Browser tests use actual routes/React/CSS/KaTeX with remote responses intercepted; they do not prove hosted Supabase or AI-provider connectivity. Screenshots were reviewed locally.

Negative cases include unauthorized/foreign/admin knowledge access, withdrawal, stale instructor role, forbidden direct writes, fabricated source metadata, invalid/unindexed pages, duplicate sources, nonexistent units, changed/deleted/unreadable sources, lost acknowledgment, simultaneous primary choices, mandatory audit rollback and empty search results. Existing Tutor quota/provider/indexing regressions remain unchanged and passing.

Initial SQL execution caught a PL/pgSQL variable/table-alias ambiguity in preview retrieval (four tests failed); renaming the local source variable resolved it and all 83 cases passed. An initial browser run timed out waiting for the panel; adding failure diagnostics and rerunning passed all four scenarios without suppressing the selector check. No application cause was established for that initial timeout. Existing PDF.js Node-build, Vite chunk-size and Starlette/httpx warnings remain; Vercel Python bundle-size is deferred, untouched.

Local evidence logs: `/workspace/practice-sources-full.log`, `practice-sources-unit.log`, `practice-sources-sql2.log`, `practice-sources-audit.log`, `practice-sources-http.log`, `practice-sources-browser2.log`, `practice-sources-tutor-browser.log`. Logs/screenshots are disposable execution artifacts; test runners are committed.

## Files and next work

- New `src/features/ai-generator/practice/{PracticeSourcesPanel,sourcesRepository,sourcesCopy}` and two test files; composed into the existing `pages/AITutorPage.tsx`.
- Existing audit-log entity enum/copy and explicit audited-column coverage test updated.
- New 0047, new academic SQL test file, new native HTTP test file and browser runner.
- This report/PR body, approved-decision progress, architecture handoff/progress.

Next: server-owned practice sessions and question generation using this source contract (15–23/38–40), with per-question provenance and protected delayed answers, then hybrid grading/review and performance 42. Verified PDF chapter/topic mapping is still required for full decision 20. No new mathematical algorithms, module registrations, Quick Access cards, Sheets or Vercel changes.

Deployment requires 0047 before this new UI, after reconciling the real production migration ledger. No Edge Function deployment is needed for this package. Hosted Staging, production-scale query/lock timing, production application and real provider integration remain **PENDING**; do not call this production-ready. Keep new development separate from the already authorized/merged 27/41 package.

## Remote delivery and environment prerequisite

Remote checkpoint verified: `04e7d59b24cb0a4395f29d694e99e5b0e8e17598` on `feature/approved-practice-sources` (SQL `29eef1e`, UI `adfe086`). Actual Draft PR creation returned `Post "https://api.github.com/graphql": Forbidden`; no PR number confirmed. Review creation link, not an existing PR: https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-practice-sources . Main independently verified at `17fc2912d36b967191c28eda29aa13e070c46ba9`. This documentation follow-up records the previous remote checkpoint; Git/ls-remote establish its final SHA.

Environment inspection distinguished draft from runtime: the saved draft already allows `api.github.com` but the current enforced runtime does not. Added only a `SUPABASE_DB_URL` runtime-variable requirement, without a suggested/secret value; the configuration tool confirmed `status: saved`, `requires_publish: true`. Preserved existing scripts, repositories, network rules and bindings. User must securely enter the administrative connection, supply/allow its database hostname, then review/save and publish the environment. Draft persistence does not apply credentials/network settings or migrate production. Retry blocked operations after the runtime actually changes; do not repeat unchanged denied API calls or claim a PR/migration succeeded.
