# Phase 3 — security, data integrity and academic completion

Review checkpoint: 2026-10-22. Base main **8a5dde1b20f26161e7e26b8b0bf71ecd1097f136**, rechecked against GitHub. Phase 2 was already merged and was not reimplemented. Work is split across independent branches; no main merge, production migration, production writes or deployment changes occurred.

## Implemented behavior and evidence

| Area | Proven defect / need | Delivered behavior |
|---|---|---|
| Exam access | SQL negative control allowed a published exam in an unpublished section | 0029 locks/checks parent publication along with actual current role and enrollment; native signed JWT HTTP test denies access |
| Role revocation | Demoted, enrolled former owner could read another student's enrollment | Restrictive enrollment SELECT policy requires current staff role for other rows; HTTP test reuses the old signed JWT after demotion and sees neither keys nor others' enrollment |
| Database grants | Local Supabase-style default grants exposed TRUNCATE on eight tables to anon | Revoke client TRUNCATE/TRIGGER/REFERENCES, public schema CREATE and migration-owner future defaults; RLS alone does not cover TRUNCATE |
| Platform event trigger | Actual hosted `rls_auto_enable()` is not in source | Conditional search_path/execute hardening, with a representative local event-trigger test; actual hosted body/owner remains an explicit release gate |
| Exam versions | Two negative controls showed changed question text and grade 0 instead of 3 after author edit | 0030 private per-attempt snapshot, transactional capture, key-free student question RPC and snapshot-based grading |
| Offline answers | No robust per-attempt recovery | Synchronous bounded local journal by owner/exam/server-attempt/editor, refresh restore, alternative-tab copies, failure warning/navigation guard; no client timer authority |
| Academic management | Existing catalog/sections lacked complete staff workflow | API-v2 application module at `/academic-management`: catalog creation, linked section creation, semester/label/major, current instructor directory/assignment, scoped roster, dashboard section labels; existing course UUIDs/child links preserved |
| HTTP conflicts | Native PostgREST repeatedly retried deliberate `40001` domain errors until connection loss | 0031 academic errors and new 0032 syllabus/Y-Sheets replacements return terminal PT409/HTTP409; no automatic overwrite/rebase. Adapters retain older-code support |
| Deleted workbook replay | Deleted receipt replay appeared as server error HTTP500 | Explicit conflict HTTP409, receipt retained, no resurrection |

Security negative controls: 34 tests /3 failures before 0029; two SQL failures before 0030; two frontend failures before conflict adapter compatibility. Native HTTP before 0032 had 3 transport errors; then one deleted-receipt HTTP-code mismatch, corrected without relaxing the test. A minimal local RPC confirmed repeated execution on 40001 and immediate 409 on PT409. These failures, code review, locking/privilege analysis and final passing tests together support the fixes; test counts alone are not a security guarantee.

## Implementation branches and new migrations

| Branch | Verified implementation SHA | Migration |
|---|---|---|
| `fix/phase3-supabase-security` | `56e5e3303e66a759336ec9a6ad2f474ea1ee4941` | 0029_security_privileges_and_exam_access.sql |
| `feature/phase3-exam-reliability` | `a9a814ef1e4b2a427d0357d18cdf79cfa83b9274` | 0030_exam_question_snapshots.sql |
| `feature/phase3-academic-management` | `caec7a29a11455b2ca2a242aa7dcde0dae865b92` | 0031_academic_management.sql |
| `fix/phase3-rpc-conflicts` | `fa9c7e3d5d8cd38f0644a207f78703f24a9f3b3c` | 0032_rpc_application_conflicts.sql |
| `test/phase3-real-integration` | Git history/remote establishes final documentation commit; source harness checkpoint `521b6df` | None; disposable platform fixture only |

All four implementation SHAs verified with `git ls-remote`. Historical migrations 0001–0028 are unchanged. Source inventories are in CHANGED_FILES.md. Detailed per-branch reasoning/PR bodies reside under docs/phase3 on those branches. Integration script overlays these exact commits into a temporary source export and verifies them together **without merging branches**.

## Final verification

