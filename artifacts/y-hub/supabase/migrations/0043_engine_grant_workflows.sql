-- Decisions 11-14/34. Independent of attendance reporting0042; no historical SQL changes.
BEGIN;
ALTER TABLE public.engine_grants ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.engine_grants ADD COLUMN revocation_reason text CHECK(revocation_reason IN ('manual','withdrawal','assignment','identity','expired'));
COMMENT ON COLUMN public.engine_grants.expires_at IS 'NULL means the active enrollment/assignment lifetime; current-role checks still apply.';
COMMENT ON COLUMN public.engine_grants.revocation_reason IS 'Trusted mutation cause; historical NULL reasons are not inferred.';
CREATE OR REPLACE FUNCTION yhub_access_private.allowed(p_actor uuid,p_module text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.module_policies m ON m.id=p_module
 WHERE u.id=p_actor AND m.enabled AND u.role=ANY(m.roles) AND cardinality(m.permissions)=0
 AND (NOT u.role=ANY(m.restricted_roles) OR cardinality(m.majors)=0 OR u.major=ANY(m.majors)
 OR (u.role='student' AND m.kind='engine' AND EXISTS(
 SELECT 1 FROM public.engine_grants g JOIN public.courses c ON c.id=g.course_id
 JOIN public.course_enrollments e ON e.course_id=c.id AND e.student_id=g.student_id
 WHERE g.student_id=u.id AND g.engine_id=m.id AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>statement_timestamp())
 AND e.status='active' AND c.instructor_id=g.granted_by
 AND yhub_access_private.can_delegate(g.granted_by,m.id)))));
$$;
CREATE FUNCTION yhub_access_private.grant_one(p_course uuid,p_student uuid,p_engine text,p_expires timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_owner uuid;v_status text;
BEGIN
 -- Stable role/major, course owner and enrollment while authorizing + writing.
 PERFORM id FROM public.users WHERE id=ANY(ARRAY[auth.uid(),p_student]) ORDER BY id FOR SHARE;
 PERFORM id FROM public.module_policies WHERE id=p_engine FOR SHARE;
 IF NOT yhub_access_private.can_delegate(auth.uid(),p_engine) THEN RAISE EXCEPTION 'Engine delegation denied' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_student AND role='student') THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='42501'; END IF;
 SELECT instructor_id INTO v_owner FROM public.courses WHERE id=p_course FOR SHARE;
 IF v_owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Section management denied' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_status FROM public.course_enrollments WHERE course_id=p_course AND student_id=p_student FOR SHARE;
 IF v_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Active enrollment required' USING ERRCODE='42501'; END IF;
 IF p_expires IS NOT NULL AND (p_expires<=clock_timestamp() OR p_expires>clock_timestamp()+interval '366 days') THEN RAISE EXCEPTION 'Invalid expiry' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_course::text||p_student::text||p_engine,0));
 -- An expired row may be replaced; old audit history and old grant identity survive.
 UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid(),revocation_reason='expired'
 WHERE course_id=p_course AND student_id=p_student AND engine_id=p_engine AND revoked_at IS NULL AND expires_at<=clock_timestamp();
 SELECT id INTO v_id FROM public.engine_grants WHERE course_id=p_course AND student_id=p_student AND engine_id=p_engine AND revoked_at IS NULL;
 IF FOUND THEN RETURN v_id; END IF;
 INSERT INTO public.engine_grants(course_id,student_id,engine_id,granted_by,expires_at)
 VALUES(p_course,p_student,p_engine,auth.uid(),p_expires) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.revoke_engine_access(p_grant uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;v_grant public.engine_grants;v_owner uuid;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') THEN RAISE EXCEPTION 'Revocation denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_grant FROM public.engine_grants WHERE id=p_grant;
 IF NOT FOUND THEN RAISE EXCEPTION 'Grant unavailable' USING ERRCODE='42501'; END IF;
 SELECT instructor_id INTO v_owner FROM public.courses WHERE id=v_grant.course_id FOR SHARE;
 -- Lock parent before child, matching assignment invalidation and batch creation.
 SELECT * INTO v_grant FROM public.engine_grants WHERE id=p_grant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Grant unavailable' USING ERRCODE='42501'; END IF;
 IF v_role='instructor' AND v_owner IS DISTINCT FROM auth.uid() THEN
 RAISE EXCEPTION 'Grant unavailable' USING ERRCODE='42501'; END IF;
 UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid(),revocation_reason='manual' WHERE id=p_grant AND revoked_at IS NULL;
 RETURN p_grant;
END $$;
CREATE OR REPLACE FUNCTION yhub_access_private.invalidate_grants() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='course_enrollments' THEN
  IF TG_OP='DELETE' OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'active') THEN
   UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid(),revocation_reason='withdrawal' WHERE course_id=OLD.course_id AND student_id=OLD.student_id AND revoked_at IS NULL;
  END IF;
 ELSIF TG_TABLE_NAME='courses' THEN
  IF NEW.instructor_id IS DISTINCT FROM OLD.instructor_id THEN UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid(),revocation_reason='assignment' WHERE course_id=OLD.id AND revoked_at IS NULL; END IF;
 ELSIF TG_TABLE_NAME='users' THEN
  IF (NEW.role,NEW.major) IS DISTINCT FROM (OLD.role,OLD.major) THEN UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid(),revocation_reason='identity' WHERE (granted_by=OLD.id OR student_id=OLD.id) AND revoked_at IS NULL; END IF;
 END IF;
 RETURN NULL;
