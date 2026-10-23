# Phase 3 — database security

Base: main `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136` (Phase 2 PRs 23–25 merged). Branch `fix/phase3-supabase-security`. Only new migration 0029 and new security tests; historical SQL unchanged.

Three failures reproduced against 0028 before fixing (`/tmp/phase3-security-before.log`, 34 tests, three failures):

- An actively enrolled student could start a published exam inside an unpublished section through the definer RPC, bypassing section visibility. `lock_access` now checks/locks the published parent as well as role, exam and enrollment. Revocation is serialized with these locks; no timer is restarted.
- A demoted owner enrolled in their old section could query another student's enrollment through the historical owner SELECT policy. A restrictive policy preserves own enrollment reads and requires current staff role plus section scope for other rows. Existing roster RPC role checks, question/result restrictions and audit role hierarchy remain.
- Default Supabase-style table grants included TRUNCATE (eight tables for anon in the local fixture), TRIGGER and REFERENCES. RLS is not a defense for TRUNCATE. Revoke these privileges on public tables and future tables created by the migration role, plus public schema CREATE, from client roles/PUBLIC. Other owners' default ACLs must be inspected in staging; authenticated DML/SELECT grants are unchanged.

`public.rls_auto_enable()` does not exist in repository migrations. 0029 conditionally pins its search_path to pg_catalog and revokes client execution, preserving body/owner/security mode. A local representative event-trigger fixture proves this branch executes and does not replace its body. Unexpected return type fails closed. Its actual deployed definition, owner, event-trigger registration and compatibility MUST be reviewed before applying; no production definition was inferred from a missing repository file.

Review inventory covered migrations 0001–0028 and effective overrides: profile update restrictions and immutable numbers, role RPC locking/hierarchy, content/roster policies, exam attempt/grade authorization, syllabus invoker/lock helper, private schemas, Y-Sheets CAS/receipt RPCs and audit capture/search/notification retry. Tests assert domain RLS and absence of PUBLIC-executable definers. The sole excluded table is the local test_legacy_snapshot fixture, not an application table. No broad rewrite or additional engine entitlement was introduced.

Main baseline verification: 1855 Vitest /211 files, 29 Python, eight boundary guard tests, workspace TypeScript, architecture checks and production build PASS. Final SQL counts and subsequent HTTP integration evidence are recorded in the final Phase 3 report. Existing answer-key, demotion, audit, Y-Sheets isolation and concurrency suites remain required.

No production writes, migrations or role changes. No confirmed staging. Local PostgreSQL auth stand-ins do not validate real Supabase Auth/JWT. Public educational Storage URLs remain intentionally public and cannot be protected by SQL row policies alone. Known deferred issue: Vercel Python deployment bundle size; no Vercel/Python configuration changes or diagnosis in this phase.

Final security-branch local verification: **97 PostgreSQL tests PASS** (36 academic/security, 26 audit, 16 exams, nine course deletion, ten Y-Sheets), plus historical RLS/user-number assertions. The six new cases include actual before/after regressions and the conditional event-trigger fixture. Logs `/tmp/phase3-security-{final,audit-log,exam-attempts,course-deletion,y-sheets}.log`. No UI/TS changes from the fully verified baseline.
