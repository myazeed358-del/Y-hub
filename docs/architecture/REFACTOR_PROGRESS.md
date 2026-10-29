# AI Practice source scope checkpoint — 2026-10-29

Remote checkpoint verified: `04e7d59b24cb0a4395f29d694e99e5b0e8e17598` on `feature/approved-practice-sources` (SQL `29eef1e`, UI `adfe086`). Actual Draft PR creation returned `Post "https://api.github.com/graphql": Forbidden`; no PR number confirmed. Review creation link, not an existing PR: https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-practice-sources . Main independently verified at `17fc2912d36b967191c28eda29aa13e070c46ba9`. This documentation follow-up records the previous remote checkpoint; Git/ls-remote establish its final SHA.

Environment inspection distinguished draft from runtime: the saved draft already allows `api.github.com` but the current enforced runtime does not. Added only a `SUPABASE_DB_URL` runtime-variable requirement, without a suggested/secret value; the configuration tool confirmed `status: saved`, `requires_publish: true`. Preserved existing scripts, repositories, network rules and bindings. User must securely enter the administrative connection, supply/allow its database hostname, then review/save and publish the environment. Draft persistence does not apply credentials/network settings or migrate production. Retry blocked operations after the runtime actually changes; do not repeat unchanged denied API calls or claim a PR/migration succeeded.

Current branch `feature/approved-practice-sources`, based on verified main `17fc2912d36b967191c28eda29aa13e070c46ba9`. Read `docs/approved-specifications/PRACTICE_SOURCES.md` and PROGRESS. Do not redo completion27/41 or prior learning-path26.

User explicitly authorized merge, production migration and continued development. The completed27/41 branch `221cda3e38482911d92170139330a25f77485c06` was normally merged/pushed to main17fc291, verified by ls-remote; integration tree identical to tested branch. Production migrations are authorized but NOT performed: only project URL/public anonymous key exist, no administrative SQL binding/ledger or database TCP grant. Secure SUPABASE_DB_URL/hostname setup was requested asynchronously. Do not request secrets in chat or replay historical migrations without reconciling the real ledger. New0047 stays on this subsequent independent review branch.

Implemented the prerequisite source package for15/20/40: current assigned instructor selects primary/reference/lecture; one primary per section, current-role/source-version/CAS checks and audited atomic primary demotion. Student selects1–10 indexed sources, verified physical PDF pages or indexed syllabus units; bounded server-side preview with original metadata, Arabic text retrieval, current source generations and existing RLS. NewUI uses existing Tutor route, LaTeX renderer and protected opener. No model call or invented question/grade. Chat's existing single-source flow is unchanged. No PDF chapter/topic mapping is guessed. Existing material replacement recreates source identity and therefore requires explicit classification again.

New0047 only; historicalSQL/math/Sheets/Vercel unchanged. All checks PASS:2152Vitest/248files,36Python,8architecture guards,workspaceTS/boundaries/build;83academicSQL (12new);39audit+1concurrentupgrade;82native localAuth/JWT/PostgREST (5new);4new source browser+5existingTutor browser scenarios.13focused unit cases are a subset.0finalfailures. Earlier SQL variable-alias ambiguity was fixed and tested; initial browser timeout did not reproduce with diagnostic rerun. HostedStaging/production-ledger/deployment/provider validation remain PENDING. ExistingPDF.js/chunk/Starlette warnings; Vercel bundle issue deferred.

Progress24complete locally/20partial/27missing/0repair across71.15advances to partial;20/40 remain partial. Next: server-owned practice sessions and real incremental generation with per-question provenance/delayed answers (15–23/38–40), then hybrid grading/review and performance42. Reuse the trusted source contract; never accept preview text from the browser as evidence. Preserve existingTutor quotas and post-provider revalidation.72–80excluded. Check latest remote migration number before any newSQL. PR body PRACTICE_SOURCES_PR.md. Git/ls-remote establish final push; do not invent PR success or merge this new work without authorization.

## Preserved previous checkpoints

# Decisions 27/41 checkpoint — 2026-10-29

Remote delivery verified: `072f49311c4ae08e3ad497117a155398af7b0d8e` on `feature/approved-lesson-completion` (SQL `e30f896`, UI `012d655`). Actual Draft PR creation returned `Post "https://api.github.com/graphql": Forbidden`; no PR number was created/confirmed. The destination is absent from the enforced environment network allowlist. The committed PR body is ready; restore approved API access before creating it. Review-creation link (not an existing PR): https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-lesson-completion . This documentation-only follow-up records the previous verified SHA; Git/ls-remote establish the final delivery SHA. Main was independently rechecked at `00ff09f0d0fe47b89d3ea532716add0829a42454`.

Current branch `feature/approved-lesson-completion`, from verified remote main `00ff09f0d0fe47b89d3ea532716add0829a42454`. Read `docs/approved-specifications/LESSON_COMPLETION.md` and PROGRESS before resuming. Preserve this completed group; do not repeat earlier learning-path work.

