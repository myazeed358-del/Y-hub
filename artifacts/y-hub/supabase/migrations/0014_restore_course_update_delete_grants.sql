-- ====================================================
-- Y HUB: Restore Course UPDATE and DELETE Permissions
-- Migration 0014
-- ====================================================

BEGIN;
-- Allow authenticated users to request course updates.
-- Existing RLS policies enforce ownership and role checks.
GRANT UPDATE ON TABLE public.courses TO authenticated;
-- Allow authenticated users to request course deletion.
-- Existing RLS policies restrict which courses can be deleted.
GRANT DELETE ON TABLE public.courses TO authenticated;
COMMIT;
-- END OF MIGRATION 0014;
