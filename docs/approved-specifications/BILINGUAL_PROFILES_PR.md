## Approved decision25: Arabic and English profile names

Signup now collects both names and validates them in the database transaction. Existing accounts retain their original name and nine-digit number; an own-profile completion RPC fills missing translations with row locking, idempotent retries and terminal HTTP409 conflicts. Stored names remain read-only through the application. Account identity follows the interface language with compatible fallbacks.

The existing Auth flow, profile forms, dashboard/header identity and all role/major/RLS restrictions are preserved. New migration0044 only; no production application. Auth metadata updates cannot replace the stored names. Local HTTP tests caught PostgREST retrying SQLSTATE40001; the final implementation uses PT409.

Deployment requires coordinated migration/client rollout: cached old signup clients lacking both names will be rejected. Hosted Supabase/SMTP staging is PENDING. Do not merge or deploy automatically. Keep this PR Draft. Details, exact verification and file inventory: `docs/approved-specifications/BILINGUAL_PROFILES.md`.

Attendance reports, grants and breadcrumbs are separate review branches and are not merged here. The cumulative71-decision table records their progress;72–80 remain excluded. Vercel Python bundle-size issue stays deferred.

Verified:2048Vitest/237files,36Python,8architectureguards,workspaceTS/audits/build PASS;165directSQL tests +14historicalRLS assertions;58actual localAuth/HTTP tests;3fixture browser scenarios. Combined0042+0043+0044 snapshot:58universitySQL tests PASS. Zero final failed/skipped tests; superseded40001 and fixture failures documented.