END $$;
-- Keep the original single-engine API's explicit-expiry validation for old clients.
CREATE OR REPLACE FUNCTION public.grant_engine_access(p_course uuid,p_student uuid,p_engine text,p_expires timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_expires IS NULL THEN RAISE EXCEPTION 'Explicit expiry required by legacy API' USING ERRCODE='22023'; END IF;
 RETURN yhub_access_private.grant_one(p_course,p_student,p_engine,p_expires);
END $$;
CREATE FUNCTION public.grant_engine_access_batch(p_course uuid,p_student uuid,p_engines text[],p_expires timestamptz DEFAULT NULL) RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_engine text;v_ids uuid[]:='{}';BEGIN
 IF p_engines IS NULL OR cardinality(p_engines) NOT BETWEEN 1 AND 20
 OR EXISTS(SELECT 1 FROM unnest(p_engines) e WHERE e IS NULL OR length(e)>100)
 OR (SELECT count(DISTINCT e) FROM unnest(p_engines) e)<>cardinality(p_engines) THEN
 RAISE EXCEPTION 'Select 1-20 distinct engines for one student' USING ERRCODE='22023'; END IF;
 -- One transaction; deterministic ordering also serializes concurrent retry batches.
 FOR v_engine IN SELECT e FROM unnest(p_engines) e ORDER BY e LOOP
  v_ids:=array_append(v_ids,yhub_access_private.grant_one(p_course,p_student,v_engine,p_expires));
 END LOOP;
 RETURN v_ids;
END $$;
REVOKE ALL ON FUNCTION yhub_access_private.grant_one(uuid,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER audit_capture ON public.engine_grants;
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.engine_grants FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,course_id,student_id,engine_id,granted_by,created_at,expires_at,revoked_at,revoked_by,revocation_reason','id,course_id,student_id,engine_id,granted_by,created_at,expires_at,revoked_at,revoked_by,revocation_reason','ordinary');
CREATE FUNCTION public.search_engine_students(p_course uuid DEFAULT NULL,p_search text DEFAULT '',p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;v_result jsonb;BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid();
 IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') THEN RAISE EXCEPTION 'Search denied' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>100 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
 IF p_course IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.courses c WHERE c.id=p_course AND (v_role IN ('admin','super_admin') OR c.instructor_id=auth.uid())) THEN RAISE EXCEPTION 'Section denied' USING ERRCODE='42501'; END IF;
 WITH members AS (SELECT course_id,student_id FROM public.course_enrollments UNION SELECT course_id,student_id FROM public.engine_grants),
 scoped AS MATERIALIZED (
 SELECT u.id AS student_id,u.full_name,u.user_number,c.id AS course_id,c.title,c.section_label,
  (u.role='student' AND EXISTS(SELECT 1 FROM public.course_enrollments e WHERE e.course_id=c.id AND e.student_id=u.id AND e.status='active')) AS active_enrollment
 FROM members m JOIN public.courses c ON c.id=m.course_id JOIN public.users u ON u.id=m.student_id
 WHERE (v_role IN ('admin','super_admin') OR c.instructor_id=auth.uid()) AND (p_course IS NULL OR c.id=p_course)
 AND (coalesce(btrim(p_search),'')='' OR strpos(lower(coalesce(u.full_name,'')),lower(btrim(p_search)))>0 OR strpos(u.user_number,btrim(p_search))>0)
 ) SELECT jsonb_build_object('total',(SELECT count(*) FROM scoped),
 'rows',(SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY full_name,student_id,course_id),'[]') FROM (SELECT * FROM scoped ORDER BY full_name,student_id,course_id LIMIT 50 OFFSET p_offset) page)) INTO v_result;
 RETURN v_result;
END $$;
CREATE FUNCTION public.engine_grant_history(p_course uuid DEFAULT NULL,p_student uuid DEFAULT NULL,p_active boolean DEFAULT true,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;v_result jsonb;BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid();
 IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') THEN RAISE EXCEPTION 'History denied' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_active IS NULL THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
 IF p_course IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.courses c WHERE c.id=p_course AND (v_role IN ('admin','super_admin') OR c.instructor_id=auth.uid())) THEN RAISE EXCEPTION 'Section denied' USING ERRCODE='42501'; END IF;
 WITH scoped AS (
 SELECT g.id,g.course_id,g.student_id,g.engine_id,g.expires_at,g.revoked_at,g.revocation_reason,g.created_at,u.full_name,u.user_number,c.title,c.section_label,
 CASE WHEN g.revoked_at IS NOT NULL THEN coalesce(g.revocation_reason,'revoked')
 WHEN g.expires_at<=statement_timestamp() THEN 'expired'
 WHEN u.role='student' AND c.instructor_id=g.granted_by AND yhub_access_private.can_delegate(g.granted_by,g.engine_id)
 AND EXISTS(SELECT 1 FROM public.course_enrollments e WHERE e.course_id=c.id AND e.student_id=u.id AND e.status='active') THEN 'active'
 ELSE 'unavailable' END AS state
 FROM public.engine_grants g JOIN public.courses c ON c.id=g.course_id JOIN public.users u ON u.id=g.student_id
 WHERE (v_role IN ('admin','super_admin') OR c.instructor_id=auth.uid()) AND (p_course IS NULL OR c.id=p_course) AND (p_student IS NULL OR u.id=p_student)
 ), filtered AS MATERIALIZED (SELECT * FROM scoped WHERE (state='active')=p_active)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),
 'rows',(SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id),'[]') FROM (SELECT * FROM filtered ORDER BY created_at DESC,id LIMIT 100 OFFSET p_offset) page)) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.grant_engine_access_batch(uuid,uuid,text[],timestamptz),public.search_engine_students(uuid,text,integer),public.engine_grant_history(uuid,uuid,boolean,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.grant_engine_access_batch(uuid,uuid,text[],timestamptz),public.search_engine_students(uuid,text,integer),public.engine_grant_history(uuid,uuid,boolean,integer) TO authenticated;
COMMIT;
