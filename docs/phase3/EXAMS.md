# Phase 3 — exam reliability

Independent branch `feature/phase3-exam-reliability`, main base `8a5dde1`. No existing timer, submission idempotency or result history is replaced. Security migration 0029 belongs to its separate PR; include both before release.

## Proven failures and fixes

Before 0030, editing an active question changed the student-visible question and changed the grading key (the new tests observed Changed instead of test, and zero instead of three points). Two SQL negative controls failed against 0028. New 0030 stores private per-attempt question versions including the server-only key; question UUIDs have no FK to the mutable bank. Student question RPC and submit grade use that version. Authoring RPC behavior stays current. An exam-parent lock coordinates bank mutations and snapshot capture; deadlocks abort safely and require retry. No answer key is exposed by the student RPC or via table grants.

Snapshot creation is transactional with attempt creation: a forced snapshot insert failure leaves no attempt. Existing active attempts have no recoverable original version; migration takes their deployment-time question bank. **Drain active attempts before rollout**, and inspect historical active attempts in staging. Existing submitted results are never recomputed. Old unpublished/expired access rules and server-owned time remain authoritative. The deadline-wait regression now blocks the actual attempt lock rather than the mutable question bank, preserving its purpose under immutable grading.

Answer recovery is scoped to account + exam + server attempt. Each editor writes a separate local journal slot synchronously before rendering, so refresh and concurrent tabs cannot silently overwrite each other. A new mount restores the latest local copy and offers explicit selection if multiple copies exist. No score or client deadline is stored. Failed/uncertain submissions and expired sessions preserve copies; only server-confirmed submission cleans that exact scope. Size/quota/corruption failures keep in-memory answers, preserve existing records, show a warning and guard navigation/refresh. A 64-editor limit fails visibly instead of evicting unsaved work.

Recovery is **local device storage, not cloud answer synchronization**. Multiple devices share the server attempt/deadline and exactly-once result, but not unsent answer drafts. Device loss/cleared storage cannot be recovered. On a shared browser, account scoping prevents application cross-account restore but does not encrypt storage against same-origin script/XSS or a device owner. Offline refresh preserves records; reconnection and valid authorization are needed to load the server question version and resume. Expiry never extends the deadline.

## Verification

27 focused Vitest tests PASS, including ten added recovery cases (refresh, account/attempt isolation, failed save/confirmation, independent tab copies, quota, corrupt/forged/oversized records). 20 exam PostgreSQL tests PASS including four new snapshot cases, concurrent starts/submissions, deadline waits and session/role/enrollment revocation. Additional complete suite and integrated HTTP evidence are in the final Phase 3 report. No tests disabled and no historical migrations edited. Logs `/tmp/phase3-exams-{before,after,full}.log`, `/tmp/phase3-exam-ui-final.log`.

No production writes/migration. Real staging rollout/device/session tests remain pending. Known deferred: Vercel Python deployment bundle size, untouched.

Full branch verification PASS: **1865 Vitest /212 files, 29 Python, eight architecture guard tests**, complete workspace TypeScript/architecture/math/module checks and production build. **95 PostgreSQL tests PASS** (30 academic +26 audit +20 exams +9 course deletion +10 Y-Sheets), plus historical SQL assertions. Full log `/tmp/phase3-exams-full.log`; SQL logs `/tmp/phase3-exams-{academic,audit-log,after,course-deletion,y-sheets}.log`.
