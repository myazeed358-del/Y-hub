# Decision 69: retention controls and investigation holds

This package moves decision69 from missing to **partial**. It implements Owner configuration and investigation-hold metadata, not automatic retention deletion. No production migration, SQL write, deployment or deletion was performed.

The default is24 calendar months; the Owner can select12–60 months according to applicable legal obligations. Each update sends the loaded revision. Stale writes return HTTP409 without PostgREST's serialization-error retry behavior. Shortening requires a confirmation in the UI. The server always validates bounds and checks the actor's current database role under a row lock; JWT role metadata and caller-supplied identities do not grant access.

An Owner can place or release a hold from an event's details. Holds refer to existing events and retain revision history through immutable audit events. Duplicate unchanged saves do not create extra evidence. A shared policy-row lock serializes policy/hold mutations; any future purge must acquire that same lock before selecting candidates and exclude active holds. The foreign key currently restricts deletion even for a released hold until future maintenance explicitly handles it. Existing append-only event/people/notification triggers are unchanged; this migration adds **no deletion mechanism or privilege**.

Policy and hold storage lives in the private audit schema, has forced RLS, and has no browser/service grants. Only authenticated Owner-checked RPCs are exposed. Security-definer routines use an empty search path and explicit EXECUTE revocations. Policy/hold changes and actor identity snapshots commit atomically; audit failure rolls back the change. No free-text legal/investigation notes are collected. Owner-only audit events are searchable with localized action/entity filters. Other existing audit reader scopes remain unchanged.

The React controls clear on identity/event changes, abort reads on unmount, require reload after a failed/ambiguous mutation, validate responses, and never display raw database errors. The interface explains that scheduled deletion is not enabled. Arabic and English are supported.

## Verification

Implementation commit **31f2712**, PR48. PASS:2620 Vitest/280 files,36 Python,8 module guard cases, all workspace types, architecture/math/module guards, generated artifact and Vite build. Final audit suite43 cases, SQL48 cases (9 new), native Auth/PostgREST7 cases (2 new),3 Chromium scenarios. Arabic mobile screenshot reviewed. The all-in-one script passed through build, then its sandboxed FastAPI HTTP case hung; that process was stopped and all36 Python tests passed separately with the required local runtime permission. No tests disabled. Final app types and focused tests were rerun after localized filter labels.

Repeatable commands:

- `bash scripts/test-audit-log.sh`: isolated PostgreSQL16, all historical migrations, populated0045 upgrade, audit/RLS tests and user-number regression. New cases cover boundaries, concurrency, forgery, privileged-role exclusions, lifecycle/no-op/stale holds, transaction rollback and required-evidence failure.
- `python -m unittest discover -s artifacts/y-hub/supabase/tests/integration -p 'test_audit_people.py' -v`: real local GoTrue JWT and PostgREST; verifies Owner writes,409 conflicts, other-role/anonymous rejection and immediate demotion with the same JWT.
- Vitest audit-log suite: repository validation/cancellation, confirmation, invalid bounds, conflict reload, hold lifecycle, identity cleanup and Owner-only controls.
- `scripts/test-audit-people-browser.mjs`: synthetic HTTP with all external requests intercepted; Arabic390 Admin/Owner and English1280 Owner. Exercises retention confirmation and holds as well as people search. This is not production RLS evidence.
- `scripts/verify-architecture-refactor.sh`: required workspace types, guards, tests, artifact drift and build.

## Deployment and remaining work

Migration `20261128032953_audit_retention_controls.sql` was created with Supabase CLI2.89 `migration new` and applied only to disposable local fixtures. Current Supabase changelog/functions guidance was reviewed (including CLI3 and production-branch merge changes). It follows existing0022/0045 audit dependencies; it must not replace or reapply registered migrations. A fresh read-only `list_migrations` check on2026-11-28 confirms54 registered migrations, still through logical0056. [Inventory](AUDIT_RETENTION_MIGRATION_INVENTORY.json). The new migration is absent; the6 previously pending local migrations are also absent, leaving7 pending. Historical SQL statement hashes were not rechecked in this batch; the earlier alias comparison remains necessary to avoid reapplying registered versions. Production17.11 was not tested; local fixtures use16. No linked `db push`, repair or production advisor run.

Decision69 remains partial for bounded service-only expiry processing, protected-record exclusion under real maintenance, an operational scheduler and staging rollout, audited export, and the required Doctor/Student/scoped-Admin visibility. No export or expanded read scope is claimed. Historical records remain untouched. PR48 is the publication vehicle; its previously failing Vercel preview must be resolved before merging. PR46/47 are already merged; main was verified at2073ff7 before this package.