The user explicitly authorized merging the latest completed work and production Supabase migration work. Decision 26's verified `b30c0a9cc80bf5104d5cd00367e94d8feb63f232` was normally merged and pushed to main `00ff09f0d0fe47b89d3ea532716add0829a42454`, verified using ls-remote. No force push. Migration work remains blocked by missing administrative SQL access and ledger, not missing user authorization: runtime exposes only project URL and anonymous key. Pending secure SUPABASE_DB_URL/network setup was requested; never ask for secrets in chat, blindly replay old SQL, or claim a production migration occurred. The new 0046 group stays on its independent review branch.

27/41 implemented: manual reversible per-topic student completion, all/any instructor-configured same-section submitted exam rules, reset to automatic, no inferred grades or opening-based completion. New additive0046 uses current role/enrollment/ownership, own-row RLS, guarded definer RPCs, CAS/advisory locking, idempotent lost-ack recovery and mandatory audit. UI reuses SyllabusPanel with bilingual responsive controls and LTR counts in RTL. No historicalSQL, math, Sheets or Vercel changes. Automatic activity support is real exam submissions; future AI Practice needs its own verified contract. Rule changes/publication affect current automatic evaluation; manual override remains explicit.

Final checks:2139Vitest/246files,36Python,8architecture guards,workspaceTS/audits/build;71academicSQL (16new),39auditSQL+1concurrentupgrade;77real localAuth/JWT/PostgREST;4fixtureChromium PASS.51focusedVitest are a subset.0finalfailures. HostedStaging, productionledger/deployment/role smoke tests remain PENDING. ExistingPDF.js/Vitechunk/Starlette warnings; VercelPythonissue deferred. Full evidence and earlier corrected test failures are in LESSON_COMPLETION.md.

Progress24complete/19partial/28missing/0repair across71 (local implementation, not production readiness). Next independent group:AI Practice15–23/38–40, thenperformance42. Recommendations72–80excluded. New migrations after0046 only after checking remote. Do not automatically merge new work. PR body:LESSON_COMPLETION_PR.md. GitHub API has been policy-restricted; report an actual creation result only. Git history/ls-remote establish the newest verified delivery SHA.

## Preserved previous checkpoints

# Decision26 checkpoint — 2026-10-28

Remote checkpoint verified with `git ls-remote`: `656d464f41664bd895c984c9c95825c1a28a1a60` (implementation `97e075f`). The actual Draft PR creation returned `Post "https://api.github.com/graphql": Forbidden`; no new PR number is confirmed. This follow-up documentation commit records the previous verified SHA. Git/ls-remote establish its final SHA. Review creation link (not an existing PR): https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-learning-path

Branch `feature/approved-learning-path`, based on remote main `7e57e9abb2015a0ba20936770dc12fb0ee7c54ef`. Decision24 was externally merged through PR44, including prior verified `2bd325762c4e551c53df2d4b10cbbf27ccc54b83`; do not recreate its PR or redo it. Read `docs/approved-specifications/LEARNING_PATH.md` and PROGRESS.

Decision26 implemented: existing legacy-home/legacy-course compose the public syllabus panel, bounded real section directory and current syllabus RPC. Student active enrollment/publishing and staff scope are enforced by existing database policies, verified over native local HTTP. Same-title sections remain separate by UUID. Opening topics writes no completion or grade. Fake37%, fixed learner/session, fabricated milestones and reference completion badges removed; independent fuzzy articles, routes, lab/quiz and mathematical algorithms preserved. No newSQL or production actions. Read-only reload denial hides stale syllabus; editor drafts are retained.

Verified2127Vitest/244files,36Python,8architecture guards,workspaceTS/audits/build;55academicSQL/RLS tests;74real localAuth/JWT/PostgREST tests;4fixtureChromium scenarios.68focused tests are a subset. HostedStaging/production-ledger verification PENDING. VercelPythonbundle issue remains deferred; existingPDF.js/chunk/Starlette warnings unchanged.

Progress22complete/19partial/30missing/0repair across71. This completes26 only, not27/41 or42. Next independent group: manual reversible completion and verified activities/instructor conditions27/41, thenAI Practice15–23/38–40 andperformance42. Start new migration numbering after0045 (check remote first). Never implement72–80 without separate authorization. Keep new work on independent review branches, no automatic main merge. Git/ls-remote establish final checkpoint; PR body LEARNING_PATH_PR.md.

## Preserved previous checkpoints

# Decision24 checkpoint — 2026-10-28

Remote implementation checkpoint verified with `git ls-remote`: `5f69031c33163307a70076a47b1e00531c345ac5` (SQL commit `dab015a`, UI/docs commit `5f69031`). Draft PR creation was actually attempted with the committed body and returned `Post "https://api.github.com/graphql": Forbidden`; no PR was created or confirmed. This documentation commit records the previous verified SHA; Git/ls-remote establish the final one. Main remains `79f0bdf3ee928db0055c52e8e4be7b304cf2458d`.

Branch `feature/approved-audit-person-search` from verified remote main `79f0bdf3ee928db0055c52e8e4be7b304cf2458d`. Main already contains the completed groups authorized for consolidation; do not merge this subsequent package automatically. Read `docs/approved-specifications/AUDIT_PERSON_SEARCH.md` and PROGRESS before resuming.

