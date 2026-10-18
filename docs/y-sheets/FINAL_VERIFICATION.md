# Y-Sheets hardening: final review

Base: `main` / merged PR #17 at `214bd6957b2c647e0aae592e24c90d1fed53cd5d`.
Branch: `feature/y-sheets-hardening`. No changes to PR #16 or `main`; no production database calls, migrations or writes. Existing worktrees and files were preserved.

## Final implementation

| Area | Result |
|---|---|
| Cloud writes | Owner-bound RPC, CAS revisions, serialized client saves, transactionally mandatory idempotency receipts, exact retry after lost acknowledgment, no silent conflict rebasing |
| Account isolation | Owner RLS for reads; direct client writes revoked; RPC checks database identity and expected account; another account cannot create from an in-flight old-account snapshot |
| Recovery | Synchronous account/editor journals before network writes; pending request and cell draft persisted; quota/corruption errors surfaced; original revisions retained; independent recovery copies preserved |
| Navigation | Dirty file switches flush or explicitly retain durable recovery; cloud open/rename/delete cannot override unresolved local copies; account unmount disposes autosave |
| Files | Blank create, open, rename, revision-checked confirmed delete, server name search, 50-row pages, modification time, recovery download/discard, JSON/CSV/XLS/XLSX import and export |
| UI/CSS | Scoped resets/utilities/variables/scrollbars and namespaced keyframes; local and host themes; mobile file controls; aligned sticky headers and visible A1 |
| Excel | Patched pinned parser, bounded ZIP inflation and CRC, XML declaration rejection, schema/dimension limits, real worker with deadline; legacy XLS retained |
| Calculation compatibility | Y-Sheets constant formulas now participate in dependency planning; unrelated mathematical engines untouched |

New migration: `artifacts/y-hub/supabase/migrations/0024_y_sheets_safe_saves.sql`; historical 0023 is unchanged. The new RPC and frontend must be deployed together **only after isolated staging validation and explicit production migration approval**. PostgreSQL transaction rollback includes the workbook write and receipt. Receipt storage deliberately survives workbook deletion to prevent replay resurrection; account deletion clears it. Database owners/superusers remain outside the application isolation boundary. Receipt growth needs monitoring; arbitrary receipt pruning would break idempotency/deleted-ID guarantees.

## Verified commands and scope

Final verification completed on 2026-10-18. No skipped/disabled tests were used to obtain a passing result.

| Check | Result |
|---|---|
| Full Vitest suite | **1,790 passed across 201 files** |
| Y-Sheets focused suite | **116 passed across 15 files**, also included in the full suite |
| Module classification/integration/registry suites | **78 passed**, included in the full suite |
| Python suite | **29 passed** |
| Module boundary guard tests | **8 passed** |
| Isolated PostgreSQL | **8 new test cases passed**, plus **14 historical owner-RLS assertions** |
| Complete workspace TypeScript | Passed |
| Architecture, feature/module boundaries and math isolation | Passed |
| Production build | Passed; large-chunk warnings remain |
| Real Chromium workflow | Passed: formula/draft, Excel worker, CSS/theme, mobile/desktop grid and controls |
| Dependency audit | Nonzero: **6 critical, 12 high, 8 moderate, 1 low** across the workspace; no added advisory IDs versus main |

The focused and module counts are subsets of the 1,790 total, not additional tests. SQL coverage uses an isolated database; actual Supabase staging integration remains unverified.

```bash
PATH=/workspace/.yhub-tools/node_modules/.bin:$PATH \
YHUB_PYTHON=/workspace/.yhub-venv/bin/python \
bash scripts/verify-architecture-refactor.sh
bash scripts/test-y-sheets.sh
pnpm --filter y-hub exec vitest run src/features/y-sheets/test
pnpm audit --json
pnpm audit --prod --json
```

The SQL script uses a disposable PostgreSQL 16 Docker container with `--network none`, applies all migrations there, runs 14 historical owner-RLS assertions before 0024 and the new RPC tests after 0024. It accepts no database URL. New cases cover simultaneous writers, lost acknowledgment replay, request/payload binding, replay after a newer writer, cross-account reads/writes, session-switch creation, direct DML denial, revision-checked deletion, no resurrection, bad payload/anonymous denial and rollback on receipt failure.

Real Chromium verification is reproducible with the test-only feature harness (no authentication or Supabase requests):

```bash
# Separate local terminal; stop this test server when finished.
PORT=5175 pnpm --filter y-hub exec vite --host 127.0.0.1 --port 5175
# playwright-core 1.58.2 was installed outside the repository for this check.
YHUB_PLAYWRIGHT_MODULE=/workspace/.yhub-browser/node_modules/playwright-core/index.mjs \
node scripts/test-y-sheets-browser.mjs
```

The browser check asserts pending keystroke capture, formula commit/result, a real Excel worker round trip, unchanged host utility styles, local dark-theme toggle, accessible export controls, no page overflow, visible A1 and aligned row/column headers at desktop/390px before and after scrolling. HTTPS requests are blocked by the test runner. This exercises the actual spreadsheet UI with host styles, not authenticated cloud integration.

## Dependency review

