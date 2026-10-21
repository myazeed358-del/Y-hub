Complete manually authored, section-specific syllabus editing and student viewing with bilingual UI, transactional revision-checked saves, audit integration and database-enforced academic access. Migration 0028 narrows instructor cross-section reads, applies catalog-major rules to discovery/new enrollment, preserves active historical enrollments and prevents reused audited section IDs.

The final security regression demonstrated a demoted, enrolled former owner could still read answer keys and another student's result. Restrictive question/result SELECT now checks the current DB role, preserving personal historical results and the safe timed exam RPC. The regression fails before the fix and passes afterward.

Depends on feature/academic-course-sections (0027); target that branch for a focused review. Composition uses feature public exports/render slots; no boundary check was relaxed. No AI parser, exceptional engine-grant feature or production migration is introduced.

Verification: C full suite 1843 Vitest; combined exported A+C UI source 1855 Vitest /211 files, 29 Python, eight boundary guard tests, workspace TypeScript/audits/production build PASS. After the SQL-only security correction, all 91 isolated PostgreSQL tests pass (30 academic, 26 audit, 16 exams, nine course deletion, ten Y-Sheets), plus historical SQL assertions. Both Chromium scripts pass, including 16 fullscreen geometry cases and manager/student syllabus editing/conflict/read-only scenarios.

See docs/phase2/SYLLABUS_PERMISSIONS.md and FINAL_REPORT.md for final test evidence and limitations. Local SQL is real PostgreSQL with platform auth stand-ins; browser HTTP is synthetic. Actual Supabase staging and production migration status remain PENDING/UNKNOWN. Keep Draft, do not merge or waive CI/Vercel.