Decision24 implemented: scoped actor/affected/either search, suggestions, exact authorized count, localized names/nine-digit numbers and immutable companions in additive0045. Invoker RPCs inherit audit-event RLS; no widening to Student/Instructor (decision69 remains later). Required identity capture failure rolls back domain/event. Migration drains old trigger invocations with audited-table locks before replacement/backfill; real concurrent upgrade test passes. Legacy lookups are labelled and unavailable names/relationships are not invented. No historicalSQL/math/Sheets/Vercel modifications or production actions.

Verified2111Vitest/242files,36Python,8architecture guards,workspaceTS/audits/build;192PostgreSQL tests plus14legacyRLS assertions/immutable-number checks;70real localAuth/JWT/PostgREST tests;2fixtureChromium scenarios. Focused27Vitest/5HTTP reruns are subsets. HostedStaging, representative-load/backfill time and production-ledger verification remain PENDING. ExistingPDF.js/Vitechunk/Starlette warnings remain; VercelPythonissue deferred.

Progress:21complete,19partial,30missing,1repair across71;72–80excluded. Next independent group:26 legacy syllabus wiring, then27/41 server-enforced lesson completion, then the existing ordered plan. Do not restart the completed packages. PR API returned GraphQLForbidden; attempted elevated retry was cancelled, no PR number confirmed. Body is AUDIT_PERSON_SEARCH_PR.md; Git/ls-remote establish the final pushed checkpoint. Preserve all work and keep new features on independent review branches.

## Preserved previous checkpoints

# Authorized consolidation checkpoint — 2026-10-27

The user explicitly authorized merging completed work into main, then continuing development. Integration branch `integration/approved-work-20261027` is based on main `2bf1182d723c944562fce2ba93f813b1d8031ef8` (attendance reports already merged through PR40). It merges approved-engine-grants, approved-context-breadcrumbs, approved-bilingual-profiles, and the reviewed comment-only branch. No force push or production SQL/deployment is authorized. Read `docs/approved-specifications/MERGE_2026-10-27.md`.

Combined verification:2101Vitest/241files,36Python,8architecture guards,workspaceTS/audits/build,178SQL tests +14legacyRLS assertions,65actual localAuth/HTTP tests,12fixture browser cases PASS. Staging remains pending. Old phase3/API branches with superseded contracts must not reintroduce historical0031/0032 migrations. Preserve them as history.

Next: verify remote main contains this checkpoint, then implement decision24 on `feature/approved-audit-person-search` from that main. Completed decisions20/71; remaining priorities are unchanged. This merge authorization covers completed work; keep subsequent new features on independent review branches unless the user authorizes their merge. Do not repeat completed groups or apply SQL to production. Git/ls-remote establish final checkpoint SHA.

## Preserved previous checkpoints

# Approved decision25 — bilingual profiles verified (2026-10-26)

Current branch `feature/approved-bilingual-profiles`, independent from latest verified main `06cabec3b1fee1b5cfe6a9457d9dd914a3398155`. Implementation commits `62dc27a` (SQL/tests) and `1ccca7a` (UI/tests). Previous remote-verified checkpoint `f3f31c253e2fae043c66dd2c41def87d8b9c8577`; this delivery-note commit follows it and Git/ls-remote establish the final SHA. Draft PR creation actually returned `Post "https://api.github.com/graphql": Forbidden`; no PR number confirmed. Read `docs/approved-specifications/BILINGUAL_PROFILES.md` and `PROGRESS.md`; do not restart the earlier completed groups. Decision25 complete locally; cumulative20complete/20partial/30missing/1repair across71.72–80excluded.

New0044 adds required Arabic/English names for future signup and a locked, self-only, idempotent missing-name completion RPC. Legacy full_name/user_number/roles remain unchanged. Stored names cannot be replaced via completion; Auth metadata updates do not overwrite profiles. API conflict is PT409: actual HTTP tests proved40001 triggers unwanted PostgREST retries. No historicalSQL,math implementation,Sheets implementation or Vercel changes.

Verification:2048Vitest/237files,36Python,8guard tests,workspaceTS/audits/build,165directSQL tests +14historicalRLS assertions,58actual localGoTrue/JWT/PostgREST tests,3fixture browser scenarios PASS. Combined0042+0043+0044 snapshot58SQL PASS; no Git merge.39focused tests and reruns are subsets. See report for superseded failures and exact limits. CoordinatedSQL/client rollout required:old signup clients without both names will be rejected. Hosted Staging/SMTP/provider validation remains PENDING; no production write/deploy/migration or main merge.

Previous remote-verified branches: attendance reports `4456949caaf346f2b43e35c5da5e5555f308def0`, engine grants `6ffa7961eac416d3efc8c9281fa2a2d8e25a8c5c`, breadcrumbs `a47474ad27d5f96d44dea820b590fcbea407922b`. Their implementations are not included here; cumulative documents only. Next priority1:decision24 scoped audit actor/affected-person search, suggestions/counts and9digitnumbers, then priorities2–6 from the table. Do not conflate legacy names in old roster RPCs with new live translation support; those consumers safely retain full_name fallback until updated. GitHub API was restricted in previous groups; create Draft PR with BILINGUAL_PROFILES_PR.md if available and never invent a PR or merge.

## Preserved earlier checkpoint

# Approved decision32 — contextual navigation verified (2026-10-26)

