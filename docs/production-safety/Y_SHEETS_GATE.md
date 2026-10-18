# Workstream C — Y-Sheets release verification

Reviewed base main `57f3103b273285c27802e35f47189e16a8318035`, containing PR #18 head `1c0bc5cca3174ebab6d698475410c706768e90e4`. Git and public GitHub HTML confirm PR #18 was already **MERGED** before this work. This review did not merge it, reopen it, or rewrite the completed implementation. Follow-up branch: `verify/y-sheets-release-gates`.

## Reviewed implementation and local evidence

Reviewed unchanged migrations 0023/0024, supabaseWorkbookStorage, saveCoordinator, recoveryJournal/workbookSession/workspace lifecycle, XLSX codec/worker/limits, validation and scoped CSS. Existing CAS/receipt replay, account preconditions, dirty draft preservation and guarded file operations are already implemented; no duplicate replacement architecture was introduced.

| Gate | Actual local evidence | Real Supabase staging |
|---|---|---|
| Create/open/save/rename/confirmed delete/search/pages | Adapter/workspace Vitest and isolated RPC tests | PENDING |
| Concurrent writers/revision conflicts/lost response/replay | Real parallel PostgreSQL transactions; adapter regression tests | PENDING across real devices/JWT |
| Session expiry/account switch/private files | Existing adapter tests plus new authenticated-without-identity SQL test and complete student/instructor/admin/super_admin ownership matrix | PENDING |
| Refresh/offline recovery/save failure/unsafe navigation | Recovery journal, pending-cell draft and workspace tests | PENDING in signed-in host |
| CSV/XLS/XLSX, corrupt/large/bomb input | Existing codec/worker tests; real browser Excel worker round trip | Representative real files PENDING |
| Theme/CSS/mobile/header geometry | CSS isolation tests and real Chromium desktop/390px workflow | Other browsers/authenticated shell PENDING |

New SQL tests prove every role can manage its own workbook while none, including super admin, can read/update/delete another owner's workbook through application permissions. A session without auth.uid cannot create a workbook even with an owner hint. These tests simulate claims inside local PostgreSQL; they are **not real JWT verification**.

Fresh results on this branch: **1,790 Vitest tests / 201 files**, **29 Python tests**, **8 boundary-check tests**, complete workspace TypeScript, architecture checks and production build passed. Y-Sheets' **116 tests / 15 files** and **78 module integration/classification/registry tests** are included in the full Vitest count. Isolated workbook SQL: **10 passed** (8 existing + 2 new), plus **14 historical owner-RLS assertions** before 0024. Chromium workflow passed with HTTPS requests blocked by the harness. No failures/skips in final local runs. No production migration/data writes.

## XLSX source, license and safety review

`@e965/xlsx@0.20.3` is an **unofficial** redistribution of SheetJS CE, Apache-2.0. Re-downloaded registry metadata/tarball: SHA-512 matches the committed lockfile, and installed xlsx.mjs/LICENSE/package.json match tarball bytes. Publisher: https://github.com/e965/sheetjs-npm-publisher. Prior review inspected its publishing workflow at npm provenance commit `1c8cc59fc6d62f5893f9d20564996ecc50d8eaa8` and checked the registry signature; no new complete independent Sigstore-chain verification is claimed here. Official CDN equivalence remains unverified because the active network policy blocks cdn.sheetjs.com. No assertion of current active maintenance or absence of unknown vulnerabilities.

Limits remain 5 MiB input, 20 MiB checked ZIP inflation, 1024 archive entries, 32 sheets, 10,000 rows, 256 columns, 50,000 cells and a 15-second disposable worker deadline. CRC/actual expansion, path/layout, XML entity and workbook schema validation precede use. A worker is not an OS memory sandbox; legacy XLS is not ZIP and does not receive ZIP expansion protection. JSON/CSV and model validation protect replacement of the current workbook after a parse failure.

Supported Excel round trips cover values, formulas/cached scalars, merges, dimensions and basic formats; fonts/colors/charts/macros/validation/conditional/custom formats are not fully preserved. Formula text may be interpreted by external spreadsheet software on export; the browser's custom evaluator is not Excel's execution environment. Full Excel fidelity is not claimed. Local recovery remains browser-origin storage, not encrypted or cross-device backup; clearing browser data or same-origin script compromise remains a risk.

Full dependency audit still has unresolved findings. The separate `fix/mathjs-parser-security` branch fixes the two demonstrated parser primitives and reduces high findings from 12 to 10, leaving 6 critical, 8 moderate and 1 low. Without merging that branch, main still has the original 12 high findings. Detailed trigger/reachability review is committed in that branch's `docs/production-safety/DEPENDENCY_SECURITY.md`; no blanket waiver is issued for unrelated runtime/tooling packages.

## Gate decision

**Local implementation verified; production release gate NOT complete.** The user confirmed no staging exists. Real Supabase sessions/RLS/PostgREST and two-device persistence remain PENDING, as do applied migration history/schema drift, distributor provenance review, unresolved advisories and deployment failure diagnosis. Existing PR #18's merge does not establish those gates passed. Migrations 0023/0024 must not be applied to production by this task.
