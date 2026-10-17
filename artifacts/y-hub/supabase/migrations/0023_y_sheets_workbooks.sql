-- Y-Sheets persistent workbooks
-- Owner isolation and optimistic concurrency control.
BEGIN;

CREATE TABLE public.y_sheets_workbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  content jsonb NOT NULL CHECK (
    jsonb_typeof(content) = 'object'
    AND jsonb_typeof(content->'sheets') = 'array'
    AND jsonb_typeof(content->'activeSheetId') = 'string'
  ),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX y_sheets_owner_updated_idx
  ON public.y_sheets_workbooks(owner_id, updated_at DESC);

ALTER TABLE public.y_sheets_workbooks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.y_sheets_workbooks FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.y_sheets_workbooks TO authenticated;

CREATE POLICY y_sheets_select_own
  ON public.y_sheets_workbooks
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY y_sheets_insert_own
  ON public.y_sheets_workbooks
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY y_sheets_update_own
  ON public.y_sheets_workbooks
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY y_sheets_delete_own
  ON public.y_sheets_workbooks
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Reject client attempts to change ownership, identity or revision
-- arbitrarily. Revision must increment by exactly one.
CREATE FUNCTION public.y_sheets_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Invalid workbook update'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.y_sheets_guard_update()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER y_sheets_update_guard
BEFORE UPDATE ON public.y_sheets_workbooks
FOR EACH ROW EXECUTE FUNCTION public.y_sheets_guard_update();

COMMIT;
