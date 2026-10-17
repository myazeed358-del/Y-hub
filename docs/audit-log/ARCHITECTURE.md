# Central audit log

Implemented on `feature/central-audit-log`, based on main `9057222acc54c473e192a98507273ce49ac19aac`. Migration `0022_central_audit_log.sql` follows 0021; historical migrations are unchanged. Do not apply to production as part of development. Review and apply in staging before deploying the feature route.

## Transaction and trust boundaries

Database statement triggers lock the authenticated actor profile with `FOR SHARE`; row triggers capture committed domain changes in the same transaction. Identity comes from `auth.uid()`, and role/name from the database, never event fields supplied by React. A role change waits for the actor's in-flight audited transaction. Role management retains its existing restrictions and serializes role transitions, locking the target as well. Concurrent cross-target operations can deadlock or time out: PostgreSQL rolls back a participant; callers must retry the entire authorized operation, never bypass the lock.

Mandatory event insertion is not caught: an error aborts the sensitive mutation, including cascades. The event records a UUID, server `clock_timestamp()`, transaction ID, actor identity/role/name snapshot, SQL operation, semantic actions, entity identity, sensitivity, visibility, changed-field before/after values and safe parent context. An update creates one row even when it both edits and publishes. Identical values and updates to untracked personal profile fields do not produce events.

No actor/entity foreign keys are used: events survive account and entity deletion. A trusted server operation without `auth.uid()` has null actor ID and explicit `system` role, reserved for Super Admin. Anonymous browser operations without an actor are rejected by the trigger. Server credentials must not impersonate browser sessions or accept arbitrary JWT claim settings. Supabase/PostgREST's JWT-to-database-session trust boundary is assumed, as elsewhere in the application.

All privileged functions use an empty search path and schema-qualified relations. Private trigger functions have no client execute/schema privileges. The reader-role helper exposes only the caller's current role. Search is SECURITY INVOKER and obeys table RLS. There is no client event creation RPC. No service key enters frontend code.

## Actual monitored scope

| Existing table | Captured operations / fields |
| --- | --- |
| courses | Create/edit/delete; owner, title/description/code, publication, enrollment-open flag and syllabus source |
| course_materials | Create/edit/delete metadata; parent, type, title and URL changes |
| exams | Create/edit/delete; parent, title, time limit, publish/unpublish |
| questions | Create/edit/delete; parents, type, difficulty, points, and changed content/options/answer fields |
| course_enrollments | Insert/delete and parent/student/status changes when authorized by existing policies or trusted server operations |
| syllabus_units / syllabus_sections | Create/edit/delete, parent/title/order |
| users | Profile create/delete and role/major changes; ordinary personal profile updates excluded |

The migration does not grant new domain write permissions. Restrictive write policies on materials, exams and questions require the current manager role in addition to existing ownership checks, closing the inherited demoted-owner write path. Student SELECT policies remain unchanged. In particular there is currently no administrative enrollment-add/status UI or RPC; self-enrollment and trusted existing operations are audited, without inventing that feature. Cascaded deletes produce distinct child-row events with the original actor and parent IDs. TRUNCATE is blocked on audited tables because it would bypass row evidence. Legacy local bookmarks/teaching plans are not authoritative database audit targets. Academic sections, attendance and exceptional engine grants are not implemented tables/workflows and are not added here.

Identity changes and domain creation/enrollment timestamps are also tracked. Profile data remains limited to identity, role and redacted major; timestamps and other profile PII are excluded. A schema-coverage regression checks all current non-profile columns.

Future tables can attach the same private actor-lock, capture and truncate-block triggers in a reviewed migration, declaring tracked fields, visible values and restricted visibility. They need no redesign of the event store. Extend filter translations when adding new event types. Changes to these allowlists require security review; fields are not automatically copied into events.

## Privacy and read permissions

Only role, entity/parent/actor/student UUIDs, domain timestamps, controlled flags, ordering and numeric/constrained-type metadata are retained as visible values. Free-form titles, descriptions, course codes, URLs, question content/options/correct answers, academic major and question difficulty are always `[REDACTED]`, including their old values. Comparisons occur before redaction, so a genuine text change still creates an event. Passwords, tokens, keys, email, phone, age, student numbers and file contents are not copied. Actor display name (capped at 150 characters) is an intentional reviewer-facing personal-data snapshot; IDs and roles remain personal data requiring retention/access governance. Users should not put secrets in their display names. Search indexes contain only that name, entity type and action tokens.

