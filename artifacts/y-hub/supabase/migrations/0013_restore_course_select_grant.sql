-- Y HUB: Restore course reading permission
-- RLS policies continue to control which courses each user can see.

BEGIN;
GRANT SELECT ON TABLE public.courses TO authenticated;
COMMIT;
