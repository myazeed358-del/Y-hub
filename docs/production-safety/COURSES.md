# Workstream B — confirmed course deletion

Base main `57f3103b273285c27802e35f47189e16a8318035`; branch `feature/course-deletion-integrity`. **IMPLEMENTED — STAGING PENDING**. This branch is independent of the exam implementation.

## Proven issue and behavior

The seeded controller regression failed: a DELETE response with `data:[], error:null` emitted success and refreshed the course list. The repository now calls `delete_course_confirmed`; the controller accepts only the exact requested ID, preserves the list on rejection, distinguishes P0002 (missing), 42501 (permission), database errors and uncertain/network responses, and prevents concurrent duplicate clicks. Confirmation explicitly warns about dependent data and remaining storage files in Arabic and English. An uncertain response after server commit is not falsely described as success; the user refreshes before retrying. No automatic destructive retry is added.

## Migration and authorization

New **0026_confirm_course_deletion.sql** reserves 0025 for the separately reviewed exam branch; it has no dependency on 0025 and changes no historical migration, FK or RLS policy. Deploy migrations in numeric order if both branches are accepted.

A private SECURITY DEFINER guard, fixed empty search_path, checks auth.uid and current profile role, locks that role and the target course, and returns no course content. The current policy requires ownership **even for admin/super_admin**; seeing all courses does not grant deletion of others' courses. The guard preserves that restriction. Manager callers can distinguish an absent UUID from an unauthorized existing UUID, but receive no title/owner/student data. Ordinary students cannot use the diagnostic path.

The public RPC is **SECURITY INVOKER**: the actual DELETE executes with the caller's grants and RLS, including future restrictive policies. A zero-row or trigger-suppressed delete raises an error. The private schema is not an exposed PostgREST schema; authenticated receives only usage/execute of this guard, not data access. The guard itself remains safe if called independently: it only validates/locks, never mutates data. No service-role client credential or RLS bypass is introduced.

## Actual deletion consequences

| Existing relationship | Effect of course deletion |
|---|---|
| courses → course_materials | Material database records deleted |
| courses → exams → questions | Exams and their linked questions deleted |
| courses → questions | Course question-bank rows deleted |
| exams → student_results | Historical results for deleted exams deleted under the pre-existing FK |
| courses → course_enrollments | Enrollment rows deleted |
| courses → syllabus_units → syllabus_sections | Syllabus records deleted |
| Audit events and notification references | Audit history retained without an FK to the deleted entity |
| Supabase Storage | No automatic PostgreSQL transaction deletion of file objects; files may remain |

No existing cascade is added or expanded. If 0025 is also deployed, its new operational attempt rows follow deleted exams; this does not change old result retention. A retention/archive policy would need a separate explicit decision before changing the destructive behavior.

Audit parent/child events and dependent deletes are atomic. A required child audit failure rolls back parent and children, their events and queued notifications. Admin cannot read reserved admin events; super admin can. Notification delivery remains separate and cannot erase a committed audit event. Existing audit authorization, redaction, notification retry tests are rerun unchanged.

## Verification

- Original regression: **1 failed before fix**, now passing.
- Focused dashboard tests: **24 passed / 6 files**, including **12 new tests** for exact-ID confirmation, RLS/missing/database errors, unexpected responses, network failure, cancellation and duplicate clicks.
- Isolated PostgreSQL: **9 cases**, covering complete role/ownership matrix, RLS-silent zero rows, missing rows, successful deletion, future restrictive RLS, full cascade, retained audit/storage, role revocation, concurrent delete and child-audit rollback.
- Final full suite: **1,802 Vitest tests / 203 files**, **29 Python tests**, **8 module-boundary guard tests**, complete workspace TypeScript, architecture/math/module checks and production build passed. Existing Audit Log: **26 passed**, plus immutable user-number SQL assertions. The final **9 course SQL cases passed**, including notification rollback. No final failures or skips; existing large-chunk warnings remain. `git diff --check` passed.

Real Supabase PostgREST/JWT and admin browser verification remain **PENDING** because the user confirmed there is no staging. Verify error codes, authorization matrix, cascade/audit behavior and Storage cleanup expectations on staging before any production application. No production mutation was performed.
