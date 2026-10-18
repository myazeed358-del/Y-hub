# Y-Sheets hardening

Branch `feature/y-sheets-hardening`, based on merged PR #17 main `214bd6957b2c647e0aae592e24c90d1fed53cd5d`. One existing worktree, initially clean; no preexisting untracked files removed. Work is limited to Y-Sheets and necessary dependencies/integration. No production migrations or writes.

## Phase 1: cloud save protocol

Added migration 0024 after unchanged 0023. Writes use an owner-checked SECURITY DEFINER RPC with fixed search_path, database-derived identity, CAS revision checks and durable request receipts. Retry of a committed operation returns its original revision without overwriting later edits. Receipt payload/revision binding prevents request-ID reuse for different content. Receipts contain hashes, not document contents, and survive workbook deletion to prevent stale creation retries resurrecting a deleted file. Auth-user deletion removes receipts. Direct client writes are revoked; SELECT remains owner-RLS protected. Deletion uses revision-checked RPC and requires acknowledgment.

Adapter serializes saves, retains uncertain intent, replays it before newer edits, verifies current session, exposes journal checkpoints, and does not silently rebase on conflict. Coordinator retains newer pending data, supports lifecycle disposal and stops retrying permanent/session/conflict errors.

Verified: 12 targeted Vitest tests; all migrations applied to isolated PostgreSQL 16; 14 historical RLS assertions against 0023 and seven new RPC/security/concurrency tests against 0024 passed. Local PostgreSQL models auth claim context; this is not actual Supabase/PostgREST/JWT integration. Production 0023/0024 remain unapplied.

Next: durable local recovery, safe navigation, file management, CSS isolation, XLSX dependency replacement and full verification.
