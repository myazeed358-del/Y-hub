-- Decisions27/41: reversible manual completion and server-verifiable exam activities.
BEGIN;
CREATE TABLE public.lesson_completion_rules (
 id uuid PRIMARY KEY REFERENCES public.syllabus_sections(id) ON DELETE CASCADE,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
 mode text NOT NULL CHECK(mode IN ('manual','all','any')),
 exam_ids uuid[] NOT NULL DEFAULT '{}',
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 CHECK(cardinality(exam_ids)<=20), CHECK(array_position(exam_ids,NULL) IS NULL),
 CHECK((mode='manual' AND cardinality(exam_ids)=0) OR (mode<>'manual' AND cardinality(exam_ids)>0))
);
CREATE TABLE public.lesson_completion_overrides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 topic_id uuid NOT NULL REFERENCES public.syllabus_sections(id) ON DELETE CASCADE,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 completed boolean,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(topic_id,student_id)
);
CREATE INDEX lesson_rules_course ON public.lesson_completion_rules(course_id);
CREATE INDEX lesson_overrides_student_course ON public.lesson_completion_overrides(student_id,course_id);
ALTER TABLE public.lesson_completion_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completion_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completion_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completion_overrides FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_completion_rules,public.lesson_completion_overrides FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.lesson_completion_rules,public.lesson_completion_overrides TO authenticated;
CREATE POLICY learning_rules_read ON public.lesson_completion_rules FOR SELECT TO authenticated USING(public.academic_section_visible(course_id,true));
CREATE POLICY learning_own_progress ON public.lesson_completion_overrides FOR SELECT TO authenticated USING(student_id=auth.uid() AND public.audit_reader_role()='student' AND public.academic_section_visible(course_id,true));
-- Both manual changes and instructor conditions are required audited writes.
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.lesson_completion_rules FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,course_id,mode,exam_ids,revision','id,course_id,mode,exam_ids,revision','ordinary');
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.lesson_completion_overrides FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,topic_id,course_id,student_id,completed,revision,updated_at','id,topic_id,course_id,student_id,completed,revision,updated_at','reserved');

CREATE FUNCTION public.set_lesson_completion(p_topic uuid,p_expected_revision bigint,p_state text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_course uuid; v_old public.lesson_completion_overrides; v_value boolean; v_revision bigint;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student access required' USING ERRCODE='42501'; END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<0 OR p_state IS NULL OR p_state NOT IN ('completed','incomplete','automatic') THEN RAISE EXCEPTION 'Invalid completion' USING ERRCODE='22023'; END IF;
 SELECT u.course_id INTO v_course FROM public.syllabus_sections s JOIN public.syllabus_units u ON u.id=s.unit_id WHERE s.id=p_topic;
 PERFORM 1 FROM public.courses WHERE id=v_course AND is_published FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.course_enrollments WHERE course_id=v_course AND student_id=auth.uid() AND status='active' FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.syllabus_sections WHERE id=p_topic) THEN RAISE EXCEPTION 'Enrollment required' USING ERRCODE='42501'; END IF;
 -- Serialize this learner/topic, including the first insert, without serializing the whole class.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_topic::text||':'||auth.uid()::text,0));
 v_value:=CASE p_state WHEN 'completed' THEN true WHEN 'incomplete' THEN false ELSE NULL END;
 SELECT * INTO v_old FROM public.lesson_completion_overrides WHERE topic_id=p_topic AND student_id=auth.uid() FOR UPDATE;
 IF FOUND AND v_old.completed IS NOT DISTINCT FROM v_value THEN RETURN v_old.revision; END IF;
 IF p_expected_revision<>coalesce(v_old.revision,0) THEN RAISE EXCEPTION 'Completion changed; reload' USING ERRCODE='PT409'; END IF;
 IF v_old.id IS NULL AND v_value IS NULL THEN RETURN 0; END IF;
 INSERT INTO public.lesson_completion_overrides(topic_id,course_id,student_id,completed)
 VALUES(p_topic,v_course,auth.uid(),v_value)
 ON CONFLICT(topic_id,student_id) DO UPDATE SET completed=EXCLUDED.completed,revision=lesson_completion_overrides.revision+1,updated_at=clock_timestamp()
 RETURNING revision INTO v_revision;
 RETURN v_revision;
END $$;

