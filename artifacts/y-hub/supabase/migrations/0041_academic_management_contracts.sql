-- Reconcile existing Phase3 contracts with main (0040 is reserved by attendance).
-- No copied section store, historical migration edits or workbook changes.
-- Complete the existing 0027/0028 model, without re-keying sections or children.
BEGIN;
CREATE OR REPLACE FUNCTION public.list_assignable_instructors(p_search text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE users.id=auth.uid();
 IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>100 THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT u.id,u.full_name FROM public.users u WHERE u.role='instructor'
 AND (v_role IN ('admin','super_admin') OR u.id=auth.uid())
 AND (coalesce(p_search,'')='' OR u.full_name ILIKE '%'||p_search||'%')
 ORDER BY u.full_name,u.id LIMIT 50 OFFSET p_offset;
END $$;

CREATE OR REPLACE FUNCTION public.create_course_definition(p_id uuid,p_title text,p_code text,p_description text,p_department text,p_major text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_existing public.course_definitions;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF coalesce(v_role,'') NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'Catalog administration required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 200
 OR length(coalesce(p_code,''))>100 OR length(coalesce(p_description,''))>4000
 OR length(coalesce(p_department,''))>200 OR length(coalesce(p_major,''))>100 THEN
   RAISE EXCEPTION 'Invalid definition' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO v_existing FROM public.course_definitions WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
   IF (v_existing.title,v_existing.code,v_existing.description,v_existing.department,v_existing.academic_major)
    IS DISTINCT FROM (btrim(p_title),nullif(btrim(p_code),''),nullif(btrim(p_description),''),nullif(btrim(p_department),''),nullif(btrim(p_major),'')) THEN
     RAISE EXCEPTION 'Definition ID already used' USING ERRCODE='PT409'; END IF;
   RETURN p_id;
 END IF;
 INSERT INTO public.course_definitions(id,title,code,description,department,academic_major)
 VALUES(p_id,btrim(p_title),nullif(btrim(p_code),''),nullif(btrim(p_description),''),nullif(btrim(p_department),''),nullif(btrim(p_major),''));
 RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_academic_section(p_id uuid,p_definition uuid,p_instructor uuid,p_label text,p_term text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_target_role text; v_definition public.course_definitions; v_existing public.courses;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') OR (v_role='instructor' AND p_instructor IS DISTINCT FROM auth.uid()) THEN
   RAISE EXCEPTION 'Section creation denied' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_label IS NULL OR length(btrim(p_label)) NOT BETWEEN 1 AND 100
 OR p_term IS NULL OR length(btrim(p_term)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid section' USING ERRCODE='22023'; END IF;
 SELECT role INTO v_target_role FROM public.users WHERE id=p_instructor FOR SHARE;
 IF v_target_role IS DISTINCT FROM 'instructor' THEN RAISE EXCEPTION 'Assigned instructor unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_definition FROM public.course_definitions WHERE id=p_definition FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Definition unavailable' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO v_existing FROM public.courses WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
   IF (v_existing.course_definition_id,v_existing.instructor_id,v_existing.section_label,v_existing.academic_term)
     IS DISTINCT FROM (p_definition,p_instructor,btrim(p_label),btrim(p_term)) THEN
     RAISE EXCEPTION 'Section ID already used' USING ERRCODE='PT409'; END IF;
   RETURN p_id;
 END IF;
 INSERT INTO public.courses(id,course_definition_id,instructor_id,title,course_code,description,section_label,academic_term,is_published,enrollment_open)
 VALUES(p_id,p_definition,p_instructor,v_definition.title,v_definition.code,v_definition.description,btrim(p_label),btrim(p_term),false,false);
 RETURN p_id;
END $$;

-- Administrative assignment is explicit, audited and optimistic: no generic bypass RPC.
CREATE OR REPLACE FUNCTION public.assign_academic_section(p_section uuid,p_expected_instructor uuid,p_instructor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_target_role text; v_owner uuid;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF coalesce(v_role,'') NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'Assignment denied' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_target_role FROM public.users WHERE id=p_instructor FOR SHARE;
 IF v_target_role IS DISTINCT FROM 'instructor' THEN RAISE EXCEPTION 'Assigned instructor unavailable' USING ERRCODE='42501'; END IF;
 SELECT instructor_id INTO v_owner FROM public.courses WHERE id=p_section FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 IF v_owner IS DISTINCT FROM p_expected_instructor THEN RAISE EXCEPTION 'Assignment changed; reload' USING ERRCODE='PT409'; END IF;
 IF v_owner IS DISTINCT FROM p_instructor THEN UPDATE public.courses SET instructor_id=p_instructor WHERE id=p_section; END IF;
 RETURN p_section;
END $$;
REVOKE ALL ON FUNCTION public.list_assignable_instructors(text,integer),public.create_course_definition(uuid,text,text,text,text,text),public.create_academic_section(uuid,uuid,uuid,text,text),public.assign_academic_section(uuid,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.list_assignable_instructors(text,integer),public.create_course_definition(uuid,text,text,text,text,text),public.create_academic_section(uuid,uuid,uuid,text,text),public.assign_academic_section(uuid,uuid,uuid) TO authenticated;

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

-- INSERT ... RETURNING cannot look up the just-inserted course through the STABLE
-- visibility helper. Staff visibility is determined from the row being checked;
-- students retain the existing publication/major/enrollment predicate unchanged.
DROP POLICY academic_course_read ON public.courses;
CREATE POLICY academic_course_read ON public.courses AS RESTRICTIVE FOR SELECT TO authenticated
USING ((SELECT public.audit_reader_role()) IN ('admin','super_admin')
 OR ((SELECT public.audit_reader_role())='instructor' AND instructor_id=auth.uid())
 OR public.academic_section_visible(id,false));
-- Deployment metadata generated from the automatically discovered API v2 manifest.
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('academic-management','application',ARRAY['instructor','admin','super_admin']::text[],ARRAY[]::text[],ARRAY['instructor','admin','super_admin']::text[],ARRAY[]::text[],'[{"path":"/academic-management","title":{"en":"Academic management","ar":"الإدارة الأكاديمية"},"icon":"grid2x2","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
COMMIT;
