# University features — online lectures verified (2026-10-23)

Current `feature/online-lectures` builds on attendance c1a4bd2dc286386230f2fe14103ff7f81da06e64 (previous verified remote). New0036/shared lecture model, LiveKit adapter/Edge admission+reconciler, audited blocks and current-role concurrency lock complete. Full1889 Vitest/218 files,36 Python,119 PostgreSQL,workspace TS,audits/build,Deno entrypoint check PASS. Concurrent promotion regression FAILED before target-role lock and PASSED after. See docs/university/ONLINE_LECTURES.md. Media/SFU/scheduler/staging operational tests PENDING; provider transport mocked. Next: independent Owner display-label branch from verified main8a5dde1, then combined Phase3+university real Auth/HTTP verification and final delivery. Preserve Quick Access f862ae29 and other branches. Continue automatically; no main merge/production writes. GitHub API Forbidden blocks Draft PR creation; descriptions committed. Older NEXT below superseded.

# University features — attendance verified (2026-10-22)

Current `feature/y-attendance` is based on engine-access db0ae2d7b57efee2ed85621d8a3e9f2488abda02; Quick Access separately pushed and verified f862ae29b547940dfe1790a9d9f14f63b35d6b3f. See docs/university/ATTENDANCE.md. 1870 Vitest/215 files,36 Python,111 PostgreSQL,workspace TypeScript,audits/build PASS. New0035, QR/rosters/corrections/reports/API-v2 implemented. Next: online lectures on a focused child branch sharing academic_lectures, then Owner labels and real Auth integration. Continue automatically. No production writes/main merge. GitHub API PR creation returns Forbidden; branch push works. Prepared online code may be in /tmp/yhub-online; inspect before continuing, not a completed commit. Older NEXT below is superseded.

# University features — phase 1 verified (2026-10-22)

Current task is the university feature request, not a repeat of Phase 3. Read `docs/university/ENGINE_ACCESS.md`. Branch `feature/exceptional-engine-access` independently based on verified main `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136`; Phase 3 heads remain preserved and unmerged. New 0033 + grant UI/API/backend guards complete. Full phase verification: 1865 Vitest /214 files, 36 Python, 102 PostgreSQL, eight architecture guards, two export tests, all TS/audits/build PASS. Git/remote establishes newest checkpoint. No production operations/main merge.

NEXT: create `feature/student-quick-access` from this verified feature branch (explicit dependency on server module policies), enhance the EXISTING StudentDashboardSidebar card with account preferences/CAS/0–3 tools and sync. Then implement Y-Attendance, Online Lectures and Owner labels on focused branches; full tests after each phase. Continue automatically, do not stop at this checkpoint. Do not repeat completed Phase 3 or grant functionality. GitHub API still previously blocked; Git push works. Hosted staging unavailable; mark pending. Vercel Python size issue remains deferred.

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
