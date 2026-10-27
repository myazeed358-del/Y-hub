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

# Current checkpoint: Phase 1 production safety (2026-10-18)

Resume from `docs/production-safety/FINAL_REPORT.md` and `CHANGED_FILES.md`; preserve the independent implementation branches. Main is `57f3103b273285c27802e35f47189e16a8318035`: PR #18 was already merged before this task. Do not repeat Y-Sheets hardening or act on the historical PR #16 instructions below.

Verified remote implementations: exams `e6a41004e899da4e1321cc9c10448cbfb63b4bd6` on `feature/exam-attempt-integrity`; courses `8f32d6eb20f60a0581617e56119f760b186a63fd` on `feature/course-deletion-integrity`; dependency fix `ac778eec4b1671a74b3e3f49e1ce9be811a4fef3` on `fix/mathjs-parser-security`. Current verification/report branch is `verify/y-sheets-release-gates`; Git/ls-remote establishes the final documentation commit (prior local SQL-test checkpoint `3de4b24`).

The user explicitly confirmed no staging. All writes/migrations were local, disposable and network-disabled. No main merge, production change or PR #14 modification. Local implementation/suites are complete; next external gates are GitHub API access/PR creation, Vercel error logs and authorized isolated Supabase staging with real JWT/accounts/devices. Do not call the release production-ready. Existing health HTTP 200 is not RLS or migration evidence. Do not invoke attempt/status RPCs as read-only production probes: they can persist expiry.

The dependency branch pins mathjs 15.2.0 without engine implementation edits. When switching between branches, align node_modules with the branch's frozen lockfile before testing. The optional combined-source verification script requires dependencies prepared from the security branch; it exports a temporary source tree without merging Git branches.

## Historical checkpoints (superseded task instructions)

# Current checkpoint: DELETE result verification / existing Draft PR #16

Resumed clean branch `feature/central-audit-log`; local, remote branch and PR head matched `3c205833c25e27433dbf3b0fb9f54fb8cce2685b`. Both delete handlers now require a matching returned ID via `.select('id')`; RLS-hidden/missing rows never advance success state. Tests cover actual PostgreSQL failures and successful deletion too. No migration change in this patch.

1674 Vitest tests / 186 files (76.27s), 29 Python tests (1.271s), 26 isolated PostgreSQL tests (26.578s) plus immutable user-number SQL checks, eight boundary-check tests, workspace TypeScript, all architecture audits and production build (44.12s) passed. Both complete scripts exited 0; no failed/skipped tests in final runs.

PR #16 Draft state verified through public GitHub HTML. Vercel Preview failure is confirmed for 3c205833; exact deployment URL and blocked-log evidence are in `docs/audit-log/DELETE_RESULT_REVIEW.md`. Root cause is unknown, not assumed to be Audit Log or the old bundle limit. GitHub API blocks description editing; the refreshed body is committed at `docs/audit-log/PR_DESCRIPTION.md`. Next: obtain deployment error text / API access, update only #16, then separately authorized isolated Supabase staging. Never create a new PR, merge or apply migrations to production.

## Prior checkpoint (historical)

# Current task: PR #16 audit security follow-up

Branch: `feature/central-audit-log`; existing Draft PR: https://github.com/myazeed358-del/Y-hub/pull/16 (user-confirmed Draft; API unavailable). Do not create a PR or merge. Base main remains `9057222acc54c473e192a98507273ce49ac19aac`.

Recovered clean tree; local head, remote branch and PR head all matched `08ee5375dee6db0d8de785d499a4cd0dab609716`. Reviewed audit code and authorization dependencies. Fixed role-revocation bypass in legacy child-content policies, identity/timestamp capture gaps, free-text major/difficulty disclosure, and ignored database errors in two audited delete handlers. See `docs/audit-log/SECURITY_REVIEW.md` for causal evidence and limits.

Database final verification: 25 real isolated PostgreSQL tests passed, plus existing user-number SQL regression. Final full verification passed after handler fixes: 186 Vitest files / 1670 tests (74.50s), 29 Python tests (0.996s), eight boundary-check tests, full workspace TypeScript, architecture audits and build (42.81s). No production migration, permission changes or data operations. Only unmerged 0022 is amended; no historical migration edits.

