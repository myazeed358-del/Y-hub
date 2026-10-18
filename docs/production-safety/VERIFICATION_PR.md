## Purpose
Revalidate the already-merged Y-Sheets PR #18 and record Phase 1 release evidence without rebuilding its completed implementation or merging any feature branch.

Add isolated PostgreSQL coverage for student/instructor/admin/super_admin workbook ownership and missing session identity. Add reproducible combined migration and exported-source verification helpers, plus the cross-stream evidence, security limitations and recovery handoff. No Y-Sheets runtime code, historical migrations or production data is changed in this branch.

## Verification
Y-Sheets baseline: 1,790 Vitest tests / 201 files, 29 Python tests, 8 boundary guard tests, complete workspace TypeScript/architecture/build passed. Workbook SQL: 10 cases + 14 historical RLS assertions. Real Chromium formula/draft, Excel worker, CSS/theme and mobile/desktop geometry passed. Combined 0025/0026 SQL: 61 cases passed across exam, course, audit and workbook suites. The separately exported combined-source suite also passed: 1,819 Vitest tests / 206 files, 29 Python tests, 8 boundary guard tests, complete workspace TypeScript/architecture/build. The final report records exact implementation SHAs; no Git branches were merged.

## Release gates
**Staging PENDING; no production readiness claim.** The user confirmed no independent staging exists. PR #18 is already merged; public HTML shows a Vercel error and 1/2 checks passed, with diagnostic logs/API access blocked. Real JWT/PostgREST/device flows, applied migration history, deployment diagnosis, remaining security advisories and unofficial XLSX provenance remain gates. Existing production check was only read-only auth health, HTTP 200.

See [final report](docs/production-safety/FINAL_REPORT.md), [Y-Sheets gate](docs/production-safety/Y_SHEETS_GATE.md), and [changed-file inventory](docs/production-safety/CHANGED_FILES.md). This PR must remain Draft; no automatic main merge or production migration.
