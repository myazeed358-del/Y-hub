# University features — final local delivery (2026-10-23)

The requested implementation is complete on focused branches, with a disposable combined-source verification of university features and the existing Phase 3 branches. No branches were merged, no production migrations/data changes were made, and main remains `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136`. Hosted staging and live media operation are **PENDING**, so this is **not production-ready**.

## Implemented behavior

- **Exceptional engine permissions:** current instructor/section/enrollment/delegation checks, bounded expiry, permanent relationship revocation, audited grant/revoke and current-JWT database authorization for protected Python compute operations. API-v2 staff page includes directory retries and server-paged history. No algorithms changed. [Contract, deployment and limits](ENGINE_ACCESS.md).
- **Existing Quick Access card:** zero to three authorized choices, replacement/removal/reordering, own-account Supabase persistence, explicit empty state, revision CAS, focus/periodic synchronization, revoked-tool filtering and conflict draft retention. No duplicate dashboard/card. [Details](QUICK_ACCESS.md).
- **Y-Attendance:** shared section lecture scheduling, manual corrections with reasons/time limits, open/close/cancel, server HMAC QR rotated every 10 seconds, unique student/session check-in, own-history/absence statistics, paginated staff reports and formula-safe CSV. API-v2 application. [Details](ATTENDANCE.md).
- **Online Lectures:** same section/lecture model, scheduling/upcoming/cancel, JWT-bound enrollment admission, LiveKit adapter, microphone/camera/screenshare/transient chat/participant management, audited blocking and server reconciliation retries. UI and server code implemented; actual SFU/scheduler deployment is pending. [Requirements and revocation limits](ONLINE_LECTURES.md).
- **Owner:** display name updated without changing the internal `super_admin` role or permissions. [Details](OWNER_LABEL.md).

The existing courses/sections, roles, student identities, module discovery, themes, math algorithms and Audit Log boundaries are preserved. New API-v2 applications do not enter engine catalogs. Generic access checks never trust a browser-supplied role/actor or substitute UI guards for backend permissions.

## Migrations and release composition

New files: `0033_exceptional_engine_access.sql`, `0034_student_quick_access.sql`, `0035_academic_attendance.sql`, `0036_online_lectures.sql`. Historical migrations are unchanged. Phase 3 reserves 0029–0032 on independent existing branches. Review their ordered integration with 0033–0036 in isolation before any authorized deployment; do not skip required predecessors based only on one feature PR diff. `tools/export_module_policy.mjs` produces reviewed server metadata from accepted manifests. Registering a module never trusts browser writes.

Focused review heads, remotely checked with `git ls-remote`:

| Branch | Verified SHA | Intended Draft PR base |
|---|---|---|
| `feature/exceptional-engine-access` | `62a0565c75319e46881a473b1c6bcbc0bf8096f7` | `main` |
| `feature/student-quick-access` | `f862ae29b547940dfe1790a9d9f14f63b35d6b3f` | `feature/exceptional-engine-access` |
| `feature/y-attendance` | `c1a4bd2dc286386230f2fe14103ff7f81da06e64` | `feature/exceptional-engine-access` |
| `feature/online-lectures` | `09168c2f0229e27952180be33a0d5cf47a0789e9` | `feature/y-attendance` |
| `feature/owner-display-name` | `b150fddc6cae053e9aa765ac5f3905b5d7156ffe` | `main` |

Quick Access and attendance retain their original grant dependency `db0ae2d7b57efee2ed85621d8a3e9f2488abda02`; the later grant UI fix is verified by the combined exporter, with no force push/rebase of their history. Online Lectures depends on attendance. Owner is independent. Existing Phase 3 branches are preserved; exact pinned heads appear in `tools/export_university_snapshot.py`.

`test/university-integration` is based on Online Lectures and contains the native Auth/HTTP test harness, pinned source exporter, cross-branch UI fixtures and final evidence. It does **not** merge all feature code into one PR. The exporter composes reviewed source snapshots in an empty disposable `/tmp` directory. Its intended Draft PR base is `feature/online-lectures`. Use Git history and the verified remote head for this report's own commit SHA.

## Verification

Final combined command: `PATH=/workspace/.yhub-tools/node_modules/.bin:$PATH YHUB_PYTHON=/workspace/.yhub-venv/bin/python bash scripts/verify-university-snapshot.sh`.

- **1935 Vitest tests /225 files** passed, with no failures/skips in the final run (86.59s).
- **36 Python tests** passed (0.927s).
- **145 isolated PostgreSQL tests** passed:33 university,45 academic,26 audit,20 exams,9 deletion,12 Y-Sheets; existing immutable-user-number SQL assertions also passed.
- **21 native GoTrue/PostgREST HTTP integration tests** passed (30.598s), distinct from the SQL stand-in suites.
- **Eight architecture guard tests** and **two automatic policy-export tests** passed.
- Complete workspace TypeScript, strict architecture/math/module/cycle checks and production build passed (46.21s).

Full runner reached `PASS: combined university and Phase3 snapshot; no Git merge performed`. Evidence: `/tmp/university-combined-final.log`, verified source checkpoint `d6b5fd5293c9192966f07bf946d2395925b30822` and pinned overlay heads in the exporter. No tests were disabled to obtain these results. Non-failing output included PDF.js Node legacy-build guidance, a Starlette/httpx deprecation and Vite chunk-size warnings (>500kB); these are not a Vercel deployment result.

