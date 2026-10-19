Add an independent academic catalog while preserving existing courses as stable section rows. Migration 0027 backfills one definition per historical section, adds explicit definition/section metadata and an invoker-secured course_sections compatibility view. IDs, URLs, enrollments, results, content, ownership and audit survive unchanged; matching codes never merge data.

Verified locally: 12 new PostgreSQL architecture tests, 26 audit +16 exam +9 course deletion tests, 1819 Vitest, 29 Python, eight boundary guards, workspace TypeScript/architecture checks/build. Audit regression expectations reflect immutable section IDs and include the new catalog table; no disabled tests. See docs/phase2/ACADEMIC_MODEL.md.

Dependent syllabus/permissions work is separate. No production migrations/writes. Staging, actual 0025/0026 deployment verification and real Supabase JWT/PostgREST checks PENDING. Keep Draft, do not merge or waive CI/Vercel.
