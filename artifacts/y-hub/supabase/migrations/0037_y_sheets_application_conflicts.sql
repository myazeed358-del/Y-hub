-- Y-Sheets only: surface terminal application conflicts as HTTP409.
-- Reuses the reviewed Y-Sheets portion of pending Phase3 migration0032;
-- no syllabus/exam changes, table changes or data rewrite. Applying0032 later
-- installs the same function bodies. Historical0023/0024 remain immutable.
BEGIN;
DO $$ BEGIN
  IF to_regclass('y_sheets_private.save_receipts') IS NULL
    OR to_regprocedure('public.save_y_sheets_workbook(uuid,uuid,bigint,jsonb,uuid)') IS NULL
    OR to_regprocedure('public.delete_y_sheets_workbook(uuid,bigint)') IS NULL THEN
    RAISE EXCEPTION 'Y-Sheets migration0024 must be installed first';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.save_y_sheets_workbook(p_id uuid, p_request_id uuid, p_expected_revision bigint, p_content jsonb, p_expected_owner_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_row public.y_sheets_workbooks; v_receipt y_sheets_private.save_receipts;
  v_hash bytea; v_revision bigint;
BEGIN
  -- The owner hint is a session-race precondition, never an identity source.
  IF v_actor IS NULL OR v_actor IS DISTINCT FROM p_expected_owner_id THEN
    RAISE EXCEPTION 'Session changed or not authenticated' USING ERRCODE='42501';
  END IF;
  IF p_id IS NULL OR p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0
    OR p_content IS NULL OR jsonb_typeof(p_content) IS DISTINCT FROM 'object'
    OR p_content->>'id' IS DISTINCT FROM p_id::text
    OR jsonb_typeof(p_content->'name') IS DISTINCT FROM 'string'
    OR length(trim(p_content->>'name')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_content->'sheets') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_content->'activeSheetId') IS DISTINCT FROM 'string'
    OR octet_length(p_content::text) > 5242880 THEN
    RAISE EXCEPTION 'Invalid workbook' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_content->'sheets') NOT BETWEEN 1 AND 32
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_content->'sheets') s WHERE s->>'id'=p_content->>'activeSheetId') THEN
    RAISE EXCEPTION 'Invalid sheets' USING ERRCODE='22023';
  END IF;
  -- Serialize even creation and deletion for this ID. Hash collision only adds waiting.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  SELECT * INTO v_row FROM public.y_sheets_workbooks WHERE id=p_id FOR UPDATE;
  IF FOUND AND v_row.owner_id <> v_actor THEN
    RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501';
  END IF;
  v_hash := sha256(convert_to(p_content::text,'UTF8'));
  SELECT * INTO v_receipt FROM y_sheets_private.save_receipts
    WHERE owner_id=v_actor AND workbook_id=p_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'Workbook deleted' USING ERRCODE='PT409'; END IF;
    IF v_receipt.expected_revision <> p_expected_revision OR v_receipt.payload_hash <> v_hash THEN
      RAISE EXCEPTION 'Request ID reused for different content' USING ERRCODE='22023';
    END IF;
    RETURN v_receipt.result_revision;
  END IF;
  IF p_expected_revision = 0 AND v_row.id IS NULL AND NOT EXISTS(
    SELECT 1 FROM y_sheets_private.save_receipts WHERE workbook_id=p_id
  ) THEN
    INSERT INTO public.y_sheets_workbooks(id,owner_id,name,content)
      VALUES(p_id,v_actor,p_content->>'name',p_content) RETURNING revision INTO v_revision;
  ELSE
    IF v_row.id IS NULL OR v_row.revision <> p_expected_revision THEN
      RAISE EXCEPTION 'Workbook conflict' USING ERRCODE='PT409';
    END IF;
    UPDATE public.y_sheets_workbooks SET name=p_content->>'name',content=p_content,revision=revision+1
      WHERE id=p_id RETURNING revision INTO v_revision;
  END IF;
  INSERT INTO y_sheets_private.save_receipts VALUES(v_actor,p_id,p_request_id,p_expected_revision,v_hash,v_revision);
  RETURN v_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.save_y_sheets_workbook(uuid,uuid,bigint,jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_y_sheets_workbook(uuid,uuid,bigint,jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_y_sheets_workbook(p_id uuid,p_expected_revision bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  DELETE FROM public.y_sheets_workbooks WHERE id=p_id AND owner_id=auth.uid() AND revision=p_expected_revision RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Workbook conflict or unavailable' USING ERRCODE='PT409'; END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_y_sheets_workbook(uuid,bigint) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.delete_y_sheets_workbook(uuid,bigint) TO authenticated;

COMMIT;
