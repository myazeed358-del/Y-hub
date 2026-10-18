## Problem and result

Y-Sheets could lose local edits during failed cloud saves or recovery selection, overwrite a concurrent writer, and mishandle an acknowledgment lost after a successful save. This change adds revision-checked, replay-safe saves and account-scoped durable recovery, completes guarded file management, isolates spreadsheet styles, and hardens Excel import/export.

## Changes

- Add migration `0024_y_sheets_safe_saves.sql`: owner-checked RPCs, atomic revision checks and request receipts, replay protection after deletion, and revoked direct client writes. Historical 0023 is unchanged.
- Persist drafts and pending save requests before network writes, retain independent recovery copies, guard file switches/account changes, and provide recovery downloads without silently substituting defaults.
- Complete create/open/rename/confirmed-delete, server search/pagination and modification dates. Keep existing Plug-and-Play routing and public feature boundaries.
- Scope CSS, synchronize host/local themes, and fix mobile controls and grid header alignment. Correct constant-formula scheduling only inside Y-Sheets.
- Replace vulnerable xlsx 0.18.5 with pinned `@e965/xlsx@0.20.3`; bound parsing, archive expansion and workbook dimensions, use a worker deadline, and provide third-party licenses. Preserve supported XLS/XLSX/CSV/JSON behavior with explicit Excel fidelity limits.

## Verification

- `bash scripts/verify-architecture-refactor.sh`: **1,790 Vitest tests / 201 files**, **29 Python tests**, **8 module-boundary guard tests**, complete workspace TypeScript, architecture checks and production build passed.
- Focused Y-Sheets: **116 tests / 15 files** passed; module classification/integration/registry: **78 tests** passed. These are included in the full Vitest count.
- `bash scripts/test-y-sheets.sh`: **8 new isolated PostgreSQL cases** and **14 historical owner-RLS assertions** passed, including concurrent writers, lost responses, account isolation and atomic rollback.
- `scripts/test-y-sheets-browser.mjs`: real Chromium formula/draft, Excel worker, CSS/theme, mobile/desktop controls and scrolling alignment passed.
- Full dependency audit: **6 critical, 12 high, 8 moderate, 1 low**, versus main's **6 critical, 14 high, 8 moderate, 1 low**. No new advisory IDs; the two old SheetJS advisories are removed. Audit remains nonzero. The production-only filter is insufficient because some browser libraries are declared as devDependencies.

## Release gates and remaining risks

**Draft: ready for isolated staging validation, not production launch approval.** No migration was applied to production and no production data was accessed or changed. Test 0023/0024 and the frontend together on authorized Supabase staging with real sessions, two accounts and two devices, including response loss, conflicts, offline reload and session switching. Local PostgreSQL and browser harness tests do not establish real Supabase integration.

`@e965/xlsx` is an unofficial Apache-2.0 redistribution. Registry integrity/signature and publisher provenance were reviewed; official upstream byte equivalence and the complete Sigstore chain were not verified. Its maintenance/supply-chain risk and existing unrelated workspace advisories remain release review items. Excel formatting fidelity is explicitly limited, local recovery depends on browser storage, and build chunk warnings remain.

Scope is Y-Sheets and necessary integration/dependency/test files only; no unrelated mathematical engines, main branch, or PR #16 changes.

See [final evidence and limitations](docs/y-sheets/FINAL_VERIFICATION.md), [phase log](docs/y-sheets/HARDENING.md), and [complete changed-file inventory](docs/y-sheets/CHANGED_FILES.md).
