Add Y-Attendance as an automatically discovered education application. Instructors schedule section lectures, open/close attendance, display server-signed QR rotating every10 seconds, correct attendance with audited reasons and export reports. Students confirm with active enrollment and review their own historical records and absence rate.

Database RPC/RLS authorization, private QR secrets, current-role checks, duplicate prevention and atomic audit failures are covered by isolated tests. No new course model or engine edits. Migration0035 depends on0033 via the feature branch; base is `feature/exceptional-engine-access`. Quick Access remains a separate branch.

Verification and explicit limitations: [ATTENDANCE.md](docs/university/ATTENDANCE.md). Hosted staging/provider deployment is not claimed. Keep Draft; no main merge or production migration.