This checkpoint contains the complete verified security patch; establish its SHA from Git and verify remote branch/PR head. The previous verified remote checkpoint is 08ee5375dee6db0d8de785d499a4cd0dab609716. Next review gate is isolated Supabase staging and PR #16 review, not another implementation restart. GitHub API returns Forbidden; if body edit remains blocked, the committed PR_DESCRIPTION.md and security report are reviewable through the branch push. Require isolated real Supabase staging validation before approving merge; never confuse local PostgreSQL auth stand-ins with live JWT/RLS end-to-end evidence.

## Historical handoff (superseded)

# Agent handoff

CURRENT PHASE: focused module classification complete, verified and pushed to existing PR #15.
CURRENT WORK PACKAGE: documentation of the verified API-2 remote checkpoint; source implementation is complete.
LAST COMPLETED TASK: full verification passed; source commit pushed and both remote branch and refs/pull/15/head confirmed at the SHA below.
CURRENT BRANCH: refactor/architecture-plug-and-play
LAST VERIFIED REMOTE COMMIT SHA: fb41c56310947cf3092339c0458d2623af2d6de1 (verified source checkpoint on branch and refs/pull/15/head; this documentation-only commit follows it, and Git establishes the newest SHA).
FILES MODIFIED: modules contracts/registry/navigation/index and eight manifests; config/majorEngineAccess; app-shell navigation/search; section translations; module tests; PLUGIN_CONTRACT.md, ENGINE_EXTENSION_GUIDE.md, FINAL_VERIFICATION.md and progress/handoff docs.
FILES CREATED: classification.test.tsx and test-only glob fixtures for mathematics/scientific engines, application and laboratory.
FILES DELETED: none in this focused package.
TESTS EXECUTED: full verification script, including all Vitest and Python tests, root/workspace TypeScript checks, architecture/math/module audits and guard tests, production build; git diff --check; protected-path diff review.
TEST RESULTS: fresh run exited 0; 183 files / 1645 Vitest tests (73.40s), 29 Python tests (0.898s), eight architecture-check tests; typechecks/audits passed; build passed (42.49s). No detected regressions or reported skips. Full log: /tmp/yhub-classification-resume.log; durable evidence in FINAL_VERIFICATION.md.
KNOWN FAILURES: none detected in focused checks. Existing large chunks and PDF.js/Starlette warnings remain. GitHub API policy is restricted, but Git push and PR-head verification work. Authenticated backend/browser verification remains outside local coverage.
UNFINISHED WORK: none in the focused implementation. PR #15 remains for review; API restrictions prevent independent Draft-flag verification, and no ready/merge action was taken. External authenticated backend/browser validation remains outside this local verification.
NEXT EXACT STEP: inspect local/remote state and review existing Draft PR #15. API-2 source and docs are complete; do not repeat this migration or broaden scope. Do not create another PR, mark it ready or merge main. New product implementations require a separate task.
RECOVERY COMMANDS: git status --short --branch; git log -5 --oneline; git ls-remote origin refs/heads/refactor/architecture-plug-and-play refs/pull/15/head; read PLUGIN_CONTRACT.md and REFACTOR_PROGRESS.md.
IMPORTANT RISKS: API 1 is deliberately rejected; migrate manifests explicitly using PLUGIN_CONTRACT.md. Fuzzy Logic Lab stays an engine for existing computation/search compatibility; future laboratory-kind modules remain separate. Kinds/categories/capabilities/groups grant no privileges. No Supabase/RLS/migration/theme/math algorithm changes. Known Vercel Python bundle-size deployment limit is outside this task; do not investigate it here.

---

## Historical checkpoint — PR #31 Quick Access

# University features — Quick Access verified (2026-10-22)

Current branch `feature/student-quick-access` is stacked on engine-access db0ae2d7b57efee2ed85621d8a3e9f2488abda02 (previous verified remote). Existing card enhanced; see docs/university/QUICK_ACCESS.md. 1872 Vitest/215 files,36 Python,107 PostgreSQL,workspace TS,audits/build PASS. Next implement attendance, online lectures, Owner labels and combined integration; continue automatically. No main merge or production writes. Git establishes newest checkpoint. Older NEXT below is superseded.
