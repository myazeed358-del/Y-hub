# Y-Sheets final UI review — PR #35

Review completed locally on 2026-10-24. This report supersedes earlier test counts for this PR; the older hardening report remains historical.

## Source and scope

- Existing PR: https://github.com/myazeed358-del/Y-hub/pull/35 (Draft at the last public-page check).
- Branch: `feature/y-sheets-ui-refresh`.
- Verified upstream main: `80fab4b8a026f508f63bdbcc7edb09da0cf6a622`.
- Previous verified PR branch head: `ba5c4a3fe5dbda867996fc0653f53dbd76e76bd9`.
- PR #27 is already merged; its changes were preserved. Latest main was merged into this branch without conflicts in `22e7ed3` before final testing.
- Only Y-Sheets application code, necessary browser/database test infrastructure, the scoped migration below and review documentation changed. No mathematical engine, application shell, other feature, dependency, historical migration or Vercel configuration was changed by this review.
- One existing checkout was used. Other branches and pre-existing work were preserved; no force push or direct main push.

## Proven defects fixed

| Defect | Fix and regression evidence |
| --- | --- |
| Same-cell, overlapping and cross-sheet cut/paste could erase values; a clipped cut erased cells that did not fit; copying a blank did not clear the target | Capture explicit blanks; clear the captured source sheet before applying destination values in one reducer/history transaction. Refuse incomplete cuts and retain the clipboard. Five regression cases failed before the fix and pass after, including one-step undo. No formula-engine changes. |
| A late initial directory response replaced newer search results | Sequence directory requests and ignore superseded results/errors and disposed effects. Deferred-response regression failed before the fix and passes after. |
| Ribbon Import opened Export, and reopening retained the wrong panel | Reset the requested panel when opening. Regression switches Import to Export and checks the actual controls. Native export buttons and a keyboard-operable file picker retain existing operations. |
| Ribbon tabs did not implement keyboard tablist navigation; mobile host actions lacked stable accessible names; worksheet options were hover-dependent | Roving tab focus with Arrow/Home/End, associated panels, named host actions, focus-visible worksheet options, and button-relative menu positioning. Tests exercise commands, formatting, merge, sorting, filtering, find, sheet creation and rename. |
| Filter toggle immediately removed an unconstrained filter | Preserve the enabled range when no criteria have been chosen. Existing criteria filtering remains supported. Tests cover toggle, criteria, clear and Ribbon wiring. This does not add a new Excel filter editor. |
| Multiple brand marks reused SVG gradient IDs | Per-instance IDs retain the artwork and prevent references to another icon's gradient. Regression checks uniqueness. |
| Dark selected headers retained green and grid borders used a bright fallback | Scoped cyan/navy and dark-border rules. Chromium verifies computed styles and geometry. Existing CSS isolation tests imported an empty Vitest CSS stub, so they were vacuous; they now parse the real nonempty stylesheets. |
| Application conflicts used SQLSTATE 40001, which PostgREST retries as serialization failures | New migration 0037 uses PT409 for terminal workbook conflicts. A real local HTTP concurrency regression first timed out with the old functions; it now returns one successful write and one prompt HTTP 409. Frontend accepts PT409 and legacy conflict codes, retaining the pending save intent. |

The existing fullscreen host adapter, consolidated Ribbon controls, local recovery journal, save coordinator and hybrid My Files layout are retained. Browser tests verify recovery before unsafe navigation, file creation/open/rename, server pagination/search, localized dates, confirmed delete and error handling. A lost acknowledgment is retried without advancing the revision twice; conflicting edits are recoverable as a new copy without overwriting the remote file.

## Final verification

| Check actually run | Result |
| --- | --- |
| Complete Vitest suite | **1,899 passed / 219 files** |
| Focused Y-Sheets Vitest suite | **139 passed / 19 files**, included in the full total |
| Python application/API suite | **36 passed** |
| Architecture guard tests | **8 passed**, plus architecture/math/module boundary audits |
| Complete workspace TypeScript | **PASS** (project references and every artifact package) |
| Production Vite build | **PASS**; existing >500 kB chunk warning remains |
| Isolated PostgreSQL Y-Sheets RPC suite | **10 passed**, plus **14 historical owner-RLS SQL assertions** |
| Native local GoTrue JWT + PostgREST + PostgreSQL | **5 passed** |
| Chromium fullscreen | **16 combinations**: 1920/1366/768/390 widths × English/Arabic × light/dark, plus shell return, denied guest route and conflict navigation |
| Chromium My Files workflows | **4 complete scenarios**: desktop/mobile × light/dark, with English/Arabic date checks |
| Chromium editor/worker | **PASS**: formula/draft, real Excel worker round trip, scoped host CSS/theme, desktop/mobile controls and scrolled grid alignment |

No tests were disabled. Intentional HTTP 409/503/network failures in browser fixtures produce expected resource-error messages; no unexpected/unhandled page errors were accepted. Browser cloud responses are synthetic and all external requests are intercepted. The native HTTP suite uses real local Auth-issued JWTs and PostgREST, not mocked JWT claims, but is still not hosted Supabase verification. Storage infrastructure in that local harness is a schema stand-in and is not part of the workbook-storage test claim.