- Exact package: **`@e965/xlsx@0.20.3`**, Apache-2.0, published 2024-07-19. This is an unofficial redistribution, not an official SheetJS npm publication. Publisher repository: <https://github.com/e965/sheetjs-npm-publisher>.
- Inspected the publisher workflow and script at commit `1c8cc59fc6d62f5893f9d20564996ecc50d8eaa8`, identified in npm provenance. The script clones an upstream SheetJS release tag, changes package name/repository and README, and publishes with npm provenance. Workflow actions use major-version tags, not immutable action SHAs; provenance does not by itself prove upstream source equivalence or absence of compromise.
- Downloaded the exact registry tarball and verified its SHA-512 against both registry metadata and the committed lockfile. Compared installed `xlsx.mjs`, `LICENSE` and `package.json` byte-for-byte with that tarball. Verified the registry ECDSA signature against its published key; the historical key expired 2025-01-29, after this package's publication. This proves integrity under that published key, not a new security endorsement.
- Locked integrity: `sha512-703RN/3OdsRD5mtse2HBX7Um7xwaP9tlswEG6svOtjqokXoX7rJdQj7DyabD2I+xk22RgaIIU+R6BHgkpZGB/w==`.
- Official CDN comparison was blocked by network policy. npm's provenance payload was inspected; a complete independent Sigstore transparency-chain verification was not performed. Review the distributor/upstream equivalence before production. No claim of recent active maintenance or zero unknown vulnerabilities is made.
- Removed vulnerable `xlsx@0.18.5`; selected upstream 0.20.3 exceeds the documented fix thresholds for GHSA-4r6h-8v6p-xvw6 (0.19.3) and GHSA-5pgg-2g8v-p4x9 (0.20.2). Pinned `fflate@0.8.3` supplies bounded streaming preflight.
- Full Apache-2.0 and fflate MIT licenses are served in `public/licenses/y-sheets-third-party.txt` and linked from the import/export dialog. No separate NOTICE was present in the SheetJS package.

Audit comparison used `origin/main` lockfile and this branch, queried during the same review:

| Audit scope | main | This branch |
|---|---|---|
| Full workspace | 6 critical, 14 high, 8 moderate, 1 low | 6 critical, 12 high, 8 moderate, 1 low |
| `--prod` filter | 2 high, 1 moderate, 1 low (earlier phase baseline) | 0 high/critical, 1 moderate, 1 low |

The full comparison adds **no advisory IDs** and removes the two SheetJS advisories. Remaining advisories concern existing jsPDF/html2pdf, mathjs, Vite/Vitest/esbuild, maplibre, braces, source-map-js, tinypool, KaTeX and postcss-selector-parser dependencies. Some browser-runtime dependencies are declared under devDependencies, so the `--prod` result **does not** establish that the deployed app is free of high/critical risk. Unrelated upgrades were deliberately left outside this task. Dependency audit exits nonzero; it is a recorded unresolved security finding, not a passed check.

## Release gates and limits

**Ready for isolated staging review; not approved for production launch.**

1. Apply 0023/0024 to an authorized isolated Supabase project; verify actual JWT, PostgREST RPC signatures, RLS and session refresh with two separate accounts (including Instructor/Admin/Super Admin as ordinary workbook owners). Local PostgreSQL claim simulation does not prove Supabase integration.
2. With the same account on two browsers/devices, verify concurrent edits conflict without overwriting; drop an RPC response *after* commit, retry and confirm no duplicate revision; then test a newer writer before retry. Test account switching during creation, offline reload/recovery, storage-quota failure, recovery-copy selection, rename/delete and stale revision handling.
3. Verify signed-in Y-Hub routing, full sidebar/layout, representative Excel files and mobile browsers on staging. Browser harness coverage is Chromium/local, not all devices or authenticated workflows.
4. Resolve/accept the unofficial parser provenance and maintenance risk; plan separate remediation of existing workspace security advisories. The worker has a deadline and bounded input/output but is not an OS memory sandbox. Legacy XLS does not use ZIP expansion checks.
5. Local recovery is browser-origin storage, not encrypted storage or cross-device backup. Clearing browser data removes it; same-origin scripts/browser-profile access are outside its account UI isolation. Quota failure must be resolved or a recovery copy downloaded before leaving.
6. Excel fidelity is limited: values, formulas/cached values, merges, dimensions and basic number formats; fonts/colors, charts, macros, validation, conditional formatting and unsupported/custom formats are not preserved in Excel. JSON preserves the supported Y-Sheets model. Unsupported formulas are retained but are not guaranteed to calculate; external spreadsheet software may interpret exported formulas.
7. File listing uses offset pagination; concurrent changes can reorder results, so refresh reconciles the list. No live collaborative merge or automatic cross-device synchronization is claimed.
8. Build warnings about large chunks remain. Excel conversion is loaded in its own worker; this task does not address unrelated deployment/platform limits.

GitHub API (`api.github.com`) and the official SheetJS CDN were blocked by the active managed network policy. A configuration draft preserving existing domains and adding the CDN was saved; the already-drafted GitHub API allowance must also become effective. Saving the draft is not activation. Git transport is verified separately. PR creation must not be claimed until an actual PR URL is returned.
