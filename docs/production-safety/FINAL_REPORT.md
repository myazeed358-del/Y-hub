# Phase 1 — final local evidence and release gates

Date: 2026-10-18, Asia/Baghdad. All new branches start from remote main `57f3103b273285c27802e35f47189e16a8318035`. No main/PR merge, force push, historical migration change or production mutation was performed. Staging is unavailable, explicitly confirmed by the user; development and destructive tests continued only in disposable local PostgreSQL.

## Status

| Classification | Finding / delivered outcome |
|---|---|
| **FIXED & VERIFIED** locally | Exam false-success state, duplicate clicks, unvalidated responses, lost-ack reconciliation and delayed synchronization race; durable server-owned attempt deadlines and unique/idempotent grading |
| **FIXED & VERIFIED** locally | Course zero-row false success; exact-ID confirmation, distinguishable errors, destructive confirmation, unchanged ownership/RLS and audit-atomic cascade |
| **FIXED & VERIFIED** locally | Existing Y-Sheets saves/recovery/file/CSS/Excel protections revalidated, with added role-matrix/no-session SQL coverage |
| **FIXED & VERIFIED** locally | Two mathjs unsafe parser primitives demonstrated before fix; patched dependency passes both probes and full compatibility tests, without engine source changes |
| **IMPLEMENTED — STAGING PENDING** | Exam RPC/frontend rollout, course deletion RPC/frontend rollout, actual Supabase JWT/RLS/device flows, Y-Sheets release gates and representative mathjs upgrade calculations |
| **BLOCKED** externally | GitHub API returns Forbidden; PR creation and current CI details unavailable. Vercel deployment detail URL blocked. Applied production migration history unavailable without authorized DB/management access |
| **NOT FIXED** | Existing Vercel deployment error (cause unproven), remaining dependency advisories and incomplete official XLSX upstream/Sigstore verification |
| **OUT OF SCOPE** | Rebuilding other applications/engines, changing historical data-retention policy, introducing an exam reopening/admin-grace feature, or deleting Storage files/production data |

The fixes exist on review branches; this report does not imply main or production already contains them.

## Branch checkpoints

| Work | Branch | Verified remote implementation SHA |
|---|---|---|
| A: exams | `feature/exam-attempt-integrity` | `e6a41004e899da4e1321cc9c10448cbfb63b4bd6` |
| B: courses | `feature/course-deletion-integrity` | `8f32d6eb20f60a0581617e56119f760b186a63fd` |
| Dependency security | `fix/mathjs-parser-security` | `ac778eec4b1671a74b3e3f49e1ce9be811a4fef3` |
| C: verification | `verify/y-sheets-release-gates` | Final documentation checkpoint is established by Git/ls-remote at delivery; prior local test checkpoint `3de4b24` |

All push operations are ordinary, non-force pushes. API PR creation was attempted with committed body files; Forbidden is an actual external blocker, not an excuse to claim a PR exists. Existing PR #18 is **merged** (head `1c0bc5c`, merge `57f3103b`), contrary to the pasted request's old snapshot. PR #14 is untouched.

## Exact final checks

Counts below are separate branch runs, **not additive unique-test totals**.

| Source under test | Vitest passed / files | Python | Boundary guard tests | SQL |
|---|---:|---:|---:|---|
| Exam branch | 1805 / 203 | 29 | 8 | 16 new exam cases; 26 existing audit cases |
| Course branch | 1802 / 203 | 29 | 8 | 9 new course cases; 26 existing audit cases |
| Y-Sheets verification | 1790 / 201 | 29 | 8 | 10 workbook cases + 14 historical RLS assertions |
| mathjs security branch | 1792 / 202 | 29 | 8 | No schema change |

All above complete runs passed workspace TypeScript, strict architecture/math/module boundaries and production build. Final runs have **0 failed and 0 skipped tests**. Seeded red regressions were intentionally executed before fixes: exam false success (1 failure), delayed clock race (1 failure/12 passes), course false success (1 failure), dependency probes (2 failures). None were disabled or weakened.

`scripts/test-production-safety-combined.sh` exported the two immutable migration/test commits into a temporary test bundle and ran all SQL suites with both 0025 and 0026: **61 cases passed** = 16 exam + 9 course + 26 audit + 10 workbook, plus existing SQL assertions. Each suite creates a network-disabled disposable container and accepts no remote database URL. This is migration integration evidence, not live Supabase validation.

