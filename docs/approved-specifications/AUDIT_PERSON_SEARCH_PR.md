## Problem and behavior

Approved decision24: audit reviewers could not find affected people by name/number, see scoped suggestions or know the filtered total. The existing audit page now supports actor/affected/either search, localized immutable identities, safe suggestions and server-side totals with cursor pagination.

Additive0045 captures identity companions in the same required audit transaction, protects them with parent-event RLS and append-only permissions, and exposes invoker-only scoped read RPCs. Admin cannot discover Owner-only identities even through suggestions/counts. Previous audit APIs, roles and notification behavior remain compatible. Cached UI details clear when account/role changes.

## Validation

-2111Vitest/242files;36Python;8architecture guards;workspaceTypeScript/boundaries/build PASS.
-192PostgreSQL tests +14legacyRLS assertions and immutable-number checks PASS. Includes one real concurrent migration test proving in-flight old writes are backfilled and queued writes use new capture.
-70real localAuth/JWT/PostgREST integration tests PASS, including5new audit cases.
-2Chromium scenarios PASS:mobileArabic/dark/Admin anddesktopEnglish/light/Owner. Browser APIs use fixtures; nativeHTTP tests are separate.
-Final failures:0. Existing build/dependency warnings unchanged. VercelPythonbundle limit remains deferred.

## Rollout / limits

No production SQL/deployment or main merge. Apply0045 before the new frontend only after separate authorization. The migration locks audited writers through backfill, with10s lock-acquisition timeout: measure it on representative-volume Staging and plan a maintenance window. Historical missing names/relationships are explicitly unknown; legacy lookups are labelled, not claimed to be snapshots. Exact counts/substring search need Staging load validation. Database owner/superuser is outside application append-only protection.

Hosted Staging verification remains PENDING. Decision69's new read/retention model is not part of this package. Full evidence and file list:docs/approved-specifications/AUDIT_PERSON_SEARCH.md. Keep this PR Draft until review.