Additional evidence: actual Deno 2.5.6 `deno check --no-config artifacts/y-hub/supabase/functions/lecture-access/index.ts` passed. The complete dependency review found **39 inherited advisory entries**, identical to main (7 critical /13 high /15 moderate /4 low), not a clean audit. [Inventory and scope](DEPENDENCY_REVIEW.md).

Native GoTrue 2.177.0 and PostgREST 12.2.3 run against disposable PostgreSQL on an internal Docker network, with no published ports or production URL. Tests use actual signup/login/refresh/logout JWTs and HTTP/RPC/RLS for student, instructor, Admin and Owner. They cover exams, course management/syllabus, Y-Sheets CAS/isolation, Audit Log, grants, Quick Access, attendance and online admission/service reconciliation. Storage tables are stand-ins; this is not Storage end-to-end testing. LiveKit transport is mocked in handler tests, not a live media assertion.

## Causal security and failure evidence

- Grant creation serializes actor/recipient/current enrollment and policy checks; withdrawal, role changes and reassignment revoke existing grants. Browser actor/role forgery and direct table mutation are rejected. Audit failure aborts required mutations.
- A new concurrent promotion/removal test initially reproduced an online moderator removing a now-promoted student. Locking the target profile while checking its current role prevents that stale-role action; the regression now passes.
- Actual two-session JWT tests prove Quick Access stale revision rejection and attendance exactly-once rows/check-in identities. QR tampering/expiry and foreign enrollment fail. UI retry/pagination regressions prove initial directory failures recover and history beyond 100 rows is reachable.
- The platform does not grant instructors enrollment UPDATE rights. The native HTTP test asserts this unchanged denial (HTTP200 with zero returned rows), then performs registrar withdrawal only through a trusted local fixture before checking real-JWT revocation. No policy was relaxed to make a test pass.
- Provider disconnect failure preserves the audited block and returns a pending error; server reconciliation retries. Required audit rollback, redaction and Admin/Owner event isolation are checked independently of frontend visibility.

## GitHub delivery limitation

All feature branches are pushed; final integration push is verified separately. Draft PR creation attempts using the committed bodies failed with `Post "https://api.github.com/graphql": Forbidden`; a read-only connectivity check also returned proxy CONNECT403. This is an environment network restriction, not a Git failure. **No new PR numbers exist and none are claimed.** Prepared descriptions: ENGINE_ACCESS_PR.md, QUICK_ACCESS_PR.md, ATTENDANCE_PR.md, ONLINE_LECTURES_PR.md, OWNER_LABEL_PR.md and INTEGRATION_PR.md. Create them with the bases above when GitHub API access is available, keep Draft, do not merge automatically. Existing PR16 is untouched.

Final delivery check: the first report checkpoint `f0190138531476964c9112a716f1539f29e6ae87` was pushed and matched `git ls-remote`. All five feature remote heads matched the table above and main was unchanged. The working tree was clean and disposable test containers were removed by their runners. The current documentation-only commit records this previous verified SHA; use Git/ls-remote for its own final head.

The integration Draft PR attempt failed with the same GraphQL Forbidden response both normally and after an approved execution-sandbox escalation; no PR was created. Runtime inspection reported current/enforced restricted HTTP policy without `api.github.com`. The saved configuration draft already includes that hostname, but the running policy does not. Apply the intended API-host access through environment settings and recheck actual GitHub API authorization before creating the prepared Draft PRs; do not bypass the proxy or request replacement credentials merely because Git and API access differ.

## Remaining operational and security gates

1. **PENDING:** authorized isolated hosted Supabase migration ledger, native gateway/Edge deployment and account/device flows; no production write testing was performed.
2. **PENDING:** real LiveKit SFU/TURN, browser/mobile permissions, two-device audio/video/screenshare/chat, reconnect/removal, authenticated reconciliation scheduler at most every30 seconds, outage monitoring and load tests. Established sessions require the worker; token expiry does not itself disconnect them. See ONLINE_LECTURES.md for server-only secrets and configuration.
3. **PENDING:** full dependency exposure triage/remediation. Existing critical/high advisories prevent a blanket security clearance even though no new advisory identity was added.
4. QR sharing between enrolled students cannot prove physical presence; CSV pages are not a transactional snapshot. Attendance remains provisional until closed. Client-delivered algorithms cannot provide offline DRM. Audit protection does not constrain database superusers.
5. Refresh polling has UI latency; current DB/server checks remain authoritative. Quick Access unsaved preference drafts are not document recovery. Previously issued media tokens have a short30-second lease and scheduler/provider revocation latency.
6. Publish/revalidate the cloud environment wrapper's Authorization preflight configuration draft when deploying the protected compute API; saving that draft did not deploy it.
7. Known deferred issue only: Vercel Python bundle size. No investigation or workaround was performed.

Exact file inventory: [CHANGED_FILES.md](CHANGED_FILES.md). Review each focused branch and release gates before deciding on main integration; successful local tests alone are not production security approval.
