## Problem and behavior

Main lacks the academic RPCs used by its existing native integration suite (15/21 failures), and legacy course INSERT RETURNING is rejected by a STABLE visibility lookup. This restores the previously developed academic-management module against the current 0027/0028 model and completes approved decision **1**: scoped Attendance/Online lectures links from course management and authorized section lists.

- API v2 application discovery, bilingual staff UI, definitions/sections/instructor assignment, existing student roster and numbers; no duplicate course model or engine registration.
- New **0041** only: current-role checks/locks, idempotent creation, assignment CAS, atomic existing audit, terminal PT409 syllabus conflicts, corrected row-local staff SELECT check. Student visibility predicate preserved.
- Existing Y-Sheets0037, math engines, Quick Access and historical migrations unchanged.0040 belongs to the independent unmerged attendance branch; neither branch has been merged/deployed.

## Validation

- 2018 Vitest/234 files;146 focused tests are a subset.
- 36 Python;8 architectural guard tests;workspace TypeScript, architecture/math/module checks and production build pass.
- 44 local PostgreSQL academic tests plus student-number immutability assertion.
- 48 real local GoTrue JWT/PostgREST/PostgreSQL tests:23 general,20 Tutor,5 Y-Sheets.
- 3 Chromium fixture scenarios: Arabic mobile Admin, English desktop Instructor, denied Student.
-Combined SQL snapshot0040+0041:44 academic and45 university tests pass. This is a database compatibility check, not a branch merge or hosted validation.

## Review/deployment boundaries

Draft for review; do not merge or apply SQL to production automatically. Hosted Staging, production migration ledger, real Storage/Edge/AI/LiveKit remain PENDING. Review migration order before deploying both branches; do not replay old0032 over0037. AttendancePage changes need reconciliation when reviewing both independent branches. Vercel Python bundle size remains a known deferred issue.

See docs/approved-specifications/ACADEMIC_INTEGRATION.md for file inventory, evidence, resolved failures and risks; PROGRESS.md tracks all71 decisions across both review branches. Decisions72–80 were not implemented.
