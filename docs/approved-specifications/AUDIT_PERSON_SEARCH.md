# Decision 24 — scoped audit people search

Date: 2026-10-28. Branch: `feature/approved-audit-person-search`.
Base and previously verified remote main: `79f0bdf3ee928db0055c52e8e4be7b304cf2458d`.
Only approved decision24 is implemented in this package; decisions72–80 remain excluded. Main already contains the preceding authorized consolidation. This package is for separate review, without another main merge or production deployment.

## Delivered behavior

The existing `/audit-log` APIv2 module now searches by actor, affected person, or either. Suggestions show localized names and unchanged nine-digit account numbers. A selected person is resolved by immutable UUID regardless of later display-name differences. Typed Arabic/English names and number fragments also work. Existing event/action/entity/date filtering and cursor pagination remain; the server returns a total across the filtered, authorized rows, independent of the current page. The UI fetches25 rows plus one lookahead, not all matching events.

Table and details display identity snapshots, localized names and LTR numbers inside Arabic RTL layouts. Suggestions debounce250ms and abort superseded requests. Switching the observed account/role destroys cached rows, suggestions and open details. This is UI hygiene; RLS is authoritative on each query. Already delivered data cannot be recalled from a browser, and role-change detection still follows the existing AuthContext lifecycle.

Affected people are explicit entity identities: account IDs on `users`, and old/new `student_id` / `instructor_id` on audited rows. This covers enrollment, attendance records, engine grants, lecture access blocks and instructor assignment as well as user access changes. A course edit does **not** invent individual affected-person events for every enrolled student. Actor and affected-person relations can both refer to one person without duplicating the audit event.

## Database and security review

New migration: `artifacts/y-hub/supabase/migrations/0045_audit_person_search.sql`. Historical migrations are unchanged.

- `audit_event_people` is an immutable companion to existing events. Names/numbers are snapshots, not joins that disappear when an account is deleted. There is no FK to live users. `event_id` references the append-only event with RESTRICT.
- Trigger-only private `record_people` takes IDs from the actual event/full OLD and NEW database rows. It runs inside mandatory capture before the notification exception handler; failure aborts the sensitive mutation and the event together. Original actor-role locking, redaction, no-op handling and notification retry behavior are preserved.
- Private helper is SECURITY DEFINER with an empty search_path and no execution privilege for PUBLIC, anon, authenticated or service_role. The existing trusted capture function is replaced without changing its identity or trigger argument lists.
- Table FORCE RLS follows visibility of its parent `audit_events`. Authenticated clients have SELECT only. Statement-level mutation blockers also reject ordinary owner mistakes; privileged database operators can disable/bypass such protection, so this is not absolute tamper resistance against database ownership.
- `search_audit_events_v2` and `suggest_audit_people` are SECURITY INVOKER, require the current database reviewer role, and query only RLS-visible data. Admin sees ordinary instructor events; Owner sees the broader current policy. Student/Instructor cannot read the central log. No open user-directory lookup is exposed. Decision69's different retention/read model is deliberately deferred.
- Suggestions, totals, direct companion reads and details all share event visibility. RPC EXECUTE is revoked from PUBLIC/anon. Search is parameterized/literal, with bounded query lengths, scopes, page sizes and cursor validation. No client-supplied actor identity is used to generate events.
- Old `search_audit_events` remains available with its old signature/semantics. New frontend requires0045; do not silently downgrade to unscoped search when deployment is incomplete.

### Safe upgrade and historical limits

Migration drains in-flight writers by locking all tables whose triggers invoke the existing capture function **before** replacing it/backfilling. Locking only `audit_events` would permit an already-running old trigger to resume after the backfill and omit companions. Locks are held to commit, with a10s acquisition timeout; lock contention/deadlock aborts the migration atomically for a later retry. Plan a maintenance window and measure backfill time before an approved production rollout. Reads continue under the selected lock modes; domain writes wait.

Existing events themselves are not modified. Historical companions use `recorded=false` and an explicit UI warning: original actor_name is retained; affected names may be current lookups, not historical names. The immutable number ledger can recover a deleted account's number only when unambiguous. Deleted legacy names or unchanged relationships omitted from old deltas cannot be reconstructed; display “Not recorded” instead of fabricated values. System activity has no invented human actor/number. New human snapshots retain names/numbers after deletion.

Names/IDs/numbers are intentional identity metadata for authorized reviewers; no email, phone, document content, token or password is added. The existing delta allowlist/redaction remains intact. Database transaction rollback cannot persist a denied-attempt event; no such claim is made. Storage deletion remains outside PostgreSQL transaction atomicity.

## Verification

All commands ran locally, with no production Supabase writes or migrations.

