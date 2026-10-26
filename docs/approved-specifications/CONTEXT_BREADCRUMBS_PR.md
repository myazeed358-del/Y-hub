## Approved decision 32: contextual breadcrumbs

The header previously displayed a fixed `Y HUB / Academy` trail on every screen. Root pages now keep their title without a breadcrumb. Nested course, Tutor, exam and lesson pages show known context; future API v2 module ancestors are derived from the existing validated registry and UI access policy. Student Tutor links return to the course view; staff links use the existing management route. Raw IDs, query parameters and unknown path segments never become labels.

Arabic/English direction, keyboard links and current-page semantics are supported. Narrow screens show the nearest parent and current page; desktop shows the full trail. The page title and mobile menu remain visible. No SQL, authorization, mathematical algorithm, Y-Sheets or Quick Access changes.

Verification and operational limits: see `docs/approved-specifications/CONTEXT_BREADCRUMBS.md`. Browser tests use intercepted fixtures, not live Supabase. No production migration/deployment or main merge. Keep as Draft for review. Known Vercel Python bundle-size limitation is deferred.

The cumulative 71-decision table includes independently pushed attendance-report and engine-grant work; those implementations are not included in this branch. Decisions72–80 remain excluded.

Verified: 2049 Vitest /236files,36 Python,8 architecture guards,workspace TypeScript/audits/build PASS;291 focused tests are included in the total;4 fixture-backed browser scenarios PASS. No final failed/skipped tests.
