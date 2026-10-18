# Workstream A — reliable submissions and authoritative attempts

Base: main `57f3103b273285c27802e35f47189e16a8318035`. Branch: `feature/exam-attempt-integrity`. **IMPLEMENTED — STAGING PENDING**. No production writes or migration application.

## Proven failures and fixes

The pre-change regression `submission.test.tsx` failed because an RPC error left isSubmitted=true. Submission now transitions editing → submitting → submitted only for a validated server result; errors transition to failed with answers retained. A synchronous mutex blocks repeated clicks. Every attempt to submit first reads server status, so a response lost after commit reconciles without replacing the stored answers. Invalid/missing result IDs, scores and state payloads fail closed. Generation guards discard responses after route/account changes. A second seeded regression proved a delayed clock synchronization could overwrite confirmed success; version guards now discard it.

The previous timer restarted from the exam duration in browser memory. Migration **0025_exam_attempt_integrity.sql** creates unique `(exam_id,student_id)` server-owned attempts. start_exam_attempt resumes the same attempt across refresh/devices; get_exam_attempt returns UTC server_now and deadline; submit_exam locks the attempt and preserves the existing unique result constraint. Old submit_exam's signature remains, but a timed attempt must now have started. All frontend consumers migrate together. An old frontend cannot bypass timing: its submission is rejected without an attempt.

Students must start the server clock before get_exam_questions returns questions. Current owner instructors/admins/super admins retain question authoring access, without exposing answers via this RPC. No client-provided score is accepted. Existing case-insensitive exact-string grading is unchanged.

## Timing and expiration policy

- The server snapshots a positive configured duration at first start. Later duration edits do not extend an existing attempt.
- The display uses server UTC times, request duration and monotonic performance.now; it resynchronizes every 15 seconds and on focus/visibility/online. Browser changes cannot change the database deadline.
- submit_exam uses clock_timestamp after lock waits/grading, not transaction-start now(). Submission must reach this check strictly before the deadline; there is no implicit offline/network grace period.
- Expiry returns `expired` with **no result**; it does not fabricate or auto-grade unsaved answers. The expired row persists because this is a successful status response, not an exception rolled back with the transaction. No administrative reopening feature is added.
- Historical results remain unchanged and resolve as submitted without inventing start timestamps. First deployment cannot recover the start time of an already open legacy browser exam. Deploy outside active exams with explicit operational notice; do not claim transparent mid-exam rollout.
- Answers survive a failed submission in the current mounted UI. This work does not add browser-persisted exam drafts; refreshing before successful submission can lose unsaved answers while the original deadline still applies. Account changes deliberately clear the prior account's local state.

## Security and transaction review

Private helpers use SECURITY DEFINER with an empty search_path and fully qualified tables. No public/anon/authenticated/service-role execution on private helpers; public wrappers are authenticated only and check auth.uid, current student role, publication and active enrollment. Role/exam/enrollment row locks serialize revocations with the admitted operation. A revocation committed before the locks is rejected; a later one waits. Deadlocks fail the transaction and are retryable, not a reason to weaken locking. Direct client attempt writes and student-result writes are revoked; result ownership read policies remain.

Concurrent start has one unique row; concurrent submit serializes on that row and re-reads the committed result after waiting. Lost acknowledgments and repeats return the original result. A failed result insert rolls back both result and state. Server time is rechecked after question lock waits. The existing question-update policy and grading semantics are retained: this is not an immutable question-version archive. Staff should not modify live official exams; snapshot/version policy is a separate product decision.

The new attempt → exam FK uses cascade only for the newly introduced operational attempt rows, consistent with existing result → exam behavior; no existing retention relationship or historical FK is changed. Audit triggers remain unchanged and their complete isolated suite is rerun. No claims of protection against the database owner/superuser.

## Verification evidence

- Seeded original regression: 1 failed (isSubmitted remained true). Seeded delayed-clock regression: 1 failed / 12 passed before the version guard. Both pass in the final suite.
- Focused final exam feature: 17 tests (including 2 existing format tests).
- Isolated PostgreSQL: **16 passed**, including concurrent start/submission, actual post-lock expiry, changed duration, revoked enrollment/role, missing session, historical results, direct write denial, staff access, grading, and rollback/retry after storage failure.
- Existing isolated Audit Log: **26 passed**, plus immutable student-number assertions.
- Full workspace verification: **1,805 Vitest tests / 203 files**, **29 Python tests**, **8 module-boundary guard tests**, complete workspace TypeScript, architecture/math/module checks and production build all passed. No failed or skipped tests in final runs; large-chunk build warnings remain. `git diff --check` passed.

Real Supabase JWT/PostgREST/browser/device integration is **PENDING**, confirmed unavailable by the user. Apply new migration only in authorized staging first; separately approve production migration. Verify UTC deadlines, refresh/relogin, two devices, dropped responses, revocations and deployment of matching frontend/RPC contracts. No production-readiness claim.
