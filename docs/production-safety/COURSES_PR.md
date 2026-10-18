## Problem and result
A course DELETE could return no error while RLS deleted zero rows, yet the dashboard reported success. Deletion now requires an exact server-confirmed course ID. Missing rows, authorization rejection, database failure and uncertain network responses produce distinct outcomes without advancing the UI to success.

Migration 0026 adds a minimal locked authorization guard and a SECURITY INVOKER deletion RPC. Actual deletion continues under caller RLS; even additional restrictive policies are respected. Existing owner-only rules for instructor/admin/super_admin and every historical FK are unchanged. Audit failure rolls back the parent, dependent data, events and notifications. The confirmation describes the actual destructive cascade and remaining Storage files; duplicate clicks are suppressed.

## Verification
Seeded false-success test failed before the fix. Final: 1,802 Vitest tests across 203 files, 29 Python tests, 8 boundary guard tests, complete workspace TypeScript/architecture/build passed. Focused dashboard: 24 passed (12 new, included in total). New isolated PostgreSQL: 9 passed; existing Audit Log: 26 passed plus immutable student-number assertions. Tests include ownership matrix, zero rows, future restrictive RLS, concurrent delete, role revocation, cascade, audit retention and child-audit/notification rollback.

## Release gates
**IMPLEMENTED — STAGING PENDING.** No production writes/migrations; no staging currently exists. Real JWT/PostgREST/admin-browser validation remains pending. 0025 is reserved by the independent exam branch; 0026 itself does not depend on it. Apply accepted migrations in order only after review/authorization. Existing Vercel/API access and workspace dependency findings remain unresolved; no checks are waived.

See [baseline](docs/production-safety/BASELINE.md) and [deletion policy, cascade and evidence](docs/production-safety/COURSES.md). Draft review only; no automatic merge.