| Suite | Result |
|---|---|
| `scripts/verify-architecture-refactor.sh` | PASS:2111 Vitest /242files;36 Python;8 architecture-guard tests; full workspace TypeScript; strict architecture/math/module checks; production build |
| Audit feature Vitest |27 PASS, a subset of2111 |
| `scripts/test-audit-log.sh` |39 PostgreSQL tests PASS, including13 new identity/search tests; plus1 new real concurrent0044→0045 upgrade test |
| `scripts/test-academic.sh` |55 PASS |
| `scripts/test-university.sh` |58 PASS |
| `scripts/test-exam-attempts.sh` |20 PASS |
| `scripts/test-course-deletion.sh` |9 PASS |
| `scripts/test-y-sheets.sh` |10 PASS +14 legacy RLS assertions |
| PostgreSQL total |192 tests (39+1+55+58+20+9+10), plus14 legacy assertions and immutable-number checks |
| `scripts/test-supabase-http.sh` |70 PASS with real local GoTrue signup/JWT, PostgREST and PostgreSQL; includes5 new audit-identity cases |
| `scripts/test-audit-people-browser.mjs` |2 PASS:390px Arabic/dark/Admin and1280px English/light/Owner; actual route, React, labels, scopes, server-count rendering, details, LTR numbers and viewport bounds |

The browser harness intercepts every non-local request; it does not prove hosted Supabase integration. Local HTTP tests are separate and use real services, not authorization mocks. The final five audit HTTP cases were repeated after the final migration lock change; this rerun is a subset, not five additional unique tests.

Regression coverage includes role withdrawal with the same JWT; Owner-only identities absent from Admin rows/counts/suggestions; browser forgery/mutation/private-RPC denial; full-row enrollment targets absent from deltas; old/new assignees; concurrent writes; immutable deleted identities; legacy backfill; required-capture rollback; notification/cascade regressions; keyset disjointness and stable counts in an unchanged dataset; stale suggestion cancellation; account/role remount and safe text rendering.

One new UI test initially selected the test harness's `<output>` implicit status role instead of the error message. The selector was corrected to assert the actual safe error text; the final complete suite has zero failures. No tests were disabled. Existing PDF.js Node-build, Vite chunk-size and Starlette/httpx deprecation warnings remain. The known Vercel Python bundle limit remains deferred and uninvestigated.

## Files

- SQL:0045 migration; `supabase/tests/audit/test_person_search.py`, `person_legacy_seed.sql`, `audit-migration/test_upgrade.py`, `integration/test_audit_people.py`; audit test runner.
- Feature: existing AuditLogPage, AuditEventDetails, domain contract/copy, hook, repository and tests; new AuditPersonIdentity, AuditPersonSearch and component tests. No second module or audit page.
- Browser: `scripts/test-audit-people-browser.mjs`.
- Docs: this report, PR body, PROGRESS, AGENT_HANDOFF, REFACTOR_PROGRESS.
- No math engines, Y-Sheets implementation, shared authorization policy, historical SQL or Vercel configuration changed.

## Deployment and remaining work

1. PENDING: inspect the real migration ledger; approve a maintenance window, backup and SQL rollout separately. No production operation was executed.
2. PENDING: representative-volume backfill/load tests and EXPLAIN on Staging. Exact totals and case-insensitive substring suggestions can scan many authorized events; indexes support IDs/numbers, and counting materializes only event IDs/timestamps instead of full JSON. No unmeasured latency or scaling claim.
3. PENDING: hosted Staging with real Instructor/Admin/Owner accounts, token refresh/revocation and UI integration. Local GoTrue/PostgREST success does not substitute for hosted configuration verification.
4. Apply0045 before publishing the updated frontend when authorized. Existing clients can continue using the old read RPC. Do not drop audit history to roll back UI; a UI rollback can leave additive database objects in place.
5. Next approved package: repair legacy syllabus display26, then lesson completion27/41, with independent branches and real enrollment enforcement. Do not recreate earlier completed attendance/grant/name/navigation packages.

GitHub API returned `Post "https://api.github.com/graphql": Forbidden`; an attempted elevated retry did not execute (cancelled). Git transport remains available. PR creation is not confirmed; use `AUDIT_PERSON_SEARCH_PR.md` for review creation when API access is available. Do not infer a PR number from a compare URL. Git history and `git ls-remote` establish the final pushed checkpoint.

## Git delivery evidence

Remote implementation checkpoint verified with `git ls-remote`: `5f69031c33163307a70076a47b1e00531c345ac5` (SQL commit `dab015a`, UI/docs commit `5f69031`). Draft PR creation was actually attempted with the committed body and returned `Post "https://api.github.com/graphql": Forbidden`; no PR was created or confirmed. This documentation commit records the previous verified SHA; Git/ls-remote establish the final one. Main remains `79f0bdf3ee928db0055c52e8e4be7b304cf2458d`.

Review creation link (not an existing PR): https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-audit-person-search
