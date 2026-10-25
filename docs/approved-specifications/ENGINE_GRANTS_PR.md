## Behavior

Complete approved decisions11–14/34 within the existing engine permissions application: scoped student search with immutable9-digit numbers, responsive student profile beside active/history permissions, atomic multi-engine grants for one student, optional enrollment-lifetime access and individually audited revocation.

New0043 supports nullable expiry without synthetic far-future dates, trusted revocation causes, server-derived history states, and current-role/major/owner/enrollment checks. Existing finite-expiry API and366-day limit remain compatible. Private shared mutation code and deterministic batch ordering preserve retry idempotence and required audit rollback. Revocation locks the parent course before the grant to match assignment invalidation. Historical unknown reasons remain unknown.

## Verification

- 2036 Vitest/236 files,24 focused subset;36 Python;8 architecture guards;workspace TypeScript/audits/build pass.
- 52 local PostgreSQL university tests plus student-number immutability; seven new workflow/concurrency cases.
- 57 real local GoTrue JWT/PostgREST tests, including four new grant cases.
-Three Chromium HTTP-fixture scenarios: Arabic mobile instructor, English desktop instructor and admin review; search/input widths, profile, batch grant, manual revoke and active/history tabs.
-Combined database snapshot with independent attendance0042:58 university and44 academic tests pass. This is not a branch merge or hosted validation.

## Review boundaries

Draft; do not merge or apply SQL automatically. Based on main06cabec after PR37/38; independent of feature/approved-attendance-reports.0042 belongs to that branch,0043 to this one. No engine algorithms, Quick Access duplication, student renumbering, historical migration changes or production writes. A shared legacy HTTP-test correction is identical to the attendance reporting branch.

Hosted Staging, production migration ledger/lock impact and institutional-scale search tests remain PENDING. Vercel Python size is deferred. See docs/approved-specifications/ENGINE_GRANTS.md and PROGRESS.md. The progress table is cumulative across review branches, not a claim that all71 decisions are deployed.72–80 excluded.
