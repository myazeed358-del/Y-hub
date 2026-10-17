# Confirmed delete results and Vercel evidence — PR #16

Resumed from verified branch/PR head `3c205833c25e27433dbf3b0fb9f54fb8cce2685b`. The previous four security fixes remain intact. No migration, domain policy or unrelated feature changes in this follow-up.

## Delete result correction

PostgREST can return `error: null` with zero deleted rows, both when RLS hides the target and when the target does not exist. The exam/question handlers now use `.delete().eq('id', id).select('id')` and advance UI state only when there is no error and exactly one returned ID matches the requested ID. A zero-row result displays the same generic failure as a database error, preserving selected exam and avoiding a success reload. The UI intentionally does not distinguish missing from unauthorized records or reveal database error details.

Ten parameterized handler tests cover each of the two entities: RLS-hidden empty response, missing-row empty response, actual PostgreSQL error response, successful matching returned ID and cancelled deletion. A new real PostgreSQL test additionally exercises DELETE RETURNING for both tables: unauthorized actor returns zero IDs without SQL error; absent ID returns zero IDs; injected mandatory audit failure rolls back the deletion; authorized deletion returns the exact ID and creates its audit event. This complements, rather than replaces, mocked PostgREST-response tests; actual PostgREST/JWT flows remain a staging gate.

## Vercel investigation: evidence, not attribution

The public GitHub deployment panel explicitly associates a failed Preview deployment with **3c205833**:

- https://github.com/myazeed358-del/Y-hub/pull/16/partials/deployments_box — fetched HTTP 200; reports one failed Preview deployment at 3c205833.
- https://vercel.com/yhup/y-hub/8RXuNuP7EZzBFPYtMK62KtjmFGjj — failure link in Vercel's PR comment, updated 2026-10-17 14:19 UTC (17:19 Asia/Baghdad).
- https://github.com/myazeed358-del/Y-hub/commit/3c205833c25e27433dbf3b0fb9f54fb8cce2685b/checks — HTTP 200; the separate **Vercel Preview Comments** check succeeded (“No unresolved feedback”). That is not a successful deployment check.
- https://github.com/myazeed358-del/Y-hub/pull/16 — public HTML confirms **Draft** status during this review.

Requests to the exact commit's GitHub status and check-runs API endpoints returned Forbidden. Fetching the linked Vercel deployment was blocked at the CONNECT tunnel with HTTP 403. Therefore the build log/error message is unavailable here; the deployment's root cause is **not determined**. The user was asked for the build error text while independent implementation/verification continued.

Compared main `9057222` to `3c205833`: neither Vercel config, Python/API source nor pnpm lockfile changed. This narrows the diff but does not prove why the deployment failed. Successful local Vite builds do not reproduce Vercel's packaging/runtime/project settings. In particular, the historical Python bundle-size limitation is **not attributed to this deployment without its log**. No deployment configuration was changed or deployment retried based on speculation.

## Review gate

Keep existing PR #16 Draft. No merge, production migration or production data operation. After obtaining the deployment error and resolving the PR-description API access blocker, proceed to separately authorized isolated Supabase staging with Instructor, Admin and Super Admin accounts. Do not claim this local suite exercises actual Supabase JWT/PostgREST or Storage.

## Final verification

1674 Vitest tests / 186 files (76.27s), 29 Python tests (1.271s), 26 isolated PostgreSQL tests (26.578s) plus immutable user-number SQL checks, eight boundary-check tests, workspace TypeScript, all architecture audits and production build (44.12s) passed. Both complete scripts exited 0; no failed/skipped tests in final runs.

Logs: `/tmp/yhub-delete-result-full.log` and `/tmp/yhub-delete-result-sql.log`. Existing PDF.js, large-chunk and Starlette/httpx warnings remain. `git diff --check` passed.

PR body update was attempted with `gh pr edit 16 --repo myazeed358-del/Y-hub --body-file docs/audit-log/PR_DESCRIPTION.md`; GitHub GraphQL returned Forbidden. The updated description is committed but has not been applied to GitHub's PR body. Branch push updates code/evidence only. API access and Vercel build error text are the remaining external blockers; no replacement PR or ready/merge action is authorized.
