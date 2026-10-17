## Trusted centralized audit log

Instructor edits/deletions now create transaction-bound database evidence visible to Admin; administrative/access changes are reserved for Super Admin. Application principals cannot forge, edit or delete audit events. An event-insertion failure rolls back the sensitive operation.

- Migration 0022 adds protected event storage, actor-role locking, explicit privacy allowlists, immutable triggers, indexed RLS-filtered keyset search and a separate critical notification-intent ledger with server-only repair.
- Covers existing courses, materials, exams, questions, enrollments, syllabus units/sections and role/major changes without adding domain privileges or new administration workflows.
- Adds a discovered API-2 application at `/audit-log`, bilingual read-only review, filters, bounded server pagination and before/after details. Existing engine catalogs/dashboard contributions remain unchanged.
- Adds real disposable PostgreSQL SQL/RLS, concurrency and rollback tests, plus repository/UI and role-routing tests.

Verification passed: 1674 Vitest tests, 29 Python tests, 26 isolated PostgreSQL tests plus user-number SQL checks, eight architecture-check tests, workspace TypeScript, architectural audits and production build.

Security/deployment details and exact results are in `docs/audit-log/ARCHITECTURE.md` and `docs/audit-log/VERIFICATION.md`. This is a Draft for review; migration has not been applied to production. Storage blob changes remain separate from SQL transactions; notification intents do not send external mail; database owners are outside the append-only threat boundary. Staging verification and operational retention/performance review are required before production.

## Security follow-up

Review reproduced and fixed (1) demoted instructors retaining material/exam/question write access under legacy ownership-only policies, (2) unrecorded primary-key/timestamp-only mutations and (3) free-text major/difficulty leaking into stored evidence. Migration 0022 adds restrictive write-role checks, complete domain field classification, and redaction. The exam/question delete handlers also now surface failed database results without success state updates; ten handler regressions cover PostgreSQL errors, RLS-hidden/missing rows, success and cancellation. Ten additional SQL tests cover these and security-definer shadowing, both role-lock orderings, cascade rollback and account deletion retention. Browser mutation tests now assert permission rejection explicitly.

See `docs/audit-log/SECURITY_REVIEW.md` for negative controls and exact results. Keep this PR Draft pending real isolated Supabase staging validation of JWT/session/default-grant behavior and end-to-end roles. No production migration was applied; historical migrations and unrelated runtime features are unchanged.

## Confirmed DELETE outcomes and deployment evidence

Exam/question deletion now requests `.select('id')` and requires exactly the requested row ID before clearing selection or reloading as success. Zero-row responses with `error: null` are treated as failures without distinguishing unauthorized from missing rows. Real SQL DELETE RETURNING tests cover both tables, including required-audit failure rollback.

PR #16 is confirmed Draft via public GitHub HTML. The deployment panel confirms Vercel Preview failure for `3c205833` and links https://vercel.com/yhup/y-hub/8RXuNuP7EZzBFPYtMK62KtjmFGjj. The separate Preview Comments check succeeded. Deployment-log access is blocked by the environment; the root cause is unconfirmed, and is not attributed to Audit Log or the old Python bundle-size issue. See `docs/audit-log/DELETE_RESULT_REVIEW.md` for evidence and current test results. Keep Draft pending deployment-log review and isolated Supabase staging; no production migration was run.