CREATE FUNCTION public.set_lesson_completion_rule(p_topic uuid,p_expected_revision bigint,p_mode text,p_exam_ids uuid[])
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_course uuid; v_old public.lesson_completion_rules; v_ids uuid[]; v_revision bigint;
BEGIN
 IF p_expected_revision IS NULL OR p_expected_revision<0 OR p_mode IS NULL OR p_mode NOT IN ('manual','all','any') OR p_exam_ids IS NULL
 OR cardinality(p_exam_ids)>20 OR array_position(p_exam_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid completion rule' USING ERRCODE='22023'; END IF;
 SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO v_ids FROM (SELECT DISTINCT unnest(p_exam_ids) id) x;
 IF (p_mode='manual' AND cardinality(v_ids)<>0) OR (p_mode<>'manual' AND cardinality(v_ids)=0) THEN RAISE EXCEPTION 'Choose activities' USING ERRCODE='22023'; END IF;
 SELECT u.course_id INTO v_course FROM public.syllabus_sections s JOIN public.syllabus_units u ON u.id=s.unit_id WHERE s.id=p_topic;
 PERFORM public.lock_managed_syllabus(v_course); -- current role, assigned owner, parent lock
 IF NOT EXISTS(SELECT 1 FROM public.syllabus_sections WHERE id=p_topic) THEN RAISE EXCEPTION 'Topic unavailable' USING ERRCODE='42501'; END IF;
 -- Lock activity rows against concurrent move/delete/unpublish while validating.
 PERFORM 1 FROM public.exams WHERE id=ANY(v_ids) ORDER BY id FOR SHARE;
 IF (SELECT count(*) FROM public.exams WHERE id=ANY(v_ids) AND course_id=v_course AND is_published)<>cardinality(v_ids) THEN RAISE EXCEPTION 'Activity unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_old FROM public.lesson_completion_rules WHERE id=p_topic FOR UPDATE;
 IF FOUND AND (v_old.mode,v_old.exam_ids) IS NOT DISTINCT FROM (p_mode,v_ids) THEN RETURN v_old.revision; END IF;
 IF p_expected_revision<>coalesce(v_old.revision,0) THEN RAISE EXCEPTION 'Rule changed; reload' USING ERRCODE='PT409'; END IF;
 INSERT INTO public.lesson_completion_rules(id,course_id,mode,exam_ids) VALUES(p_topic,v_course,p_mode,v_ids)
 ON CONFLICT(id) DO UPDATE SET mode=EXCLUDED.mode,exam_ids=EXCLUDED.exam_ids,revision=lesson_completion_rules.revision+1
 RETURNING revision INTO v_revision;
 RETURN v_revision;
END $$;

CREATE FUNCTION public.read_lesson_progress(p_course uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_topics jsonb; v_exams jsonb; v_owner uuid;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid();
 IF NOT public.academic_section_visible(p_course,true) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 SELECT instructor_id INTO v_owner FROM public.courses WHERE id=p_course;
 WITH topics AS (
  SELECT s.id,s.title,u.sort_order unit_order,s.sort_order topic_order,
   coalesce(r.mode,'manual') mode,coalesce(r.exam_ids,'{}'::uuid[]) exam_ids,coalesce(r.revision,0) rule_revision,
   o.completed manual,coalesce(o.revision,0) revision,o.updated_at,
   (SELECT count(*) FROM public.exams e WHERE e.id=ANY(r.exam_ids) AND e.course_id=p_course AND e.is_published
    AND EXISTS(SELECT 1 FROM public.exam_attempts a WHERE a.exam_id=e.id AND a.student_id=auth.uid() AND a.status='submitted')) fulfilled
  FROM public.syllabus_sections s JOIN public.syllabus_units u ON u.id=s.unit_id
  LEFT JOIN public.lesson_completion_rules r ON r.id=s.id
  LEFT JOIN public.lesson_completion_overrides o ON o.topic_id=s.id AND o.student_id=auth.uid() AND v_role='student'
  WHERE u.course_id=p_course
 ), evaluated AS (
  SELECT *, v_role='student' AND coalesce(manual,mode<>'manual' AND cardinality(exam_ids)>0 AND
   CASE mode WHEN 'all' THEN fulfilled=cardinality(exam_ids) WHEN 'any' THEN fulfilled>0 ELSE false END) completed FROM topics
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'mode',mode,'examIds',exam_ids,'ruleRevision',rule_revision,
  'manual',manual,'revision',revision,'completed',completed,'fulfilled',fulfilled,'updatedAt',updated_at)
  ORDER BY unit_order,topic_order,id),'[]'::jsonb) INTO v_topics FROM evaluated;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title) ORDER BY title,id),'[]'::jsonb) INTO v_exams
 FROM (SELECT id,title FROM public.exams WHERE course_id=p_course AND is_published ORDER BY title,id LIMIT 200) e;
 RETURN jsonb_build_object('courseId',p_course,'student',v_role='student','canManage',v_role IN ('instructor','admin','super_admin') AND v_owner=auth.uid(),
  'topics',v_topics,'exams',v_exams,'examChoicesLimited',(SELECT count(*)>200 FROM public.exams WHERE course_id=p_course AND is_published));
END $$;
REVOKE ALL ON FUNCTION public.set_lesson_completion(uuid,bigint,text),public.set_lesson_completion_rule(uuid,bigint,text,uuid[]),public.read_lesson_progress(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.set_lesson_completion(uuid,bigint,text),public.set_lesson_completion_rule(uuid,bigint,text,uuid[]),public.read_lesson_progress(uuid) TO authenticated;
COMMIT;
