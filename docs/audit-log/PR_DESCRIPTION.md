## Trusted centralized audit log

Instructor edits/deletions now create transaction-bound database evidence visible to Admin; administrative/access changes are reserved for Super Admin. Application principals cannot forge, edit or delete audit events. An event-insertion failure rolls back the sensitive operation.

- Migration 0022 adds protected event storage, actor-role locking, explicit privacy allowlists, immutable triggers, indexed RLS-filtered keyset search and a separate critical notification-intent ledger with server-only repair.
- Covers existing courses, materials, exams, questions, enrollments, syllabus units/sections and role/major changes without adding domain privileges or new administration workflows.
- Adds a discovered API-2 application at `/audit-log`, bilingual read-only review, filters, bounded server pagination and before/after details. Existing engine catalogs/dashboard contributions remain unchanged.
- Adds real disposable PostgreSQL SQL/RLS, concurrency and rollback tests, plus repository/UI and role-routing tests.

Verification passed: 1664 Vitest tests, 29 Python tests, 16 isolated PostgreSQL tests plus user-number SQL checks, eight architecture-check tests, workspace TypeScript, architectural audits and production build.

Security/deployment details and exact results are in `docs/audit-log/ARCHITECTURE.md` and `docs/audit-log/VERIFICATION.md`. This is a Draft for review; migration has not been applied to production. Storage blob changes remain separate from SQL transactions; notification intents do not send external mail; database owners are outside the append-only threat boundary. Staging verification and operational retention/performance review are required before production.