| Check | Result |
|---|---|
| Native GoTrue/Auth + JWT + PostgREST HTTP integration | **14/14 PASS**, 16.036s |
| Vitest, all application/integration suites | **1886/1886 PASS**, 216 files |
| Python mathematical/API regression | **29/29 PASS**, 0.976s |
| Isolated PostgreSQL academic/security/management/syllabus | **45/45 PASS** |
| Isolated PostgreSQL audit | **26/26 PASS** |
| Isolated PostgreSQL exam attempts/snapshots | **20/20 PASS** |
| Isolated PostgreSQL course deletion | **9/9 PASS** |
| Isolated PostgreSQL Y-Sheets | **12/12 PASS** |
| PostgreSQL total | **112/112 PASS**, plus historical SQL assertions |
| Architecture boundary guard unit tests | **8/8 PASS** |
| Complete workspace TypeScript; strict architecture/math/module/cycle checks | **PASS** |
| Production Vite build | **PASS**, 47.02s |

Final combined verification script completed successfully. No final failed/skipped/disabled tests. PDF.js legacy-build notices, Starlette/httpx deprecation and existing large Vite chunks are warnings, not suppressed checks.

Full evidence log: `/tmp/phase3-combined-final.log`. Reproduce with pinned pnpm on PATH and `YHUB_PYTHON=/workspace/.yhub-venv/bin/python bash scripts/verify-phase3-snapshot.sh`. Individual source branches also have their own targeted/full verification evidence documented alongside them. No disabled tests or relaxed architecture/security gates. Math/Python regression suites run, but mathematical implementations and deployment settings are unchanged.

## GitHub delivery

All implementation branches are pushed. GitHub API read checks return `Post "https://api.github.com/graphql": Forbidden`; Draft PR creation will be attempted after the integration checkpoint push. The running enforced allowlist excludes `api.github.com` although the saved environment draft already includes it. Saving a draft did not update this running instance. No access bypass or token extraction is used.

## Release boundaries / remaining work

**Not production-ready and not approved for automatic merge.** Implementation/local verification is ready for review, with these external release gates still **PENDING**:

1. Isolated hosted Supabase staging: exact migration ledger and service versions, real project Auth/JWT/session policies, Student/Instructor/Admin/Super Admin browser workflows. No confirmed staging was provided; development and all possible local tests continued.
2. Inspect actual `public.rls_auto_enable()` definition/owner/event trigger, extension/unqualified-name compatibility with pinned search_path, and default ACLs for every migration/object owner. Local representative fixture is not proof of the hosted definition.
3. Backups, staged migration rehearsal and active-attempt drain before 0030. Existing active attempts can only capture deployment-time questions; their original authoring version cannot be reconstructed. Historical submitted results are unchanged.
4. Real Storage service/files, TLS gateway/Kong, mail/MFA/host-specific policies, network loss and browser/device end-to-end. HTTP tests use native GoTrue/Auth and PostgREST, but Storage tables are fixtures and no ports are published. Public educational file URLs remain public under the pre-existing product model; SQL does not make them private or atomically delete storage objects.
5. Cross-device unsent answers are not synchronized. Recovery is on the originating browser/device; clearing storage, device loss or same-origin XSS can defeat it. Offline refresh retains drafts but reconnection/authentication is needed to reload server questions. Multiple devices do share server attempts/deadlines and exactly-once result enforcement.
6. Logout revokes refresh tokens; an already-issued access JWT can remain usable until expiry under normal Supabase semantics. Current database role/enrollment checks revoke academic privileges independently. Expired/tampered JWT rejection is verified locally, not a claim of instantaneous global access-token revocation.
7. Contending bank edits/start/role changes can safely abort on deadlock; clients must retry after a failed transaction. Mandatory audit/snapshot failure rolls back the mutation. No claim is made that a rolled-back trigger preserves a denied-attempt log. Audit is append-only for application roles, not absolutely immutable against database owners/superusers.
8. Frontend conflict-code compatibility should deploy before 0032. Review the independent PRs together and apply reviewed migrations in numeric order only after authorization. No backend permission is replaced by frontend checks.

Known Deferred Issues: Vercel Python bundle-size deployment limit, intentionally untouched and not investigated. Existing Vite large-chunk/PDF.js and Python dependency warnings remain separate from the successful local checks. No test/CI waiver is requested.
