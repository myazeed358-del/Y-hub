# Phase 3 — practical academic management

Independent branch `feature/phase3-academic-management`, main base `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136`. Uses existing 0027 definitions and 0028 section permissions, not a parallel model.

## Delivered workflow

Automatically discovered API-v2 application manifest exposes `/academic-management` to instructor/admin/super_admin, in the learning navigation group. Students/guests cannot enter this administration UI; backend permissions are independent of the manifest. It does not enter engine catalogs/search and changes no mathematical code or global theme.

Admins/super admins create a catalog definition with title, code, department, description and major (or explicit shared classification), select it, create a section and assign a current instructor with section label/academic term. Instructors select existing definitions and create sections assigned to themselves. Sections begin unpublished with enrollment closed; existing course dashboard controls manage those states. Existing URLs, course IDs and child FKs remain unchanged. Students see section label/term and only the published sections their database permissions allow.

Admins can reassign an existing section with confirmation and expected-owner CAS; stale requests fail rather than override a newer assignment. Instructor role/current ownership and syllabus/content/roster access are evaluated by the database. No generic administrative write bypass is exposed. Creation accepts stable entity UUIDs for retry idempotency, not client actor IDs; replay checks the original definition/section fields and cannot silently overwrite another entity. After an uncertain acknowledgment, retain input and retry unchanged; if fields changed or assignment is stale, reload and review existing records first.

Migration **0031_academic_management.sql** adds four bounded/narrow RPCs: instructor directory (50 rows/page, limited to self for instructors), catalog creation, section creation, and assignment. Role/profile/catalog/section locks and existing mandatory audit triggers protect mutations. Existing section definition and ID immutability remain. There are no data backfills, ID replacements or historical migration edits in 0031.

The independent feature contains typed validation/repository, loading/error/paging hooks, bilingual forms and section/assignment/roster components. Catalog/section/directory lists use server pagination. The preexisting roster/count repository was moved without behavioral changes to `shared/academic/enrollmentRepository.ts` with its old dashboard compatibility export retained; both screens reuse the existing role-scoped RPCs. Roster retrieval still uses the existing complete-roster RPC, not a new enrollment administration feature. Existing syllabus/material/exam management links retain exact section UUIDs.

## Evidence

- **147 focused Vitest PASS**, including 18 new academic cases for validation, unconfirmed writes, replay IDs, server pagination, stale response isolation, Arabic forms and actual automatic discovery/role access/engine exclusion.
- Full branch verification **1873 Vitest /215 files, 29 Python, eight boundary guard tests**, complete workspace TypeScript, architecture/math/module audits and production build PASS.
- **99 PostgreSQL tests PASS**: 38 academic (eight new management cases), 26 audit, 16 exams, nine course deletion, ten Y-Sheets; plus historical SQL assertions.
- SQL covers admin vs instructor/student authority, role revocation during creation, two concurrent identical creates producing one section/audit event, assignment CAS, preservation of child IDs/content, removal of old-owner access, scoped student names, and rollback when audit insertion fails.
- Exact route/navigation inventory assertions were updated for the one intended staff-only route; no checks were disabled or relaxed. Logs `/tmp/phase3-academic-{focused,full,sql,audit-log,exam-attempts,course-deletion,y-sheets}.log`.

No production migration, main merge, Vercel/Python configuration change or new engine feature. Real HTTP integration and staging limits are recorded separately. Main's existing public educational Storage and unknown production migration ledger remain rollout considerations. Known deferred: Vercel Python deployment bundle size.

HTTP integration follow-up: deliberate catalog/section ID and assignment revision conflicts use `PT409` (HTTP 409), not retryable PostgreSQL serialization code `40001`. Native PostgREST 12.2.3 repeatedly retried the old assignment error until transport timeout; the real HTTP suite verifies a bounded conflict response. Locks, authorization and CAS comparisons are unchanged.
