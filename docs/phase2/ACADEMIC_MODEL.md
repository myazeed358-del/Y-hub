# Academic definition / section compatibility model

Base main `b86dc42`; independent branch `feature/academic-course-sections`. Migration **0027_academic_course_definitions.sql**, local only. PRs #19–#22 are already merged; 0025/0026 production application remains UNKNOWN. No production DML, migration or mutating RPC was executed. An anonymous read-only OpenAPI request returned 401 and proves no deployment state.

## Existing relationships reviewed

All migrations 0001–0026: courses → materials, exams, question bank, enrollments, syllabus units → syllabus sections; exams → questions, results and 0025 attempts. Roster RPCs, student discovery/enrollment, manager ownership, audit capture and 0026 confirmed cascade deletion all use courses.id. Storage blobs are outside the PostgreSQL transaction. Existing content algorithms and UI URLs are unaffected.

## Additive model

- `course_definitions`: independent UUID catalog identity, code/title/description, department, academic_major, optional historical course provenance and server timestamp. No unique name/code and no fuzzy matching. A NULL academic_major means explicitly unclassified/shared; migration never invents a major from title/instructor.
- `courses` remains the **physical section store**. Added required course_definition_id FK (ON DELETE RESTRICT), optional section_label and academic_term. Instructor, enrollment switches, publishing and content remain section-specific. Section id and definition association become immutable; create a new section rather than silently reparent history.
- `course_sections` is an updatable **security_invoker view** over the same rows, with explicit columns and caller grants/RLS. It is not a second mutable copy or privileged view. Existing /course/:id and course_id FKs remain valid.
- Backfill creates exactly one definition for every existing course, even identical titles/codes. Its UUID/provenance is the historical course ID; original course columns, children and results stay unchanged. Legacy clients creating a course without a definition receive a fresh independently created definition transactionally. New clients can explicitly reference a shared catalog definition; two instructors then own distinct section UUIDs with independent content.
- Catalog metadata does not automatically overwrite section display titles/codes. Catalog edits/deletes require admin/super_admin. Instructors can read definitions but cannot mutate shared catalog data directly; the private trigger may create a definition only as part of an authorized legacy section insert. Failed section creation rolls back that insert and audit together.
- Definitions with live sections cannot be deleted. Deleting a section uses existing cascades, retains audit and its catalog provenance, and never reconnects deleted content to a new same-code section.

All new sensitive changes use existing trusted audit capture/actor locking. Free text stays redacted. Added definition events are reserved for super_admin; instructor section metadata events retain existing admin visibility. No new public SECURITY DEFINER mutation RPC. The private compatibility trigger has empty search_path and no client EXECUTE/schema access; table RLS still decides the course insert.

This branch does not change existing content read policies. Tightening instructor cross-section reads, enforcing major-filtered discovery/new enrollment, and syllabus UI/CAS belong to the dependent syllabus/permissions branch. No catalog-management UI or AI syllabus generator is invented here. Section-associated exceptional engine grants do not exist in the schema; existing module permission checks remain fail-closed rather than introducing fictional grants.

## Verification

- 12 new PostgreSQL tests: real pre-0027 data backfill, all historical relationships, identical-code independence, explicit shared definitions, compatibility view/RLS writes, immutable IDs, catalog role/major isolation, FK restriction, delete/recreate, audit rollback/redaction and concurrent legacy creation.
- Existing suites with the new migration: 26 Audit Log, 16 exam attempt, nine confirmed course deletion tests PASS; immutable student-number assertions PASS. The audit column inventory intentionally expands to nine tables. The old mutable-course-ID test now asserts rejection and still proves mutable material IDs and timestamps are audited; no test was skipped or disabled.
- Full verification: 1819 Vitest /206 files, 29 Python, eight boundary guard tests, root/all workspace TypeScript, architecture/math/module checks, production build PASS. Logs `/tmp/phase2-b-{full,sql,audit,exams,courses}.log`. Existing large chunk/deprecation warnings remain.

## Deployment gates

All SQL ran in disposable PostgreSQL 16 containers with network=none; auth/storage stand-ins are not real Supabase JWT/PostgREST integration. Staging PENDING. Before applying: backup/restore rehearsal; inspect real row counts and backfill/audit volume/locks; review unclassified majors, legacy null ownership and duplicate catalog metadata; validate current migration ledger including 0025/0026; validate signed-in roles and views through PostgREST. Never collapse catalog definitions by code as an automatic migration. No claim of production readiness or successful CI/Vercel checks follows from local tests.
