## Behavior

Complete approved decisions7/33 in the existing Y-Attendance module: six role-aware tabs, server-filtered reports/statistics and a 30-activity-date chart, Excel and native print-to-PDF export, preserving CSV and existing lifecycle/correction controls.

New0042 adds an authenticated, current-role scoped reporting RPC with explicit safe projection. Students see only their own historical records. Reports/exports use the same filters and checksum across pages, abort on inconsistent results, failures or account/context changes, and cap downloads at10,000 records. Native PDF uses the browser’s Save as PDF dialog, searchable Arabic text and safe DOM construction.

## Verification

- 2046 Vitest/237 files,36 Python,8 architecture guards, workspace TypeScript/audits/build pass.
- 51 local PostgreSQL university cases plus student-number immutability assertion; six new cases failed before0042 and pass afterward.
- 56 real local GoTrue JWT/PostgREST integration cases pass, including8 attendance cases.
- Two Chromium fixture scenarios: Arabic mobile/dark and English desktop/light; lifecycle, six tabs, statistics, XLSX download and PDF printing. Generated PDF text verified separately.
- The pre-existing HTTP audit test expected a now-forbidden excused write. It now verifies rejection, then binary correction, redaction and transactional audit failure; production behavior was not weakened.

## Deployment boundaries

Draft; do not merge or apply migrations automatically. Based on main06cabec after PR37/38. Only new0042; historical SQL and math/Sheets/Quick Access untouched. Hosted Staging, production migration ledger and large institutional data load tests remain PENDING. Vercel Python size remains deferred. Details/file inventory: docs/approved-specifications/ATTENDANCE_REPORTS.md; all71 decisions: PROGRESS.md.72–80 excluded.
