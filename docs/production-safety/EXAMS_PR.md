## Problem and result
The exam UI previously marked an exam submitted before saving succeeded, and browser reload restarted its timer. This change confirms submission only from validated server state and adds durable, server-timed attempts without changing historical results or grading algorithms.

Migration 0025 adds unique attempts, authenticated start/status RPCs, locked/idempotent submission, server deadline enforcement after lock waits, and protected question access after start. Existing result uniqueness and audit behavior remain. The UI retains answers on failure, reconciles lost acknowledgments before retry, prevents double-click submissions and ignores stale synchronization/account responses. Expired attempts have no fabricated result.

## Verification
Original false-success regression and a delayed-clock race both failed before their fixes. Final: 1,805 Vitest tests across 203 files, 29 Python tests, 8 boundary guard tests, full workspace TypeScript/architecture/build passed. New isolated PostgreSQL: 16 passed; existing Audit Log: 26 passed plus immutable user-number assertions. No production writes/migrations.

## Release gates
**IMPLEMENTED — STAGING PENDING.** No staging exists (user-confirmed). Real JWT/PostgREST/device and deployment validation remains pending. Deploy the matching frontend/RPC together outside active legacy exams; previous browser-only start times cannot be recovered. Unsaved exam answers survive failed submissions in the mounted UI, not a browser refresh. Expiration is strict server rejection without implicit grace or automatic grading. Existing dependency/deployment failures remain gates, not waived checks.

See [baseline](docs/production-safety/BASELINE.md) and [design, tests and limitations](docs/production-safety/EXAMS.md). Draft review only; do not merge or apply production migrations automatically.
