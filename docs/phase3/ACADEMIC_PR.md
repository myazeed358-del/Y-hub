Complete practical catalog/section management on the existing 0027/0028 model: bilingual staff UI, catalog creation, linked sections, instructor assignment with expected-owner conflict detection, section term/label, and scoped roster/count display. Stable IDs and child relationships are preserved.

New migration 0031 provides narrow audited RPCs with database role checks and idempotent creation. The API-v2 manifest discovers the application automatically, without adding it to engine catalogs. Existing roster service is shared through a compatibility export.

1873 Vitest, 29 Python, 99 PostgreSQL, eight boundary guards, workspace TypeScript/architecture/build PASS. See docs/phase3/ACADEMIC.md for evidence and limits. Keep Draft; no production migration or automatic merge. Vercel Python bundle size is a known deferred issue.
