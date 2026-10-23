Preserve unsent exam answers across refresh/network failures with account/attempt-scoped local recovery and independent tab copies. Continue to reconcile server-owned attempts and confirmed submissions; recovery never resets a deadline or supplies a score.

Migration 0030 freezes private question/key versions per attempt, preserving question reads and grading after bank edits/deletions. Regression tests failed before the fix. Snapshot failure rolls back attempt creation. Drain active attempts before rollout: historical original versions cannot be reconstructed.

27 focused Vitest and 20 exam SQL tests pass. See docs/phase3/EXAMS.md and final verification evidence. This is a separate PR from security migration 0029; both are needed for release. Keep Draft, no production migration/automatic merge. Vercel Python size issue is deferred.