Current branch `feature/approved-context-breadcrumbs` from latest verified main `06cabec3b1fee1b5cfe6a9457d9dd914a3398155`. Implementation commit `03674bd`; previous remote-verified documentation checkpoint `1c354d9a43827fa7716ab3747ce69c28121b108e`. The following delivery note records it; Git/ls-remote establishes the final SHA. Draft PR creation returned `Post "https://api.github.com/graphql": Forbidden`; no PR number confirmed. Read `docs/approved-specifications/CONTEXT_BREADCRUMBS.md` and `PROGRESS.md`. Decision32 complete;19complete/20partial/31missing/1repair cumulatively across main and three independent review branches. Do not restart completed attendance/grant work or claim all71 complete.72–80 remain excluded.

Preserved and remote-verified:attendance reports `4456949caaf346f2b43e35c5da5e5555f308def0`, engine grants `6ffa7961eac416d3efc8c9281fa2a2d8e25a8c5c`. Their implementation is not included here, only their reports/table evidence. Main externally merged PR37/38; no agent merge.

This package: contextual guarded APIv2 ancestor discovery, known core parent links, roots hidden, bilingual responsive accessible breadcrumb and retained page title. No SQL or backend changes.2049Vitest/236files,36Python,8guard tests,workspaceTS/audits/build,4fixture browser scenarios PASS.291focused tests are a subset. Hosted Staging remains PENDING; no production writes/migration/deploy/main merge. Vercel issue deferred.

Next priority1:decisions25 (Arabic/English profile names, signup and old-profile completion with SQL enforcement) and24 (scoped actor/affected-person audit search and9digitnumbers). Their current full_name-only implementation has been inspected but NOT changed. Reserve new SQL numbering after independent0042/0043; do not edit historical migrations. Then follow the cumulative table dependencies. GitHub GraphQL API is policy-restricted; create Draft PR using the committed description when access permits, never invent a PR number.

## Preserved earlier checkpoint

# Approved specifications — engine grant workflows (2026-10-25)

Current branch: `feature/approved-engine-grants`, from main `06cabec3b1fee1b5cfe6a9457d9dd914a3398155`. Read `docs/approved-specifications/ENGINE_GRANTS.md` and `PROGRESS.md` before resuming. Decisions11–14/34 implemented; do not recreate the old grants page or repeat completed attendance work.

Independent attendance-report branch is verified on remote at `4456949caaf346f2b43e35c5da5e5555f308def0`, contains0042, and is not merged by this task. Its reports/screenshots are copied for continuity only. This grant branch contains0043 (independent of0042): scoped directory/history, atomic batch grant, real nullable enrollment lifetime, trusted revocation causes and compatible legacy API. Parent-before-child revoke locking is tested with concurrent assignment. Existing algorithms, Quick Access and student numbers remain unchanged.

Verified2036 Vitest/236files,24 targeted subset,36 Python,8 architecture guards,workspace TS/audits/build;52 SQL university tests;57 real local Auth/JWT/PostgREST tests;3 fixture-backed Chromium scenarios. Combined SQL0042+0043 snapshot:58 university +44 academic tests pass. The71-row table is cumulative:18 complete,20 partial,31 missing,2 need repair; not production readiness. Hosted Staging/load/production ledger remain PENDING. No production migration, Edge deploy or main merge performed.72–80 remain unauthorized.

Previous verified remote group is attendance4456949 above; Grant implementation/docs verified on remote at `13104c11cd1efb17533ec4070acc47c10c02fc12`. The following documentation commit records it; Git/ls-remote establishes the latest checkpoint. Git push works, GitHub GraphQL PR API has repeatedly returned Forbidden; do not invent a PR. Body: ENGINE_GRANTS_PR.md. Next: priority1 decisions25/24/32, then learning/practice and subsequent dependencies. Keep independent branches;0044 is the next migration number unless remote changes first.

## Preserved earlier checkpoint

# Approved specifications — attendance reports checkpoint (2026-10-25)

Current branch: `feature/approved-attendance-reports`, from main `06cabec3b1fee1b5cfe6a9457d9dd914a3398155`. PR37/38 were merged externally since the preceding checkpoint; do not repeat them or create replacement PRs. Read `docs/approved-specifications/ATTENDANCE_REPORTS.md` and `PROGRESS.md`.

Implemented decisions7/33: six role-scoped tabs, server-filtered statistics/trend, Excel/native print-to-PDF plus preserved CSV, safe bounded consistent exports. New0042 only. Verified2046 Vitest/237files,36 Python,8 architecture guards,workspace TS/audits/build,51 university SQL tests,56 real local Auth/HTTP cases,2 Chromium fixture scenarios and generated PDF text. Initial six SQL tests failed before the RPC; they pass after it. Old HTTP excused-write expectation updated to prove its rejection under approved0040, retaining audit rollback checks.

Previous verified remote checkpoint before this group: academic `b02d32016d6943153db470fd89fb2126cf8964c0` (now merged through PR38). Git and ls-remote establish this group's final SHA. Progress now13 complete,23 partial,33 missing,2 need repair. Staging/load/provider/production ledger remain PENDING; no production migration, deploy or main merge performed. PR body: ATTENDANCE_REPORTS_PR.md. Verified this group on remote at `0294fd93f9ba6915996ef3611240ec211c6684ed`. Draft PR creation returned GraphQL Forbidden again; no PR number confirmed. The following documentation checkpoint records that SHA; never invent review creation.

