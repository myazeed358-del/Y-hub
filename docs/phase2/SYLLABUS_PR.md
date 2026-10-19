Complete manually authored, section-specific syllabus editing and student viewing with bilingual UI, transactional revision-checked saves, audit integration and database-enforced academic access. Migration 0028 narrows instructor cross-section reads, applies catalog-major rules to discovery/new enrollment, preserves active historical enrollments and prevents reused audited section IDs.

Depends on feature/academic-course-sections (0027); target that branch for a focused review. Composition uses feature public exports/render slots; no boundary check was relaxed. No AI parser, exceptional engine-grant feature or production migration is introduced.

See docs/phase2/SYLLABUS_PERMISSIONS.md and FINAL_REPORT.md for final test evidence and limitations. Local SQL is real PostgreSQL with platform auth stand-ins; browser HTTP is synthetic. Actual Supabase staging and production migration status remain PENDING/UNKNOWN. Keep Draft, do not merge or waive CI/Vercel.
