-- Complete the existing 0027/0028 model, without re-keying sections or children.
BEGIN;
CREATE FUNCTION public.list_assignable_instructors(p_search text DEFAULT '',p_offset integer DEFAULT 0)
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

CREATE FUNCTION public.create_course_definition(p_id uuid,p_title text,p_code text,p_description text,p_department text,p_major text)
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
     RAISE EXCEPTION 'Definition ID already used' USING ERRCODE='40001'; END IF;
   RETURN p_id;
 END IF;
 INSERT INTO public.course_definitions(id,title,code,description,department,academic_major)
 VALUES(p_id,btrim(p_title),nullif(btrim(p_code),''),nullif(btrim(p_description),''),nullif(btrim(p_department),''),nullif(btrim(p_major),''));
 RETURN p_id;
END $$;

CREATE FUNCTION public.create_academic_section(p_id uuid,p_definition uuid,p_instructor uuid,p_label text,p_term text)
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
     RAISE EXCEPTION 'Section ID already used' USING ERRCODE='40001'; END IF;
   RETURN p_id;
 END IF;
 INSERT INTO public.courses(id,course_definition_id,instructor_id,title,course_code,description,section_label,academic_term,is_published,enrollment_open)
 VALUES(p_id,p_definition,p_instructor,v_definition.title,v_definition.code,v_definition.description,btrim(p_label),btrim(p_term),false,false);
 RETURN p_id;
END $$;

-- Administrative assignment is explicit, audited and optimistic: no generic bypass RPC.
CREATE FUNCTION public.assign_academic_section(p_section uuid,p_expected_instructor uuid,p_instructor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_target_role text; v_owner uuid;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF coalesce(v_role,'') NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'Assignment denied' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_target_role FROM public.users WHERE id=p_instructor FOR SHARE;
 IF v_target_role IS DISTINCT FROM 'instructor' THEN RAISE EXCEPTION 'Assigned instructor unavailable' USING ERRCODE='42501'; END IF;
 SELECT instructor_id INTO v_owner FROM public.courses WHERE id=p_section FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 IF v_owner IS DISTINCT FROM p_expected_instructor THEN RAISE EXCEPTION 'Assignment changed; reload' USING ERRCODE='40001'; END IF;
 IF v_owner IS DISTINCT FROM p_instructor THEN UPDATE public.courses SET instructor_id=p_instructor WHERE id=p_section; END IF;
 RETURN p_section;
END $$;
REVOKE ALL ON FUNCTION public.list_assignable_instructors(text,integer),public.create_course_definition(uuid,text,text,text,text,text),public.create_academic_section(uuid,uuid,uuid,text,text),public.assign_academic_section(uuid,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.list_assignable_instructors(text,integer),public.create_course_definition(uuid,text,text,text,text,text),public.create_academic_section(uuid,uuid,uuid,text,text),public.assign_academic_section(uuid,uuid,uuid) TO authenticated;
COMMIT;
