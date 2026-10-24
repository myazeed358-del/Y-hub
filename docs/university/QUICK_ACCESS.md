# Quick Access: account preferences

The EXISTING StudentDashboardSidebar card now supports zero to three authorized routes, replacement, removal and reordering. No second card or parallel dashboard was introduced. Available tools come from server module policies plus the accepted API-v2 registry. Localization and existing theme tokens remain.

0034 depends on 0033. Student-only RPCs derive identity from auth.uid(), reject duplicates/unknown/forbidden routes, and use revision CAS plus a user transaction lock. Stale devices receive PT409; there is no blind overwrite. Empty selection persists distinctly from first-visit defaults. Read access is account-scoped; even administrators cannot read another student's personal preferences. Revoked tools are filtered on each read and disappear on focus or the 15-second refresh. Stored hidden preferences do not confer access.

An open editor keeps its original revision and draft through refresh, offline errors and unconfirmed saves. After lost acknowledgement the user refreshes and explicitly adopts the account version before retrying. These preferences are not document content: an unsaved editor is not persisted after page reload. Server authorization still runs independently of card visibility.

Verification: 1872 Vitest tests /215 files, 36 Python tests, 107 isolated PostgreSQL tests (16 university,30 academic,26 audit,16 exams,9 deletion,10 Y-Sheets), all workspace TypeScript, architecture/math/module boundaries, eight boundary guard tests and production build. Hosted Supabase/device testing remains PENDING. No production migration or main merge. Previous verified remote dependency: db0ae2d7b57efee2ed85621d8a3e9f2488abda02.