| Reader | Database authorization |
| --- | --- |
| Anonymous / Student / Instructor | No administrative event access |
| Admin | Instructor-origin events only, and never `super_admin_only` events |
| Super Admin | All events, including administrative, system and access changes |

Account/access events are always Super Admin-only even if initiated by an instructor. Admin, Super Admin and instructors cannot insert, update, delete or truncate either audit store through the application. Grants, forced RLS and immutable triggers are layered protections. Current viewer role is checked from the database on every query; historical actor role remains the role at execution. Notification visibility follows its parent event's RLS.

This is append-only for application principals, not tamper-proof against a database owner/superuser that can disable triggers, alter policies or modify backups. No retention deletion feature is provided. Establish a reviewed retention/export/backup policy before production growth. Rollback of the domain transaction also rolls back its audit row: denied or rolled-back attempts are **not** retained. If required later, use an independent security logging channel for those attempts.

## Application and pagination

`src/features/audit-log/` owns DTO validation, a read-only repository, cancellable data hook, bilingual page and details dialog. `src/modules/audit-log/module.ts` is a discovered API-2 `application`, category `custom:administration`, route `/audit-log`, Applications sidebar group, admin/Super Admin guard. It contributes no dashboard tool or engine catalog entry. Existing math routes, design tokens, layouts and major restrictions are unchanged.

The repository calls `search_audit_events`, requesting 26 rows to display 25 plus lookahead. The RPC enforces a maximum 101, validates cursor pairs and dates, and sorts by `(occurred_at, id)` descending. It filters by actor UUID, action, entity, UTC date range and full-text actor/action/entity search. Previous navigation retains cursors, not the entire dataset. New inserts appear on refresh without shifting a forward cursor; this is not a historical snapshot across all pages. Search is token-based, not arbitrary substring matching; action/entity tokens are canonical English identifiers, with localized UI selectors.

The interface includes loading, error, empty, validation, refresh, bounded next/previous pages and escaped read-only before/after details. Existing theme classes support light/dark and horizontally scrollable tables on narrow screens. Component tests cover Arabic and text escaping; no live signed-in browser, visual/accessibility audit or production performance benchmark is claimed.

## Notifications and Storage

`audit_notifications` is a separate durable notification-intent ledger for role changes and row deletions, not an external email service or delivery implementation. Routine updates do not create notifications. A failed notification insert is caught inside a subtransaction and emits a SQLSTATE-only warning; the mandatory audit event still commits. Server-only `requeue_audit_notifications(limit)` repairs missing intents idempotently from the immutable event store. No browser can invoke it. Operations should monitor enqueue warnings and schedule this repair with server credentials if using notifications; no automatic worker is introduced. Later delivery/read state belongs in separate tables, preserving these intents.

Storage blob operations and relational metadata changes are **not one PostgreSQL transaction**. Existing Storage calls are unchanged. Metadata deletes are audited; blob-only deletion/failure is not covered by these triggers. A failed database delete after a successful blob delete can leave a metadata reference to a missing file. Resolving that requires an independently designed Storage outbox/compensation workflow, not a claim that this migration makes Storage atomic.

## Verification and deployment gate

Run `bash scripts/test-audit-log.sh` with a local Docker daemon. It starts a disposable PostgreSQL 16 container with no network or published ports, bootstraps minimal Supabase auth/storage roles and schema, applies all historical migrations and 0022, then runs real SQL/RLS/integration/concurrency/failure-injection tests and the existing immutable-user-number SQL regression. It accepts no production database URL. Fixtures are local-only and seeded before audit installation; the application has no mock audit records.

The bootstrap models `auth.uid()` using session claims. Tests establish those claims as a privileged test runner; this does not create a production/browser API to set them. JWT validation, Supabase gateway defaults and actual Storage service behavior require staging validation. The PostgreSQL triggers, grants, functions and RLS execute for real in the test database.

Also run `PATH=/workspace/.yhub-tools/node_modules/.bin:$PATH YHUB_PYTHON=/workspace/.yhub-venv/bin/python bash scripts/verify-architecture-refactor.sh`. Results are recorded in VERIFICATION.md. Before production: review migration and privileges under real Supabase roles, verify signed-in instructor/admin/Super Admin flows in staging, assess lock/query performance at expected volume, configure database backups/retention and notification-intent monitoring. No production migration or data mutation was performed by this task.

The PR #16 follow-up security findings, negative controls and merge gate are recorded in [SECURITY_REVIEW.md](SECURITY_REVIEW.md).