Chromium workflow passed (real Excel worker, draft/formula, theme/CSS, desktop/mobile controls and scrolling geometry). Browser harness blocks HTTPS and does not authenticate or test cloud calls. Combined source snapshot verification also passed: **1,819 Vitest tests / 206 files**, **29 Python tests**, **8 boundary tests**, complete workspace TypeScript, all architecture checks and production build. `scripts/verify-production-safety-snapshot.sh` combines the immutable source files only in an exported temporary tree, not a branch merge. It used mathjs 15.2.0 dependencies. This gives additional compatibility evidence across the independent fixes without changing main or merging their branches.

## Migrations and operational consequences

- **0025_exam_attempt_integrity.sql**: new server-owned attempts, auth/enrollment/publication guards, start/status RPCs, updated submit/questions RPCs, client write revocation. Existing result uniqueness and historical results preserved. Expiration records no invented result. No attempt reopening path added. Deploy outside running legacy exams; their prior browser-only start times cannot be reconstructed.
- **0026_confirm_course_deletion.sql**: private locked diagnostic guard and public SECURITY INVOKER deletion RPC; actual DELETE remains under caller RLS and audit triggers. No existing FK or retention policy changes. It is independently testable without 0025; if both accepted, apply in numeric order.
- Existing course deletion cascades material rows, exams, questions, enrollment, results and syllabus. New attempt rows follow their exams if 0025 is present. Storage file deletion is not automatically part of PostgreSQL's transaction. Audit history remains after source deletion, and required audit failure rolls all database changes back.
- Status/attempt RPCs may lazily persist expiry; they must **not** be used as supposedly read-only production probes.

## Production / staging evidence and remaining gates

Only production-side check performed was **GET /auth/v1/health → HTTP 200** with existing configured bindings; no user records, test identities or mutating RPCs were used. This confirms endpoint reachability, not applied migrations, database health, correct live RLS or a successful exam/workbook workflow.

No confirmed staging, test JWTs, production SQL/management access or Vercel credentials are available. Applied migration versions, live student/instructor/admin/super_admin flows, schema drift, Python deployment and current main deployment status remain unverified. PR #18 public HTML reports **1 of 2 checks passed** and a Vercel **Error** at `https://vercel.com/yhup/y-hub/GXrNU5LiWixEihsny68RW5Cfhf8F`; the failure cause is unknown. Do not attribute it to Audit Log, Y-Sheets or the old Python bundle-size limit without logs. No `.github` workflow definitions exist in the inspected tree; local checks are not substituted for remote check status.

Full dependency audit on main: **6 critical, 12 high, 8 moderate, 1 low**. With the security branch: **6 critical, 10 high, 8 moderate, 1 low**, exactly the two mathjs advisories removed and no advisory IDs added. The audit exits nonzero. Runtime packages listed in devDependencies are still runtime risks. Specific unused PDF/Node trigger paths were reviewed; MapLibre transitive reachability and remaining tooling/KaTeX risks are not globally proven absent. No security waiver is issued.

A network configuration draft preserves the production Supabase host and requests api.github.com, cdn.sheetjs.com and vercel.com. Saving it is not activation; environment settings review/save/publication is still required. Runtime spec 2 still permits only the custom Supabase host plus presets. No secrets were requested in chat, printed or committed.

**Decision:** A/B/security branches are locally verified and ready for code review, **not approved for production merge/deployment** until staging and operational gates pass. Y-Sheets is already merged but its release gate remains incomplete. Phase 1 local engineering work is complete; Production Safety as an operational release decision is **not complete**.

## Reproduce the combined checks

Run the existing verification scripts with the prepared Node/pnpm/Python tools. `scripts/test-production-safety-combined.sh` needs the three referenced commits available locally and Docker; it creates only disposable local databases. For `scripts/verify-production-safety-snapshot.sh`, first prepare node_modules from `fix/mathjs-parser-security` with the frozen lockfile, then return to this verification branch without resetting any edits. The script refuses an older installed mathjs and uses the already verified dependency tree in its temporary snapshot. Restore this branch's own frozen lockfile dependencies afterward. Both combined checks were actually executed successfully in this review; these are reproducibility notes, not deferred implementation steps.