The HTTP cases cover all four roles' private workbooks, anonymous/forged-identity/direct-write denial, idempotent replay, concurrent JWT sessions, stale deletion, receipt replay after deletion and no resurrection. PostgreSQL cases additionally cover receipt-write failure rolling back the workbook, account switching, invalid payloads and later-writer replay.

Reproduce from the prepared repository root:

```bash
PATH=/workspace/.yhub-tools/node_modules/.bin:$PATH \
YHUB_PYTHON=/workspace/.yhub-venv/bin/python \
bash scripts/verify-architecture-refactor.sh
pnpm --filter y-hub exec vitest run src/features/y-sheets/test --maxWorkers=2 --minWorkers=1
bash scripts/test-y-sheets.sh
bash scripts/test-y-sheets-http.sh
# Start local Vite separately on 127.0.0.1:5175. Each browser script blocks external requests.
YHUB_PLAYWRIGHT_MODULE=/workspace/.yhub-browser/node_modules/playwright-core/index.mjs node scripts/test-fullscreen-browser.mjs
YHUB_PLAYWRIGHT_MODULE=/workspace/.yhub-browser/node_modules/playwright-core/index.mjs node scripts/test-y-sheets-browser.mjs
YHUB_PLAYWRIGHT_MODULE=/workspace/.yhub-browser/node_modules/playwright-core/index.mjs node scripts/test-y-sheets-files-browser.mjs
```

Raw run logs and screenshots are retained in the execution workspace at `/workspace/y-sheets-review-evidence/`; these are evidence of this run, not a dependency of the tests. The test harness uses disposable local containers, an internal Docker network and no published ports or remote database URL. `runtime.py` and `bootstrap.sql` reuse the existing integration-branch harness rather than introducing another application service.

## Migration 0037 and release procedure

`0037_y_sheets_application_conflicts.sql` replaces only the existing save/delete RPC bodies. It is necessary for terminal conflicts to reach the client without repeated serialization retries. It changes no table, persisted content, RLS policy, function signature or ownership model. It retains trusted `auth.uid()`, expected-account checks, private receipts, advisory/row locks, revision comparisons, payload limits, fixed empty search paths and authenticated-only execution grants. Database owners/superusers remain outside the application security boundary.

The transaction checks that migration 0024's receipts and function signatures exist. Historical 0023/0024 were not edited or reapplied to production. Numbers 0034–0036 are already allocated on other university branches, so 0037 avoids their collisions. This reuses only the Y-Sheets function bodies from the pending Phase 3 migration 0032; no syllabus changes are pulled in. Installing 0032 later supplies the same Y-Sheets bodies, but release owners must coordinate ledger order for those independent branches. Do not run a blind `supabase db push` to install unrelated migrations.

**Production status: NOT APPLIED.** The user reports 0023 and 0024 already installed. An independent ledger comparison could not be completed: the public REST interface rejects the migration schema with HTTP 406/PGRST106, and anonymous workbook access is denied with HTTP 401/42501. These read-only probes do not prove the ledger, authenticated RLS or cloud save readiness. Only the public frontend credentials are configured; no approved privileged database connection or management credential is available. No production data was read, edited or deleted, and no migration was applied.

Before release, use an approved privileged connection to inspect the linked project's actual ledger and function definitions, review this transaction against that state, then apply only 0037 if absent. Recheck the ledger, function ACLs, RLS and authenticated save/conflict/replay with authorized test accounts in an isolated hosted environment. Do not reapply 0023/0024 and do not use users' real files for verification.

## Delivery and remaining gates

Implementation and local verification are complete. The implementation commit is `e972b2b`; the implementation and review checkpoint `251b44b58711fd653725aaa3d97595f0bf96637e` was pushed normally and verified against both the branch and `refs/pull/35/head`. This delivery-note commit follows that verified checkpoint. Main remains `80fab4b8a026f508f63bdbcc7edb09da0cf6a622`. GitHub GraphQL access currently returns `Forbidden` under the enforced network policy, which does not allow `api.github.com`; the saved environment draft is not equivalent to an applied policy. Therefore API-based PR description updates, readiness transition, required-check inspection and protected merge are **BLOCKED**, not successful. The proposed PR description is saved in `PR35_DESCRIPTION.md`. No alternate PR or direct main push is used to evade that restriction. The public PR page after the push reports Draft and includes the new checkpoint. `gh pr edit 35 --body-file docs/y-sheets/PR35_DESCRIPTION.md` also returned Forbidden; the remote description was not changed. Recheck after network access is restored.

Hosted staging/Auth/device tests, actual migration-ledger verification and 0037 deployment remain **PENDING**. The local fixes are ready for review, but full production readiness and a completed merge are not claimed. The existing Vercel Python bundle-size issue remains a known deferred deployment issue; it was not investigated or changed. The existing bounded Excel import/export support is preserved, not full Excel compatibility. No dependency changed in this review; earlier supply-chain findings in `FINAL_VERIFICATION.md` are historical and are not represented as a new clean dependency audit.