Next independent group: engine grants/search/student numbers11–14/34, then24/25/32. Preserve Quick Access and algorithms, no72–80 implementation. Keep this group separate from subsequent branches and reserve0042; next migration number0043 unless remote changes first.

## Historical checkpoints (preserved)

# Approved specifications — academic integration checkpoint (2026-10-25)

Current branch: `feature/approved-academic-integration`, based on verified latest main `b41b44875d9febc531a16c1eaa1e1f343593cc3a`. Read `docs/approved-specifications/ACADEMIC_INTEGRATION.md` and `PROGRESS.md` first. Do not restart Tutor/Y-Sheets or historical phases below.

Previous verified remote checkpoint: `5941f4b640e98c8d298dae48c628062579d5cae4` (implementation). The following documentation commit records it; Git/ls-remote establishes the latest SHA. Decision1 completed; missing Phase3 academic contracts reconciled in new0041 without historical SQL or Y-Sheets function changes. The71-row table is cumulative across independent, unmerged review branches:11 complete,24 partial,34 missing,2 need repair.72–80 not authorized or implemented.

Preserved attendance branch `feature/approved-attendance-lifecycle` at `3c718931810ce8dbbcb4504e08001a1b967610c8` contains0040 and prior completed attendance work; this branch is based directly on main and does not include0040. Its historical report is copied only for continuity. Do not mistake composite progress for one branch's contents or production deployment.

Verification:2018 Vitest/234files;146 targeted subset after final Arabic accessibility edits;36 Python;8 architectural guards;workspace TS/audits/build;44 isolated academic SQL;48 actual local GoTrue JWT/PostgREST/SQL tests;3 fixture-backed Chromium scenarios. Combined SQL snapshot0040+0041:44 academic +45 university tests PASS. Local student-number immutability assertion passed. No production write/migration/deploy/main merge. Hosted Staging, real Storage/Edge/provider integration remain PENDING. Known Vercel Python issue remains deferred.

Git push works; Draft PR creation currently returns GitHub GraphQL Forbidden. No PR number is confirmed; body ready in `docs/approved-specifications/ACADEMIC_PR.md`. Complete review creation when API access is available; never invent a PR. Next implementation priorities:attendance reports/tabs7/33, grants/search/numbers11–14/34, then24/25/32. Review both branches and reconcile AttendancePage changes before any user-approved merge; do not reapply old0032 over0037.

## Historical checkpoints (preserved)

# AI Tutor math/Arabic follow-up — verified locally (2026-10-24)

Current branch remains `feature/ai-tutor-rag`. Read `docs/ai-tutor/MATH_ARABIC.md`; do not repeat Phase 1. Implementation pushed and verified by `git ls-remote`: `64a3b8d7899cefb3e2d9735079fe3cfd6178077f`. The following delivery-note commit records that previous verified checkpoint; Git/ls-remote establishes the final documentation SHA. Added robust delimiter handling, scoped LTR math/RTL prose, language selection, step-by-step/JSON-escaping prompt, and new 0039 Arabic retrieval normalization. RAG/citations/permissions/math engines preserved.

Verification:1994 Vitest/229 files (99 Tutor),36 Python,8 architecture guards,workspace TS/audits/build,Edge Deno checks,20 native local Tutor Auth/SQL cases and5 Chromium scenarios PASS. Browser/Arabic model responses use controlled fixtures; actual provider/hosted deployment remain PENDING. No production migration/Edge deploy or main merge authorized/performed. Implementation delivery is complete. Next: approved isolated hosted/provider validation and deployment review; do not repeat implementation or create a duplicate Tutor. See the detailed report and screenshots. Prior Phase 1 checkpoints below remain historical.

# AI Tutor Phase 1 — local implementation verified (2026-10-24)

Current branch: `feature/ai-tutor-rag`, based on latest verified main `0405670e41624905c9829667fbf3927485286e8c`. Preserve all previous Y-Sheets/university work. Read `docs/ai-tutor/PHASE1.md` and `VERIFICATION.md`; do not resume the historical tasks below.

Implemented server-owned per-section PDF/syllabus indexing, RLS, source-generation invalidation, trusted citations, optional semantic plus text retrieval, current-role/enrollment checks, quota/concurrency bounds and the existing Tutor UI. New 0038 only; no production SQL, Edge deployment or main merge. Phase 2/3 not started. Final local results:1963 Vitest/227 files (68 Tutor),36 Python,8 architecture guards,all workspace TS/audits/build;18 native local Auth/HTTP/database cases plus134 existing SQL cases;4 real PDF Deno tests;3 Chromium scenarios. See verification for exact scopes and pending hosted/provider evidence.

Previous verified remote checkpoint: `ff378cf7f975af337dcea8256e3435689c797b5f` on `feature/ai-tutor-rag`; code commit `a95dcd9`. The final documentation-only delivery commit follows it; Git/ls-remote establish its SHA. Push succeeded. Actual Draft PR creation returned GraphQL Forbidden: no PR exists from this attempt. Next: restore approved GitHub API access and create the Draft PR with docs/ai-tutor/PR_DESCRIPTION.md, then authorized isolated hosted deployment/provider validation. Never invent a PR or treat mock provider/browser tests as live Supabase/LLM connectivity. No production or main action is authorized for this task. Supabase ledger and real Groq/embeddings/Storage/Edge integration remain PENDING.

