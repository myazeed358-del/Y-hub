BEGIN;
-- Caller-scoped boolean only, no returned private records. Definer avoids recursive RLS.
CREATE FUNCTION public.academic_section_visible(p_section_id uuid, p_content boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.courses c JOIN public.course_definitions d ON d.id=c.course_definition_id
   JOIN public.users u ON u.id=auth.uid()
   WHERE c.id=p_section_id AND (
     u.role IN ('admin','super_admin')
     OR (u.role='instructor' AND c.instructor_id=u.id)
     OR (u.role='student' AND c.is_published AND (
       EXISTS(SELECT 1 FROM public.course_enrollments e WHERE e.course_id=c.id AND e.student_id=u.id AND e.status='active')
       OR (NOT p_content AND (d.academic_major IS NULL OR d.academic_major=u.major))
     ))
   )
 );
$$;
REVOKE ALL ON FUNCTION public.academic_section_visible(uuid,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.academic_section_visible(uuid,boolean) TO authenticated;
-- Restrictive policies narrow historical permissive policies; they grant nothing.
CREATE POLICY academic_course_read ON public.courses AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.academic_section_visible(id,false));
CREATE POLICY academic_material_read ON public.course_materials AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.academic_section_visible(course_id,true));
CREATE POLICY academic_exam_read ON public.exams AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.academic_section_visible(course_id,true));
CREATE POLICY academic_question_read ON public.questions AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.academic_section_visible(course_id,true));
CREATE POLICY academic_unit_read ON public.syllabus_units AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.academic_section_visible(course_id,true));
CREATE POLICY academic_topic_read ON public.syllabus_sections AS RESTRICTIVE FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.syllabus_units u WHERE u.id=unit_id AND public.academic_section_visible(u.course_id,true)));
-- Preserve existing active enrollments even if a catalog major is later corrected.
-- New enrollment must match the actual definition, never a frontend label.
CREATE POLICY academic_enrollment_insert ON public.course_enrollments AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(EXISTS(SELECT 1 FROM public.courses c JOIN public.course_definitions d ON d.id=c.course_definition_id
 JOIN public.users u ON u.id=auth.uid() WHERE c.id=course_id AND u.role='student'
 AND (d.academic_major IS NULL OR d.academic_major=u.major)));

ALTER TABLE public.courses ADD COLUMN syllabus_revision bigint NOT NULL DEFAULT 0 CHECK(syllabus_revision>=0);
COMMENT ON COLUMN public.courses.syllabus_revision IS 'Operational CAS token, not syllabus content. Every real unit/topic mutation increments it; content changes have their own audit event.';

-- Applies to direct SQL/REST edits too; CAS cannot be bypassed by another editor.
CREATE FUNCTION yhub_academic_private.syllabus_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_course uuid;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR
      (TG_TABLE_NAME='syllabus_units' AND to_jsonb(NEW)->'course_id' IS DISTINCT FROM to_jsonb(OLD)->'course_id') OR
      (TG_TABLE_NAME='syllabus_sections' AND to_jsonb(NEW)->'unit_id' IS DISTINCT FROM to_jsonb(OLD)->'unit_id') THEN
     RAISE EXCEPTION 'Syllabus identity/parent is immutable' USING ERRCODE='22023';
   END IF;
   IF to_jsonb(NEW)=to_jsonb(OLD) THEN RETURN NEW; END IF;
 END IF;
 IF TG_TABLE_NAME='syllabus_units' THEN
   v_course := coalesce(to_jsonb(NEW)->>'course_id',to_jsonb(OLD)->>'course_id')::uuid;
 ELSE
   SELECT course_id INTO v_course FROM public.syllabus_units WHERE id=coalesce(to_jsonb(NEW)->>'unit_id',to_jsonb(OLD)->>'unit_id')::uuid;
 END IF;
 -- During cascade deletion the parent may already be gone; no orphan is created.
 UPDATE public.courses SET syllabus_revision=syllabus_revision+1 WHERE id=v_course;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION yhub_academic_private.syllabus_revision() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER syllabus_revision BEFORE INSERT OR UPDATE OR DELETE ON public.syllabus_units
FOR EACH ROW EXECUTE FUNCTION yhub_academic_private.syllabus_revision();
CREATE TRIGGER syllabus_revision BEFORE INSERT OR UPDATE OR DELETE ON public.syllabus_sections
FOR EACH ROW EXECUTE FUNCTION yhub_academic_private.syllabus_revision();
-- Clients must not forge a CAS token on courses (including through the invoker view).
CREATE FUNCTION yhub_academic_private.protect_syllabus_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND (
    (TG_OP='INSERT' AND NEW.syllabus_revision<>0) OR
    (TG_OP='UPDATE' AND NEW.syllabus_revision IS DISTINCT FROM OLD.syllabus_revision)) THEN
   RAISE EXCEPTION 'Syllabus revision is server managed' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION yhub_academic_private.protect_syllabus_revision() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_syllabus_revision BEFORE INSERT OR UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION yhub_academic_private.protect_syllabus_revision();

-- Lock/current-role authorization only; actual mutations below remain invoker/RLS.
CREATE FUNCTION public.lock_managed_syllabus(p_course_id uuid) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_owner uuid; v_revision bigint;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') THEN
   RAISE EXCEPTION 'Syllabus management denied' USING ERRCODE='42501';
 END IF;
 SELECT instructor_id,syllabus_revision INTO v_owner,v_revision FROM public.courses WHERE id=p_course_id FOR UPDATE;
 IF NOT FOUND OR v_owner IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Syllabus management denied' USING ERRCODE='42501';
 END IF;
 RETURN v_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_managed_syllabus(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.lock_managed_syllabus(uuid) TO authenticated;

CREATE FUNCTION public.read_course_syllabus(p_course_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('courseId',c.id,'revision',c.syllabus_revision,'units',coalesce((
  SELECT jsonb_agg(jsonb_build_object('id',u.id,'title',u.title,'sections',coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',s.id,'title',s.title) ORDER BY s.sort_order,s.id)
   FROM public.syllabus_sections s WHERE s.unit_id=u.id),'[]'::jsonb)) ORDER BY u.sort_order,u.id)
  FROM public.syllabus_units u WHERE u.course_id=c.id),'[]'::jsonb))
 FROM public.courses c WHERE c.id=p_course_id AND public.academic_section_visible(c.id,true);
$$;
REVOKE ALL ON FUNCTION public.read_course_syllabus(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.read_course_syllabus(uuid) TO authenticated;

CREATE FUNCTION public.save_course_syllabus(p_course_id uuid,p_expected_revision bigint,p_units jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_revision bigint; v_unit jsonb; v_topic jsonb; v_units uuid[] := '{}'; v_topics uuid[] := '{}'; v_id uuid; v_pos integer; v_subpos integer;
BEGIN
 v_revision := public.lock_managed_syllabus(p_course_id);
 IF p_expected_revision IS NULL OR p_expected_revision<>v_revision THEN
   RAISE EXCEPTION 'Syllabus changed; retain edits and reload before retrying' USING ERRCODE='40001';
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
-- Do not resurrect a historical section identity through an explicit-definition insert.
-- This keeps old URLs/audit references from pointing at a new section with the same UUID.
CREATE FUNCTION yhub_academic_private.reject_reused_section_id() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.audit_events WHERE entity_type='courses' AND entity_id=NEW.id AND operation='DELETE') THEN
   RAISE EXCEPTION 'Deleted section IDs cannot be reused' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION yhub_academic_private.reject_reused_section_id() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER reject_reused_section_id BEFORE INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION yhub_academic_private.reject_reused_section_id();
COMMIT;
