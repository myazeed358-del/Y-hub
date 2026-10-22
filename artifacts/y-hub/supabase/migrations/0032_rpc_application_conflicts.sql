-- Application revision conflicts are terminal HTTP 409, not retryable serialization failures.
-- Bodies retain 0024/0028 authorization, locking, RLS and receipt behavior.
-- No historical migration edits; genuine PostgreSQL serialization errors remain untouched.
BEGIN;
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

CREATE OR REPLACE FUNCTION public.save_course_syllabus(p_course_id uuid,p_expected_revision bigint,p_units jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_revision bigint; v_unit jsonb; v_topic jsonb; v_units uuid[] := '{}'; v_topics uuid[] := '{}'; v_id uuid; v_pos integer; v_subpos integer;
BEGIN
 v_revision := public.lock_managed_syllabus(p_course_id);
 IF p_expected_revision IS NULL OR p_expected_revision<>v_revision THEN
   RAISE EXCEPTION 'Syllabus changed; retain edits and reload before retrying' USING ERRCODE='PT409';
 END IF;
 IF p_units IS NULL OR jsonb_typeof(p_units)<>'array' OR octet_length(p_units::text)>1048576 THEN
   RAISE EXCEPTION 'Invalid syllabus payload' USING ERRCODE='22023';
 END IF;
 IF jsonb_array_length(p_units)>100 THEN RAISE EXCEPTION 'Too many syllabus units' USING ERRCODE='22023'; END IF;
 -- Validate the complete graph before any mutation; IDs from other parents cannot be adopted.
 FOR v_unit IN SELECT value FROM jsonb_array_elements(p_units) LOOP
   IF jsonb_typeof(v_unit)<>'object' OR NOT(v_unit ?& ARRAY['id','title','sections']) OR (v_unit-'id'-'title'-'sections')<>'{}'::jsonb
    OR jsonb_typeof(v_unit->'title')<>'string' OR length(btrim(v_unit->>'title')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(v_unit->'sections')<>'array' THEN RAISE EXCEPTION 'Invalid syllabus unit' USING ERRCODE='22023'; END IF;
   v_id := (v_unit->>'id')::uuid;
   IF v_id IS NULL OR v_id=ANY(v_units) THEN RAISE EXCEPTION 'Duplicate/empty unit ID' USING ERRCODE='22023'; END IF;
   v_units:=array_append(v_units,v_id);
   FOR v_topic IN SELECT value FROM jsonb_array_elements(v_unit->'sections') LOOP
     IF jsonb_typeof(v_topic)<>'object' OR NOT(v_topic ?& ARRAY['id','title']) OR (v_topic-'id'-'title')<>'{}'::jsonb
      OR jsonb_typeof(v_topic->'title')<>'string' OR length(btrim(v_topic->>'title')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid syllabus topic' USING ERRCODE='22023'; END IF;
     v_id := (v_topic->>'id')::uuid;
     IF v_id IS NULL OR v_id=ANY(v_topics) THEN RAISE EXCEPTION 'Duplicate/empty topic ID' USING ERRCODE='22023'; END IF;
     v_topics:=array_append(v_topics,v_id);
   END LOOP;
 END LOOP;
 IF cardinality(v_topics)>1000 THEN RAISE EXCEPTION 'Too many syllabus topics' USING ERRCODE='22023'; END IF;
 DELETE FROM public.syllabus_sections s USING public.syllabus_units u WHERE s.unit_id=u.id AND u.course_id=p_course_id AND NOT(s.id=ANY(v_topics));
 DELETE FROM public.syllabus_units WHERE course_id=p_course_id AND NOT(id=ANY(v_units));
 v_pos:=0;
 FOR v_unit IN SELECT value FROM jsonb_array_elements(p_units) LOOP
   IF EXISTS(SELECT 1 FROM public.syllabus_units WHERE id=(v_unit->>'id')::uuid AND course_id=p_course_id) THEN
     UPDATE public.syllabus_units SET title=btrim(v_unit->>'title'),sort_order=v_pos
     WHERE id=(v_unit->>'id')::uuid AND (title,sort_order) IS DISTINCT FROM (btrim(v_unit->>'title'),v_pos);
   ELSE
     INSERT INTO public.syllabus_units(id,course_id,title,sort_order) VALUES((v_unit->>'id')::uuid,p_course_id,btrim(v_unit->>'title'),v_pos);
   END IF;
   -- Ensure a hidden/foreign ID or restrictive RLS cannot silently skip a write.
   IF NOT EXISTS(SELECT 1 FROM public.syllabus_units WHERE id=(v_unit->>'id')::uuid AND course_id=p_course_id AND title=btrim(v_unit->>'title') AND sort_order=v_pos) THEN RAISE EXCEPTION 'Unit write denied' USING ERRCODE='42501'; END IF;
   v_subpos:=0;
   FOR v_topic IN SELECT value FROM jsonb_array_elements(v_unit->'sections') LOOP
     IF EXISTS(SELECT 1 FROM public.syllabus_sections WHERE id=(v_topic->>'id')::uuid AND unit_id=(v_unit->>'id')::uuid) THEN
       UPDATE public.syllabus_sections SET title=btrim(v_topic->>'title'),sort_order=v_subpos
       WHERE id=(v_topic->>'id')::uuid AND (title,sort_order) IS DISTINCT FROM (btrim(v_topic->>'title'),v_subpos);
     ELSE
       INSERT INTO public.syllabus_sections(id,unit_id,title,sort_order) VALUES((v_topic->>'id')::uuid,(v_unit->>'id')::uuid,btrim(v_topic->>'title'),v_subpos);
     END IF;
     IF NOT EXISTS(SELECT 1 FROM public.syllabus_sections WHERE id=(v_topic->>'id')::uuid AND unit_id=(v_unit->>'id')::uuid AND title=btrim(v_topic->>'title') AND sort_order=v_subpos) THEN RAISE EXCEPTION 'Topic write denied' USING ERRCODE='42501'; END IF;
     v_subpos:=v_subpos+1;
   END LOOP;
   v_pos:=v_pos+1;
 END LOOP;
 -- Detect zero-row deletes imposed by RLS too: exact final membership is mandatory.
 IF EXISTS(SELECT 1 FROM public.syllabus_units WHERE course_id=p_course_id AND NOT(id=ANY(v_units))) OR
    EXISTS(SELECT 1 FROM public.syllabus_sections s JOIN public.syllabus_units u ON u.id=s.unit_id WHERE u.course_id=p_course_id AND NOT(s.id=ANY(v_topics))) THEN
   RAISE EXCEPTION 'Syllabus deletion denied' USING ERRCODE='42501';
 END IF;
 SELECT syllabus_revision INTO v_revision FROM public.courses WHERE id=p_course_id;
 RETURN v_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.save_course_syllabus(uuid,bigint,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_course_syllabus(uuid,bigint,jsonb) TO authenticated;
COMMIT;