## Prior checkpoints (preserved)

# Y-Sheets PR #35 — final local review complete (2026-10-24)

Current branch: `feature/y-sheets-ui-refresh`. Read `docs/y-sheets/FINAL_UI_REVIEW.md` before continuing; do not restart historical university work below. Latest main `80fab4b8a026f508f63bdbcc7edb09da0cf6a622` was safely merged in `22e7ed3`. Previous verified remote checkpoint: `251b44b58711fd653725aaa3d97595f0bf96637e`, matched by both branch and PR #35 head after the push (original head `ba5c4a3fe5dbda867996fc0653f53dbd76e76bd9`). Git history and `ls-remote` establish the final delivery-note commit.

Fixed proven clipboard data loss, stale file search, Ribbon/import accessibility and state, filter toggle, duplicate SVG IDs, dark CSS and vacuous CSS tests. New scoped 0037 fixes PostgREST retries of terminal workbook conflicts; no production application. Final results: 1899 Vitest /219 files (139 focused),36 Python,8 architecture guards,all workspace TS/audits/build,10 PostgreSQL +14 historical assertions,5 native local Auth/HTTP tests,16 fullscreen browser combinations,4 complete file workflows and editor/Excel worker PASS.

Branch/PR push is complete and verified. Next: complete PR #35 description/readiness/required-check review and authorized merge when GitHub API access is restored. The user explicitly authorized merge for this task only, but do not bypass checks/protection or directly push main. API requests return Forbidden; public page shows Draft. Required new 0037 is local-only: no privileged connection/ledger access or isolated hosted test accounts are configured. Preserve production data; do not replay 0023/0024 or push unrelated migrations. Hosted tests, migration and merge remain pending. Full evidence, changed files and proposed PR body are in docs/y-sheets. Historical instructions below are superseded.

## Earlier checkpoints (preserved)

# University features — grant UI follow-up verified (2026-10-23)

Current branch feature/exceptional-engine-access fixes initial directory retry and adds server-paged grant history; four added regressions. Full verification:1869 Vitest/214 files,36 Python,eight architecture guards,workspace TypeScript/audits/build PASS. Previous verified remote SHA:db0ae2d7b57efee2ed85621d8a3e9f2488abda02; Git/ls-remote establishes the new commit.

All five requested university features are already implemented and pushed on their focused branches. Do NOT repeat the historical NEXT instructions below. Next: update the pinned engine UI overlay on test/university-integration, rerun final combined verification, document full dependency audit and final branch hashes, push integration evidence and attempt Draft PR delivery. GitHub API is blocked by proxy403 while Git push works. Hosted staging/live media deployment remain PENDING; no production writes or main merge.

## Historical checkpoints

# University features — phase 1 verified (2026-10-22)

Current task is the university feature request, not a repeat of Phase 3. Read `docs/university/ENGINE_ACCESS.md`. Branch `feature/exceptional-engine-access` independently based on verified main `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136`; Phase 3 heads remain preserved and unmerged. New 0033 + grant UI/API/backend guards complete. Full phase verification: 1865 Vitest /214 files, 36 Python, 102 PostgreSQL, eight architecture guards, two export tests, all TS/audits/build PASS. Git/remote establishes newest checkpoint. No production operations/main merge.

NEXT: create `feature/student-quick-access` from this verified feature branch (explicit dependency on server module policies), enhance the EXISTING StudentDashboardSidebar card with account preferences/CAS/0–3 tools and sync. Then implement Y-Attendance, Online Lectures and Owner labels on focused branches; full tests after each phase. Continue automatically, do not stop at this checkpoint. Do not repeat completed Phase 3 or grant functionality. GitHub API still previously blocked; Git push works. Hosted staging unavailable; mark pending. Vercel Python size issue remains deferred.

# University features — Owner labels verified (2026-10-23)

Independent `feature/owner-display-name` from main8a5dde1; display-only Owner labels preserve internal super_admin.1855 Vitest/211 files,29 Python,91 PostgreSQL,workspace TS,audits/build PASS. Previous verified remote online branch09168c2f0229e27952180be33a0d5cf47a0789e9; attendancec1a4bd2; Quick Accessf862ae29; enginedb0ae2d. NEXT: combined Phase3+university export/native Auth integration, no main merge. Prepared HTTP additions in /tmp/university-http-additions.py; preserve/review. Continue automatically. PR API Forbidden; branch pushes verified. Production/staging/media pending. Older NEXT below superseded.

# Phase 2 — final verified checkpoint (2026-10-20)

Implementation is complete locally; see `docs/phase2/FINAL_REPORT.md` and `CHANGED_FILES.md`. Do not restart completed work. Current branch `feature/syllabus-academic-permissions` is stacked on B `99852b5f006a94b0f021619bc6ad2c622f96f56b`; A is independent at `39dd464dc67b29ccf5b03eca5651213cd93ca13e`. Previous verified remote C checkpoint: `61236700cca3dcb7d9d8d1705e363556327bf2be`. The final commit adds the proven demoted-owner question/result read-policy fix in new 0028, its regression and final evidence; use Git/ls-remote for the newest hash.

