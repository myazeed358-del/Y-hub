# Syllabus integration and academic permissions

Dependent branch `feature/syllabus-academic-permissions`, based on verified academic branch commit `99852b5f006a94b0f021619bc6ad2c622f96f56b`. Review against `feature/academic-course-sections`, not as a duplicate independent catalog PR. Fullscreen is independent at `39dd464dc67b29ccf5b03eca5651213cd93ca13e`.

## Confirmed problems and implementation

0011 had syllabus tables and RLS but no course-manager/student integration. Historical published-course SELECT allowed other instructors to discover sections, and 0006 material SELECT admitted every content manager. Course discovery/enrollment had no explicit catalog-major constraint. The new **0028_syllabus_and_academic_permissions.sql** adds restrictive policies rather than broad new permissive access.

| Actor | Section metadata | Syllabus/content | Syllabus writes |
| --- | --- | --- | --- |
| Student | Published matching-major or unclassified definition; existing active enrollment preserved | Published, actively enrolled section only, under existing table policies | Denied |
| Instructor | Assigned/owned section only | Owned section only | Owned section, current DB role, RLS and expected revision |
| Admin / super_admin | Existing all-section read retained | Existing table-specific policies retained; no blanket new content grants | Existing ownership requirement retained; reading is not editing |
| Anonymous / missing profile | No new access | Denied | Denied |

Catalog read/write rules from 0027 remain separate. NULL major is an explicit legacy/shared classification, not an inferred academic entitlement. Existing active enrollments survive later catalog-major corrections; new enrollment must satisfy the current definition. User major comes from the existing DB profile and existing self-edit restrictions, not a request/JWT hint. Section-specific exceptional engine grants are not present in this schema: none are fabricated, and the module permission contract remains fail-closed. Admin/super_admin names and role-management hierarchy are unchanged.

Final read-security review proved historical owner policies admitted a former instructor after demotion if they enrolled in the old section. Restrictive direct-question SELECT now also requires current instructor/admin/super_admin role; students use the existing timed, answer-key-free `get_exam_questions` RPC. Restrictive result SELECT preserves personal historical results but requires current staff role and authorized section for other people's results. The regression returned (one question, one other-student result) before the fix and (zero, zero) afterward, while current-owner review and personal result reading still pass.

## Syllabus contract

`read_course_syllabus(section UUID)` is SECURITY INVOKER, STABLE and returns one consistent snapshot `{courseId, revision, units:[{id,title,sections:[{id,title}]}]}`. Queries use the exact section UUID. No static lesson plan, AI parser, matching course code or old content is imported.

`save_course_syllabus(section UUID, expected revision bigint, units jsonb)` is SECURITY INVOKER. A narrowly scoped SECURITY DEFINER helper with empty search_path locks the actor's actual profile role FOR SHARE and owned course FOR UPDATE. It returns only the authorized revision. Actual DML then uses caller table grants and RLS; seeded future restrictive update/delete policies still reject the RPC. All graph validation precedes writes, and any error rolls back the transaction. Limits: 1 MiB JSON, 100 units, 1000 topics, UUID identities, unique IDs, nonempty trimmed titles up to 200 characters, no unknown fields. Hidden/foreign IDs cannot be adopted. Zero-row denied writes do not become false success.

The course's server-managed `syllabus_revision` changes on real unit/topic mutations, including direct REST/SQL changes. Same-value updates and no-op saves do not create a new revision or duplicate content audit. Parents/IDs cannot be reassigned. CAS mismatch raises 40001; one of two concurrent same-revision writers wins. Actor revocation committed during authorization prevents the save. Direct child DML versus full-snapshot edits can still form a lock-order deadlock: PostgreSQL aborts a transaction atomically; clients retain drafts and must reload/retry, not automatically overwrite.

The operational CAS token is explicitly excluded from course audit payloads; syllabus INSERT/UPDATE/DELETE audit events remain mandatory and transactionally tied to changes. Tests still require every other domain column to be classified. Catalog events gain English/Arabic filter labels in the existing audit UI. Existing notification behavior remains separate and unchanged.

Known deleted section UUIDs recorded in audit cannot be reused even with an explicit catalog reference. This complements immutable live IDs and avoids resurrecting an audited old URL. It cannot reconstruct deletions predating retained audit history, nor resist a database owner who disables protection.

## UI and boundaries

Independent `features/course-syllabus` contains typed validation, repository, request-generation guarded hook, bilingual panel and tests. Application `pages/` composes public feature exports via render slots; features do not import each other's implementation or public modules. Strict architecture checks are unchanged.

Instructors can create units/topics, rename, move up/down, confirm removal, and save. Students see read-only section content only after the existing enrollment gate. Loading, safe errors, empty results and revision conflicts are explicit. Inputs stay editable after a failed save; stale reads/saves from another account/section are ignored. Reloading a dirty draft requires confirmation. A lost acknowledgment leaves the draft and old revision intact; retry may report conflict rather than silently overwriting a confirmed server version. Syllabus drafts are in-page state, **not** Y-Sheets local recovery or cross-device draft backup; copy unsaved edits before leaving/reloading. No AI generator is represented by the legacy `syllabus_source='ai'` field.

## Verification evidence and limits

See FINAL_REPORT.md for final counts. SQL tests use all migrations in disposable PostgreSQL 16 containers, `--network none`, no published ports and synthetic identities. They cover historical data preservation, catalog/section independence, role/major enforcement, student isolation, CAS races, current-role checks, direct edits, audit rollback/redaction, spoofed roles/temp objects, private function grants, no-op behavior, denied zero-row writes, and deleted-ID reuse.

Browser tests use the actual composed instructor/student pages with intercepted synthetic HTTP only. They exercise manual editing, save, conflict draft retention, confirmed reload and read-only student view, in Arabic dark/mobile and English light/laptop. They do not prove Supabase auth/PostgREST/RLS integration.

Production migrations 0025/0026 remain UNKNOWN; 0027/0028 were not applied to production. No confirmed staging exists. Staging JWT/role/major tests, migration ledger and historical data review, real device concurrency, backups, index/lock/backfill volume, PostgREST schema cache refresh and CI/Vercel must be verified before release. Existing public materials Storage behavior is unchanged; deleting database metadata does not transactionally delete blobs. No production readiness claim.

Verified source checkpoint 6123670: complete suite **1843 Vitest /209 files**, **29 Python**, **eight boundary guard tests**, all workspace TypeScript, architecture/math/module checks and production build PASS. New feature tests: 22 plus two audit catalog UI cases, included in total. Final backend after the read-policy fix: **30 academic +26 audit +16 exam +9 course deletion +10 Y-Sheets =91 PostgreSQL tests PASS**, plus immutable user-number checks and historical Y-Sheets RLS assertions. No skipped/disabled cases. Browser composition test PASS. Final SQL logs `/tmp/phase2-c-final-{academic,audit,exams,courses,sheets}.log`. Combined source-export verification also passed with **1855 Vitest /211 files**, all TS/audits/build/Python checks and both Chromium scripts; see FINAL_REPORT.md for the precise verified commits and SQL-only final change.
