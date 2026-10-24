BEGIN;
ALTER TABLE public.academic_lectures ADD COLUMN delivery_mode text NOT NULL DEFAULT 'in_person' CHECK(delivery_mode IN ('in_person','online'));
DROP TRIGGER audit_capture ON public.academic_lectures;
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.academic_lectures FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,course_id,title,starts_at,ends_at,cancelled,created_by,created_at,delivery_mode','id,course_id,starts_at,ends_at,cancelled,created_by,created_at,delivery_mode','ordinary');
CREATE FUNCTION public.schedule_online_lecture(p_course uuid,p_title text,p_start timestamptz,p_end timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v_id uuid;BEGIN
 PERFORM yhub_attendance_private.lock_manager(p_course);
 IF p_start IS NULL OR p_start<clock_timestamp()-interval '1 day' OR p_start>clock_timestamp()+interval '2 years' THEN RAISE EXCEPTION 'Invalid lecture date' USING ERRCODE='22023'; END IF;
 INSERT INTO public.academic_lectures(course_id,title,starts_at,ends_at,created_by,delivery_mode) VALUES(p_course,btrim(p_title),p_start,p_end,auth.uid(),'online') RETURNING id INTO v_id;RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.schedule_online_lecture(uuid,text,timestamptz,timestamptz) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.schedule_online_lecture(uuid,text,timestamptz,timestamptz) TO authenticated;

CREATE SCHEMA yhub_live_private;
REVOKE ALL ON SCHEMA yhub_live_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.lecture_access_blocks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lecture_id uuid NOT NULL REFERENCES public.academic_lectures(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,blocked_by uuid NOT NULL,reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 500),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(lecture_id,student_id)
);
ALTER TABLE public.lecture_access_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lecture_access_blocks FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.lecture_access_blocks TO authenticated;
CREATE POLICY lecture_blocks_review ON public.lecture_access_blocks FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.academic_lectures l WHERE l.id=lecture_id AND yhub_attendance_private.manages(l.course_id)));
CREATE FUNCTION yhub_live_private.allowed(p_lecture uuid,p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.academic_lectures l JOIN public.courses c ON c.id=l.course_id JOIN public.users u ON u.id=p_user
 WHERE l.id=p_lecture AND l.delivery_mode='online' AND NOT l.cancelled AND statement_timestamp() BETWEEN l.starts_at-interval '15 minutes' AND l.ends_at
 AND (u.role IN ('admin','super_admin') OR (u.role='instructor' AND c.instructor_id=u.id) OR (u.role='student'
 AND EXISTS(SELECT 1 FROM public.course_enrollments e WHERE e.course_id=c.id AND e.student_id=u.id AND e.status='active')
 AND NOT EXISTS(SELECT 1 FROM public.lecture_access_blocks b WHERE b.lecture_id=l.id AND b.student_id=u.id))))
$$;
REVOKE ALL ON FUNCTION yhub_live_private.allowed(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.lecture_join_permission(p_lecture uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v_course uuid;v_role text;v_name text;BEGIN
 SELECT role,left(full_name,120) INTO v_role,v_name FROM public.users WHERE id=auth.uid() FOR SHARE;
 SELECT course_id INTO v_course FROM public.academic_lectures WHERE id=p_lecture;
 PERFORM id FROM public.courses WHERE id=v_course FOR SHARE;
 PERFORM id FROM public.academic_lectures WHERE id=p_lecture FOR SHARE;
 PERFORM id FROM public.course_enrollments WHERE course_id=v_course AND student_id=auth.uid() FOR SHARE;
 IF NOT yhub_live_private.allowed(p_lecture,auth.uid()) THEN RAISE EXCEPTION 'Lecture access denied' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('identity',auth.uid(),'name',coalesce(v_name,''),'room','yhub-lecture-'||p_lecture::text,'moderator',v_role IN ('instructor','admin','super_admin'));
END $$;
CREATE FUNCTION public.block_lecture_participant(p_lecture uuid,p_student uuid,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v_course uuid;v_id uuid;v_target_role text;BEGIN
 SELECT course_id INTO v_course FROM public.academic_lectures WHERE id=p_lecture;
 PERFORM yhub_attendance_private.lock_manager(v_course);
 SELECT role INTO v_target_role FROM public.users WHERE id=p_student FOR SHARE;
 IF p_student IS NULL OR p_student=auth.uid() OR v_target_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Only student participants may be removed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.course_enrollments WHERE course_id=v_course AND student_id=p_student) THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.lecture_access_blocks(lecture_id,student_id,blocked_by,reason) VALUES(p_lecture,p_student,auth.uid(),p_reason)
 ON CONFLICT(lecture_id,student_id) DO UPDATE SET reason=EXCLUDED.reason,blocked_by=auth.uid() RETURNING id INTO v_id;RETURN v_id;
END $$;
-- Service-only authorization for the scheduled provider reconciler. Never a browser RPC.
CREATE FUNCTION public.lecture_participant_allowed(p_lecture uuid,p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT yhub_live_private.allowed(p_lecture,p_user) $$;
REVOKE ALL ON FUNCTION public.lecture_participant_allowed(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lecture_participant_allowed(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.lecture_join_permission(uuid),public.block_lecture_participant(uuid,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.lecture_join_permission(uuid),public.block_lecture_participant(uuid,uuid,text) TO authenticated;
CREATE TRIGGER audit_lock_actor BEFORE INSERT OR UPDATE OR DELETE ON public.lecture_access_blocks FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.lock_actor();
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.lecture_access_blocks FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,lecture_id,student_id,blocked_by,reason,created_at','id,lecture_id,student_id,blocked_by,created_at','ordinary');
CREATE TRIGGER audit_block_truncate BEFORE TRUNCATE ON public.lecture_access_blocks FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.reject_truncate();
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('online-lectures','application',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY[]::text[],ARRAY['student','instructor','admin','super_admin']::text[],ARRAY[]::text[],'[{"path":"/online-lectures","title":{"ar":"المحاضرات المباشرة","en":"Online lectures"},"icon":"box","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
CREATE FUNCTION public.my_online_lecture_sections() RETURNS TABLE(id uuid,title text,section_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.id,c.title,c.section_label FROM public.courses c WHERE yhub_attendance_private.manages(c.id) OR yhub_attendance_private.enrolled(c.id) ORDER BY c.title,c.id
$$;
REVOKE ALL ON FUNCTION public.my_online_lecture_sections() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.my_online_lecture_sections() TO authenticated;
COMMIT;
