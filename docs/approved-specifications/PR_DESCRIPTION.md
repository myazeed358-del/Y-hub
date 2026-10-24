## Timed attendance with fixed session eligibility

Attendance previously used a fixed ten-second QR and the lecture end time, required a correction reason, blocked instructor corrections after seven days, and let late enrollees change the session denominator. This change implements approved decisions **2,3,5,6,8,10,35,36**, preserves **9**, and advances **4,37** without rewriting historical excused/eligibility records.

Add server-authorized 1–120 minute sessions, independent 10–120 second QR rotation, bounded extension, early closure and independent cancellation. Freeze the eligible roster at session creation; preserve withdrawn students' own history and show their existing nine-digit Y-Hub numbers. Binary corrections need no reason and remain audited. Logical expiry is enforced by database time in RPCs/read models; raw stored `state` alone is not the effective-state API. No scheduler is required for authorization or final absence counts.

New migration **0040** only, locally tested; no historical migration edits or production application. Preserve existing module/route, course model, engines, Quick Access, themes and Y-Sheets. Read `docs/approved-specifications/ATTENDANCE_PHASE1.md` for the exact expiry contract, legacy limits and deployment order; `PROGRESS.md` audits all71 decisions (72–80 excluded).

Validation: **2002 Vitest/230 files** (13 attendance), **36 Python**, **8 architecture guards**, workspace TypeScript/audits/build, **45 isolated PostgreSQL tests**, **5 native local GoTrue/JWT/PostgREST attendance tests**, **2 Chromium workflows** (Arabic/mobile/dark; English/desktop/light). Browser responses are fixtures; native HTTP uses real local services. Hosted staging remains pending.

Existing blocker, independently reproduced on unchanged main b41b448: the general Phase3 HTTP suite has **15 failures/21 tests** because its academic creation RPCs are absent from main's migration ledger. Its local fixture creation also exposes a courses return-representation RLS mismatch. This PR does not disable those tests or claim platform-wide integration is green. Repair that contract on a separate focused branch. Legacy attendance history cannot be reconstructed retroactively; reports/PDF/Excel/tabbed workspace remain separate tasks.

Keep Draft for review. Do not merge or apply production migrations automatically. Known Vercel Python bundle-size issue remains deferred and unchanged.
