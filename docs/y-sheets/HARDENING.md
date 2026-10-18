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
