# Y-Sheets hardening

Branch `feature/y-sheets-hardening`, based on merged PR #17 main `214bd6957b2c647e0aae592e24c90d1fed53cd5d`. One existing worktree, initially clean; no preexisting untracked files removed. Work is limited to Y-Sheets and necessary dependencies/integration. No production migrations or writes.

## Phase 1: cloud save protocol

Added migration 0024 after unchanged 0023. Writes use an owner-checked SECURITY DEFINER RPC with fixed search_path, database-derived identity, CAS revision checks and durable request receipts. Retry of a committed operation returns its original revision without overwriting later edits. Receipt payload/revision binding prevents request-ID reuse for different content. Receipts contain hashes, not document contents, and survive workbook deletion to prevent stale creation retries resurrecting a deleted file. Auth-user deletion removes receipts. Direct client writes are revoked; SELECT remains owner-RLS protected. Deletion uses revision-checked RPC and requires acknowledgment.

Adapter serializes saves, retains uncertain intent, replays it before newer edits, verifies current session, exposes journal checkpoints, and does not silently rebase on conflict. Coordinator retains newer pending data, supports lifecycle disposal and stops retrying permanent/session/conflict errors.

Verified: 12 targeted Vitest tests; all migrations applied to isolated PostgreSQL 16; 14 historical RLS assertions against 0023 and seven new RPC/security/concurrency tests against 0024 passed. Local PostgreSQL models auth claim context; this is not actual Supabase/PostgREST/JWT integration. Production 0023/0024 remain unapplied.

Next: durable local recovery, safe navigation, file management, CSS isolation, XLSX dependency replacement and full verification.

## Phase 2: durable recovery

Added per-account, per-editor synchronous recovery journals (including the exact pending RPC request and uncommitted cell/formula input). Quota failures keep memory, block sending an unjournaled save and expose download/retry. Newer edits are not erased by acknowledgments of older snapshots. Corrupt recovery records are retained. Recovery restores the original revision; conflicts offer a new copy, never a silent rebase. Failed cloud loads never create defaults. Account changes dispose the editor; browser close warns and internal file switches require a successful save or explicit durable recovery. App-link navigation checks local durability. Undo now observes revoked edit permissions. Host integration delegates the feature workspace through its public entry point.

Verified: 88 Y-Sheets Vitest tests across 13 files; application TypeScript passed. Local recovery is origin/browser storage, not encrypted storage or a cross-device backup; clearing browser data removes it. Same-origin scripts/browser-profile access remain outside account-level UI isolation. Browser storage unavailable/full is reported and requires downloading a copy. Real Supabase integration remains unverified.

## Phase 3: file lifecycle

Workspace now creates explicit blank documents, opens existing files, renames using the same revision-checked save protocol, deletes only after confirmation and an exact revision acknowledgment, searches names server-side and loads 50-row pages with modification timestamps. Pending local recovery blocks rename/delete until recovered or explicitly discarded; failed deletes remain visible. Recovery copies can be downloaded or explicitly discarded without touching cloud data. Existing import/export remains available from the editor; format hardening follows in phase 5.

Verified: 93 Y-Sheets Vitest tests, including confirmation/cancellation, rename, pending recovery guards, failed deletion, server search and pagination. Listing uses stable ordering and offset pages; refresh reconciles files reordered by concurrent writes. Actual Supabase integration is still a staging gate.

## Phase 4: stylesheet isolation

All Y-Sheets selectors (including resets, variables, dark variants and scrollbars) are scoped to `.y-sheets-root`; keyframes are namespaced. The lazy host adapter imports the scoped stylesheet. Root dimensions fit the host container. The provider follows host light/dark changes without changing the document theme.

Verified: seven focused CSS/UI tests, including a complete stylesheet selector walk, unchanged host body/utilities, theme changes and existing grid/toolbar rendering. Mobile flex wrapping and host sizing are retained; automated DOM checks are not a substitute for staging browser/device visual review.

## Phase 5: bounded spreadsheet I/O

