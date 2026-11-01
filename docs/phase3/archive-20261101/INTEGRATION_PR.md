> Historical report from `0ebcbdd4b6f744a18eb7eddd7f3cd0228ae07a30`, preserved2026-11-01. Its branch status, test counts and deployment prerequisites describe that earlier checkpoint only. Current verification is in `docs/approved-specifications/MERGE_2026-11-01.md`.

Add disposable native GoTrue + PostgREST + PostgreSQL integration tests for all four roles, signed/expired/tampered JWTs, account refresh/logout, course catalog/sections/assignment, syllabus, exam versions/deadlines/concurrent submissions, Y-Sheets receipts/conflicts, and audit append-only/rollback behavior.

The source-export verifier combines the four independent Phase 3 implementation commits without Git merges. All final checks pass: 14 HTTP, 1886 Vitest /216 files, 29 Python, 112 PostgreSQL, eight architecture guard tests, complete workspace TypeScript/audits and production build. Tests exposed and drove the separate fix for PostgREST retrying application conflict SQLSTATEs.

No production operations, ports published, remote database URL or disabled tests. Keep Draft. Exact hosted Supabase configuration/Storage/browser staging remains PENDING; this is not production release approval. Details and changed-file inventory: docs/phase3/FINAL_REPORT.md and CHANGED_FILES.md. Known deferred Vercel Python bundle-size limit is intentionally untouched.