Combined A+C source verification passed: **1855 Vitest /211 files, 29 Python, eight boundary guard tests, all workspace TypeScript, architecture/math/module audits and production build**, both Chromium scripts including 16 fullscreen geometry cases. The subsequent change is SQL-only: **91 PostgreSQL tests** freshly passed (30 academic +26 audit +16 exams +9 course deletion +10 Y-Sheets), plus historical SQL assertions. Before the final fix the new regression exposed one answer-key row and one other-student result after owner demotion; both are now hidden while legitimate reads remain.

Next exact step: complete blocked Draft PR delivery when GitHub API access is available, then isolated Supabase staging/release review. Three Draft PR creation attempts returned GraphQL Forbidden; **no new PRs were created**. Native Git push/remote verification works. Desired bases: A/B → main, C → academic branch. Main remains `b86dc4266c7a24209b4638c10e529415f82666a3`. No production writes/migrations, automatic merge, historical migration/math/dependency changes or relaxed checks. Production 0025/0026 ledger UNKNOWN; staging and CI/Vercel PENDING; not production-ready. Existing old instructions below are historical.

# Phase 2 — fullscreen application shell

Branch `feature/fullscreen-application-shell`, based on main `b86dc42` after PRs #19–#22. Implementation and local verification complete; see `docs/phase2/FULLSCREEN.md`. Preserve this independent branch while academic work starts from main. No production migration or automatic merge. Staging PENDING. Git history/ls-remote establish the final pushed checkpoint. Older instructions below are historical.

# Phase 2 — academic model checkpoint

Independent branch `feature/academic-course-sections` from main `b86dc42`. 0027 and compatibility/RLS tests complete; see `docs/phase2/ACADEMIC_MODEL.md`. Fullscreen is separately pushed at `39dd464dc67b29ccf5b03eca5651213cd93ca13e`. Next: dependent syllabus/permissions branch, without automatic merge. Production writes forbidden; staging PENDING. Older instructions below are historical.

## Current focused work: Phase 1 production safety

Independent exam, course deletion and dependency security branches preserve the existing Plug-and-Play/math boundaries. Y-Sheets PR #18 was already merged and has been reverified with additional role-isolation SQL coverage. Full verification evidence, branch checkpoints, unresolved dependency/deployment findings and staging PENDING gates are in `docs/production-safety/FINAL_REPORT.md`. No production migration or automatic merge was performed. The older completed architectural-refactoring history below is retained, not restarted.

# DELETE result follow-up

1674 Vitest tests / 186 files (76.27s), 29 Python tests (1.271s), 26 isolated PostgreSQL tests (26.578s) plus immutable user-number SQL checks, eight boundary-check tests, workspace TypeScript, all architecture audits and production build (44.12s) passed. Both complete scripts exited 0; no failed/skipped tests in final runs.

Exam/question handlers require the actual returned deleted ID. No migration changes; existing Draft PR #16 only. Deployment failure for 3c205833 is confirmed but its logs are inaccessible. See `docs/audit-log/DELETE_RESULT_REVIEW.md`.

## Previous checkpoint

# PR #16 security follow-up — current checkpoint

Resumed `feature/central-audit-log` from verified local/remote/PR head `08ee5375dee6db0d8de785d499a4cd0dab609716`. Four focused corrections: role-revocation authorization for child content, event coverage for identity/time mutations, free-text value redaction, and database-error handling for exam/question deletion. Nine additional SQL cases passed (25 total plus user-number SQL checks); six frontend cases added. Full verification after handler changes passed: 1670 Vitest tests / 186 files, 29 Python tests, eight boundary-check tests, workspace TypeScript, architectural audits and production build. Review findings, negative controls and staging gate: `docs/audit-log/SECURITY_REVIEW.md`.

PR #16 already exists; prior documentation about creating a PR is historical. Do not create another PR or merge. API access remains Forbidden; use branch push to update code and retry only PR #16 metadata editing when access is available.

## Historical initial implementation progress

# Central audit log — current feature task

Started from main `9057222` on `feature/central-audit-log`. Prior architecture classification is already merged. Added transactional database audit/notification-intent stores, actor locks, privacy allowlists, read isolation and a bounded search RPC; migration 0022 does not alter historical migrations. Added real disposable PostgreSQL tests (16 passed, plus user-number SQL regression) and the API-2 audit UI (103 focused tests passed). Full checks passed: 185 Vitest files / 1664 tests, 29 Python tests, eight architecture-check tests, complete workspace TypeScript, architecture audits and production build. Database and UI packages pushed; final implementation remotely verified at `79cb47badef2e88be072f9740f3a58fc85dd470f`. A final documentation checkpoint records that evidence. Draft PR creation was attempted and blocked by `Forbidden` from GitHub GraphQL; no PR was created. Prepared description and retry command are in `docs/audit-log/`. See `docs/audit-log/ARCHITECTURE.md`.

## Historical architecture progress

# Refactor progress

## Focused classification update — PR #15