Removed `xlsx@0.18.5`, affected by GHSA-4r6h-8v6p-xvw6 (prototype pollution, fixed upstream 0.19.3) and GHSA-5pgg-2g8v-p4x9 (ReDoS, fixed upstream 0.20.2). Pinned `@e965/xlsx@0.20.3`, an **unofficial automated redistribution** of upstream SheetJS, to preserve existing legacy XLS/formula/merge capabilities. Its npm publication is dated 2024-07-19; this is not a claim of recent active maintenance or absence of unknown vulnerabilities. npm provides integrity, registry signatures and provenance metadata; the lockfile pins integrity. Official cdn.sheetjs.com is blocked by this environment's network policy, so an independent byte-for-byte comparison with the official tarball was not possible. Review this distributor/provenance and ongoing upstream advisories before production deployment. Do not treat the renamed npm package's clean advisory lookup alone as evidence: the selected upstream version is above both advisory fix thresholds.

New `fflate@0.8.3` preflight bounds ZIP directory entries and advertised/actual decompression, checks CRC/length, rejects unsafe paths/duplicates/encryption/XML entity declarations, and only accepts actual XLSX/legacy OLE signatures. Input max 5 MiB; expanded ZIP max 20 MiB; 1024 ZIP entries; 32 sheets, 10,000 rows, 256 columns, 50,000 populated cells; 15-second worker deadline. Workers isolate conversion from the UI thread and terminate on completion/error/timeout. This is not an OS memory sandbox; legacy XLS is bounded by input size, parser settings, output validation and deadline, not ZIP expansion checks.

JSON and cloud content use bounded nested schema validation; CSV enforces size/dimension/cell limits and rejects unclosed quoted fields. Import preserves cloud workbook identity, confirms replacement and ignores stale completion after closing/unmounting. XLSX additionally preserves supported basic number formats, text-formatted leading zeros, row heights and column widths. Formula text/cached values and merges retain existing behavior. **Not full Excel fidelity:** fonts/colors, charts, macros, conditional formatting, validations and unsupported/custom formats do not round-trip through Excel. JSON preserves the complete supported Y-Sheets document model. Unsupported formulas are retained as text formulas but not guaranteed to evaluate; external programs may interpret exported formulas. Import trusted files.

Verified: 108 Y-Sheets tests across 15 files, including 12 Excel/worker tests, a 10,000-cell round trip, legacy XLS, corruption/truncation, expansion bomb, XML entities, excessive dimensions, worker timeout and permission/import compatibility. TypeScript passed. Production-dependency audit went from 2 high + 1 moderate + 1 low findings to 0 high/critical + 1 moderate + 1 low. Remaining KaTeX and postcss-selector-parser advisories belong to existing unrelated dependencies and were not changed under this task's scope.

## Final review follow-ups

- Moved pending-edit types into the model layer to eliminate the static type dependency cycle; boundary checks were not weakened.
- RPC now also checks `p_expected_owner_id = auth.uid()` as a precondition. Identity still comes exclusively from `auth.uid()`. This prevents a create request prepared for account A from writing its content into account B after a session switch between the client check and request dispatch.
- Indexed receipt workbook IDs and constrained revision/hash fields. Pending-edit downloads include the latest uncommitted input. Invalid recovery timestamps do not hide other valid records.
- Opening a cloud file with local recovery is blocked until recovery/discard; it cannot silently rebase the backup. Adopting another editor's recovery archives this editor's different unsaved copy first. Original revisions and request identities are retained.
- Pending drafts survive unrelated sheet changes. Cell commit/cancel suppresses duplicate blur commits; formula-bar blur commits rather than silently dropping input. Host and local theme toggles update the spreadsheet root, not Y-Hub's theme. Mobile file controls wrap into view.
- Real-browser review exposed a preexisting Y-Sheets-only defect: zero-precedent formulas such as `=1+2` were removed from calculation planning. Two failing regression cases confirmed stale results; keeping their empty dependency sets fixes evaluation without changing formula algorithms or any other Y-Hub engine.
- Real-browser review also exposed stacked sticky headers hiding A1 and misaligning scrolling. Header flow now shares the grid origin; row headers stick horizontally and column headers vertically. Browser assertions check visible A1 and row/column alignment before/after scrolling at desktop and 390px widths.

See [FINAL_VERIFICATION.md](FINAL_VERIFICATION.md) for final results, dependency provenance, limitations and reproducible commands. Stage 1–5 counts above are historical checkpoints, not the final total.
