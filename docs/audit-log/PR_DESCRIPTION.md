## Trusted centralized audit log

Instructor edits/deletions now create transaction-bound database evidence visible to Admin; administrative/access changes are reserved for Super Admin. Application principals cannot forge, edit or delete audit events. An event-insertion failure rolls back the sensitive operation.

- Migration 0022 adds protected event storage, actor-role locking, explicit privacy allowlists, immutable triggers, indexed RLS-filtered keyset search and a separate critical notification-intent ledger with server-only repair.
- Covers existing courses, materials, exams, questions, enrollments, syllabus units/sections and role/major changes without adding domain privileges or new administration workflows.
- Adds a discovered API-2 application at `/audit-log`, bilingual read-only review, filters, bounded server pagination and before/after details. Existing engine catalogs/dashboard contributions remain unchanged.
- Adds real disposable PostgreSQL SQL/RLS, concurrency and rollback tests, plus repository/UI and role-routing tests.

Verification passed: 1670 Vitest tests, 29 Python tests, 25 isolated PostgreSQL tests plus user-number SQL checks, eight architecture-check tests, workspace TypeScript, architectural audits and production build.

Security/deployment details and exact results are in `docs/audit-log/ARCHITECTURE.md` and `docs/audit-log/VERIFICATION.md`. This is a Draft for review; migration has not been applied to production. Storage blob changes remain separate from SQL transactions; notification intents do not send external mail; database owners are outside the append-only threat boundary. Staging verification and operational retention/performance review are required before production.

## Security follow-up

Review reproduced and fixed (1) demoted instructors retaining material/exam/question write access under legacy ownership-only policies, (2) unrecorded primary-key/timestamp-only mutations and (3) free-text major/difficulty leaking into stored evidence. Migration 0022 adds restrictive write-role checks, complete domain field classification, and redaction. The exam/question delete handlers also now surface failed database results without success state updates; six regressions cover failure, success and cancellation. Nine additional SQL tests cover these and security-definer shadowing, both role-lock orderings, cascade rollback and account deletion retention. Browser mutation tests now assert permission rejection explicitly.

See `docs/audit-log/SECURITY_REVIEW.md` for negative controls and exact results. Keep this PR Draft pending real isolated Supabase staging validation of JWT/session/default-grant behavior and end-to-end roles. No production migration was applied; historical migrations and unrelated runtime features are unchanged.