Implementation: API-2 module kinds/categories and explicit sidebar destinations; engine-only catalog/search/tooltip metadata; generic navigation/dashboard contributions retained. Seven existing engines, including Fuzzy Logic Lab, retain their routes, labels, icons, ordering and access policies. The disabled discovery example is now explicitly an application. Four test-only fixture types demonstrate glob discovery and host integration; no new product is introduced.

Final verification: the recovered full run and fresh resumed run both passed. Latest: **183 Vitest files / 1645 tests** (73.40s), **29 Python tests** (0.898s), **eight boundary-check tests**, root and all three artifact TypeScript checks, three architecture audits, production build (42.49s), and git diff --check. Existing compatibility tests and 23 added classification/integration cases passed. No detected regressions or reported test skips. Source changes are confined to module contracts/manifests, their consumers, two new section translations and tests. The known Vercel Python bundle-size limit is outside scope and was not investigated.

Existing branch and PR #15 head were both confirmed at `c7a2f1fa59ceba53a70cf4b00125aad590259edb` before edits. Verified source commit `fb41c56310947cf3092339c0458d2623af2d6de1` was pushed; both remote branch and PR #15 head matched it. A documentation-only checkpoint follows to record that evidence. Keep PR #15 Draft; do not create another PR or merge main. The API cannot independently report Draft state under the current policy; no action in this task marks it ready.

## Completed implementation packages

- Baseline/audit and recovery instructions: preserved existing feature separation, math ports, algorithms and compatibility facades. See ARCHITECTURE_AUDIT.md and TEST_BASELINE.md.
- Reused all three engine-navigation-catalog commits with original authorship; 33 focused tests and app typecheck passed.
- Added automatic metadata discovery, strict validation, dependency quarantine, shared role/major/grant policy, lazy guarded routing and sidebar contributions. The disabled example proves discovery through the actual router/navigation without central registration edits.
- Finished the interrupted dashboard package: dashboard contributions preserve labels/icons/layout; instructor search follows access policy; typed repositories propagate failures and stale dashboard loads are ignored. Pushed/verified at 0bcdbb584dc08f5e07df1b97b3f968864adad8a3.
- Added compiler-resolved module/public-feature boundary enforcement, static runtime-cycle detection and eight seeded guard tests. Pushed/verified at 0f5d2c6e6c368131f72050b33a63440ed6b72e67.
- Removed 58 conclusively unused application scaffold files and 39 unused direct dependency declarations; pushed/verified at af474161638071da0de2ecb7bff54db8db148956. Exact paths, reference evidence and retained contracts are in CODEBASE_CLEANUP_REPORT.md.
- Full final verification passed: 182 Vitest files / 1622 tests, 29 Python tests, eight guard tests, workspace typechecks, production build and all architecture audits. No tests removed; no detected regression within tested coverage.

## Phase status

| Phase | Status | Evidence / limitation |
|---|---|---|
| Audit and baseline | Complete | Recorded baseline and preserved prior work |
| Architectural separation | Complete for this implementation scope | Existing feature/repository boundaries retained, dashboard error/type boundary improved, automated guards added; AuthContext remains a documented combined lifecycle/adapter |
| Plug-and-Play | Complete for trusted build-time source modules | Discovery, routing, sidebar/dashboard, access, dependencies, lazy loading, failure isolation and demonstration tested; no external runtime installer |
| Mathematical architecture | Preserved and verified locally | Ports/algorithms unchanged, TS/Python regression coverage passed |
| Course/user/database architecture | Partial external validation | Local contracts/regressions pass; signed-in RLS/production deployment not validated |
| Cleanup | Complete for verified batch | 58 deleted paths and 39 direct declarations documented; uncertain public APIs retained |
| Engineering checks | Complete | Compiler and existing guards in repeatable verification command |
| Final verification | Complete locally | See FINAL_VERIFICATION.md for actual results and limits |
| Git review | Existing PR #15 | Branch and PR head verified through Git transport; API access is unnecessary for the requested branch update |

## Remaining work

1. Review existing Draft PR #15. The focused classification implementation is complete and secured remotely; never create a replacement PR, mark it ready or merge automatically.
2. In an authorized test environment, validate signed-in roles, course ownership/enrollment and RLS with test identities. Do not use production writes or request a frontend service-role key.
3. Separate follow-up debt: heavy Plotly/PDF/math chunks, dependency deprecations, optional AuthContext extraction, alternate Python protocol deployment/hardening and real-browser workflow/visual verification.

No production-readiness or percentage-completion claim follows from local passing tests. Supabase configuration, migrations, student IDs, themes and mathematical algorithms remain unchanged.

---

## Historical checkpoint — PR #31 Quick Access

# University features — Quick Access verified (2026-10-22)

Current branch `feature/student-quick-access` is stacked on engine-access db0ae2d7b57efee2ed85621d8a3e9f2488abda02 (previous verified remote). Existing card enhanced; see docs/university/QUICK_ACCESS.md. 1872 Vitest/215 files,36 Python,107 PostgreSQL,workspace TS,audits/build PASS. Next implement attendance, online lectures, Owner labels and combined integration; continue automatically. No main merge or production writes. Git establishes newest checkpoint. Older NEXT below is superseded.
