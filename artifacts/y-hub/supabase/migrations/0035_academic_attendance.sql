-- Section lectures and attendance. All writes are server-authorized and audited.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA yhub_attendance_private;
REVOKE ALL ON SCHEMA yhub_attendance_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.academic_lectures(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '12 hours'),
 cancelled boolean NOT NULL DEFAULT false,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,course_id)
);
CREATE INDEX academic_lectures_upcoming ON public.academic_lectures(course_id,starts_at);
CREATE TABLE public.attendance_sessions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lecture_id uuid NOT NULL UNIQUE,course_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),closed_at timestamptz,
 FOREIGN KEY(lecture_id,course_id) REFERENCES public.academic_lectures(id,course_id) ON DELETE CASCADE, UNIQUE(id,course_id)
);
CREATE TABLE yhub_attendance_private.secrets(session_id uuid PRIMARY KEY REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,secret bytea NOT NULL);
CREATE TABLE public.attendance_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL,course_id uuid NOT NULL,
 student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,status text NOT NULL CHECK(status IN ('present','absent','excused')),
 method text NOT NULL CHECK(method IN ('qr','manual','roster')),reason text,updated_by uuid,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(session_id,course_id) REFERENCES public.attendance_sessions(id,course_id) ON DELETE CASCADE,
 UNIQUE(session_id,student_id)
);
CREATE INDEX attendance_student ON public.attendance_records(student_id,session_id);
CREATE FUNCTION yhub_attendance_private.manages(p_course uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.courses c ON c.id=p_course WHERE u.id=auth.uid()
 AND (u.role IN ('admin','super_admin') OR (u.role='instructor' AND c.instructor_id=u.id)))
$$;
CREATE FUNCTION yhub_attendance_private.enrolled(p_course uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.course_enrollments e ON e.student_id=u.id
 WHERE u.id=auth.uid() AND u.role='student' AND e.course_id=p_course AND e.status='active')
$$;
CREATE FUNCTION yhub_attendance_private.lock_manager(p_course uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM id FROM public.users WHERE id=auth.uid() FOR SHARE;
 PERFORM id FROM public.courses WHERE id=p_course FOR SHARE;
 IF NOT yhub_attendance_private.manages(p_course) THEN RAISE EXCEPTION 'Section management denied' USING ERRCODE='42501'; END IF;
END $$;
-- Private helpers are not callable through RPC. Policies invoke them under a narrowly granted schema.
GRANT USAGE ON SCHEMA yhub_attendance_private TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA yhub_attendance_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION yhub_attendance_private.manages(uuid),yhub_attendance_private.enrolled(uuid) TO authenticated;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['academic_lectures','attendance_sessions','attendance_records'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE POLICY lectures_read ON public.academic_lectures FOR SELECT TO authenticated USING(yhub_attendance_private.manages(course_id) OR yhub_attendance_private.enrolled(course_id));
CREATE POLICY sessions_read ON public.attendance_sessions FOR SELECT TO authenticated USING(yhub_attendance_private.manages(course_id) OR yhub_attendance_private.enrolled(course_id) OR EXISTS(SELECT 1 FROM public.attendance_records r WHERE r.session_id=attendance_sessions.id AND r.student_id=auth.uid()));
CREATE POLICY attendance_read ON public.attendance_records FOR SELECT TO authenticated USING(yhub_attendance_private.manages(course_id) OR (student_id=auth.uid() AND EXISTS(SELECT 1 FROM public.users WHERE users.id=auth.uid() AND role='student')));
CREATE FUNCTION public.schedule_academic_lecture(p_course uuid,p_title text,p_start timestamptz,p_end timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v_id uuid;BEGIN
 PERFORM yhub_attendance_private.lock_manager(p_course);
 IF p_start IS NULL OR p_start<clock_timestamp()-interval '1 day' OR p_start>clock_timestamp()+interval '2 years' THEN RAISE EXCEPTION 'Invalid lecture date' USING ERRCODE='22023'; END IF;
 INSERT INTO public.academic_lectures(course_id,title,starts_at,ends_at,created_by) VALUES(p_course,btrim(p_title),p_start,p_end,auth.uid()) RETURNING id INTO v_id;RETURN v_id;
END $$;
CREATE FUNCTION public.cancel_academic_lecture(p_lecture uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v public.academic_lectures;BEGIN
 SELECT * INTO v FROM public.academic_lectures WHERE id=p_lecture;
 PERFORM yhub_attendance_private.lock_manager(v.course_id);
 PERFORM id FROM public.academic_lectures WHERE id=p_lecture FOR UPDATE;
 UPDATE public.academic_lectures SET cancelled=true WHERE id=p_lecture;
 UPDATE public.attendance_sessions SET state='closed',closed_at=clock_timestamp() WHERE lecture_id=p_lecture AND state='open';
 RETURN p_lecture;
END $$;
CREATE FUNCTION public.open_attendance(p_lecture uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v public.academic_lectures;v_id uuid;v_schema text;v_secret bytea;BEGIN
 SELECT * INTO v FROM public.academic_lectures WHERE id=p_lecture;
 PERFORM yhub_attendance_private.lock_manager(v.course_id);
 SELECT * INTO v FROM public.academic_lectures WHERE id=p_lecture FOR UPDATE;
 IF v.cancelled OR clock_timestamp()<v.starts_at-interval '30 minutes' OR clock_timestamp()>v.ends_at THEN RAISE EXCEPTION 'Lecture is not available for attendance' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_id FROM public.attendance_sessions WHERE lecture_id=p_lecture;
 IF FOUND THEN RETURN v_id; END IF; -- Closed sessions cannot reopen old QR credentials.
 INSERT INTO public.attendance_sessions(lecture_id,course_id) VALUES(v.id,v.course_id) RETURNING id INTO v_id;
 SELECT n.nspname INTO v_schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto';
 EXECUTE format('SELECT %I.gen_random_bytes(32)',v_schema) INTO v_secret;
 INSERT INTO yhub_attendance_private.secrets VALUES(v_id,v_secret);
 INSERT INTO public.attendance_records(session_id,course_id,student_id,status,method,updated_by)
 SELECT v_id,v.course_id,e.student_id,'absent','roster',auth.uid() FROM public.course_enrollments e JOIN public.users u ON u.id=e.student_id
 WHERE e.course_id=v.course_id AND e.status='active' AND u.role='student';
 RETURN v_id;
END $$;
CREATE FUNCTION public.close_attendance(p_session uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v_course uuid;BEGIN
 SELECT course_id INTO v_course FROM public.attendance_sessions WHERE id=p_session;
 PERFORM yhub_attendance_private.lock_manager(v_course);
 UPDATE public.attendance_sessions SET state='closed',closed_at=clock_timestamp() WHERE id=p_session AND state='open';RETURN p_session;
END $$;
CREATE FUNCTION yhub_attendance_private.signature(p_session uuid,p_bucket bigint) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_schema text;v_secret text;v_result text;BEGIN
 SELECT n.nspname INTO v_schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto';
 SELECT encode(secret,'hex') INTO v_secret FROM yhub_attendance_private.secrets WHERE session_id=p_session;
 EXECUTE format('SELECT encode(%I.hmac($1,$2,''sha256''),''hex'')',v_schema) INTO v_result USING p_session::text||'.'||p_bucket::text,v_secret;
 RETURN v_result;END $$;
REVOKE ALL ON FUNCTION yhub_attendance_private.signature(uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.attendance_qr(p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v public.attendance_sessions;v_bucket bigint;v_end timestamptz;BEGIN
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session;
 PERFORM yhub_attendance_private.lock_manager(v.course_id);
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session FOR SHARE;
 SELECT ends_at INTO v_end FROM public.academic_lectures WHERE id=v.lecture_id;
 IF v.state<>'open' OR clock_timestamp()>v_end THEN RAISE EXCEPTION 'Attendance closed' USING ERRCODE='22023'; END IF;
 v_bucket:=floor(extract(epoch FROM clock_timestamp())/10);
 RETURN jsonb_build_object('token',p_session::text||'.'||v_bucket::text||'.'||yhub_attendance_private.signature(p_session,v_bucket),'expiresAt',to_timestamp((v_bucket+1)*10),'serverTime',clock_timestamp());
END $$;
CREATE FUNCTION public.check_in_attendance(p_token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_bucket bigint;v public.attendance_sessions;v_role text;v_status text;v_end timestamptz;v_record uuid;
BEGIN
 IF p_token IS NULL OR length(p_token)>160 OR p_token !~ '^[a-f0-9-]{36}\.[0-9]{1,12}\.[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid QR' USING ERRCODE='22023'; END IF;
 v_id:=split_part(p_token,'.',1)::uuid;v_bucket:=split_part(p_token,'.',2)::bigint;
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.attendance_sessions WHERE id=v_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid QR' USING ERRCODE='22023'; END IF;
 SELECT status INTO v_status FROM public.course_enrollments WHERE course_id=v.course_id AND student_id=auth.uid() FOR SHARE;
 IF v_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Active enrollment required' USING ERRCODE='42501'; END IF;
 SELECT ends_at INTO v_end FROM public.academic_lectures WHERE id=v.lecture_id;
 IF v.state<>'open' OR clock_timestamp()>v_end OR v_bucket<>floor(extract(epoch FROM clock_timestamp())/10)
 OR split_part(p_token,'.',3) IS DISTINCT FROM yhub_attendance_private.signature(v_id,v_bucket) THEN RAISE EXCEPTION 'QR expired or invalid' USING ERRCODE='22023'; END IF;
 INSERT INTO public.attendance_records(session_id,course_id,student_id,status,method,updated_by)
 VALUES(v_id,v.course_id,auth.uid(),'present','qr',auth.uid())
 ON CONFLICT(session_id,student_id) DO UPDATE SET status='present',method='qr',updated_by=auth.uid(),updated_at=clock_timestamp()
 WHERE attendance_records.status='absent' AND attendance_records.method='roster';
 SELECT id INTO v_record FROM public.attendance_records WHERE session_id=v_id AND student_id=auth.uid();RETURN v_record;
END $$;
CREATE FUNCTION public.correct_attendance(p_session uuid,p_student uuid,p_status text,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v public.attendance_sessions;v_id uuid;v_role text;BEGIN
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session;
 PERFORM yhub_attendance_private.lock_manager(v.course_id);
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session FOR UPDATE;
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid();
 IF p_status IS NULL OR p_status NOT IN ('present','absent','excused') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Status and correction reason required' USING ERRCODE='22023'; END IF;
 IF v_role='instructor' AND clock_timestamp()>coalesce(v.closed_at,v.opened_at)+interval '7 days' THEN RAISE EXCEPTION 'Correction window closed; contact administration' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.attendance_records WHERE session_id=p_session AND student_id=p_student) THEN
  PERFORM id FROM public.users WHERE id=p_student AND role='student' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='42501'; END IF;
  PERFORM id FROM public.course_enrollments WHERE course_id=v.course_id AND student_id=p_student AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active enrollment required' USING ERRCODE='42501'; END IF;
 END IF;
 INSERT INTO public.attendance_records(session_id,course_id,student_id,status,method,reason,updated_by)
 VALUES(p_session,v.course_id,p_student,p_status,'manual',btrim(p_reason),auth.uid())
 ON CONFLICT(session_id,student_id) DO UPDATE SET status=EXCLUDED.status,method='manual',reason=EXCLUDED.reason,updated_by=auth.uid(),updated_at=clock_timestamp()
 RETURNING id INTO v_id;RETURN v_id;
END $$;
CREATE FUNCTION public.attendance_report(p_course uuid,p_offset integer DEFAULT 0,p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE v_role text;v_manager boolean;v_rows jsonb;v_total bigint;v_stats jsonb;BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid();v_manager:=yhub_attendance_private.manages(p_course);
 IF NOT v_manager AND v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Read denied' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO v_total FROM public.attendance_records r WHERE r.course_id=p_course AND (v_manager OR r.student_id=auth.uid());
 SELECT coalesce(jsonb_agg(to_jsonb(rows)),'[]') INTO v_rows FROM (
 SELECT r.*,u.full_name,l.title,l.starts_at,s.state FROM public.attendance_records r JOIN public.users u ON u.id=r.student_id JOIN public.attendance_sessions s ON s.id=r.session_id JOIN public.academic_lectures l ON l.id=s.lecture_id
 WHERE r.course_id=p_course AND (v_manager OR r.student_id=auth.uid()) ORDER BY l.starts_at DESC,r.id LIMIT p_limit OFFSET p_offset) rows;
 SELECT jsonb_build_object('eligible',count(*),'absent',count(*) FILTER(WHERE r.status='absent'),'present',count(*) FILTER(WHERE r.status='present'),'excused',count(*) FILTER(WHERE r.status='excused')) INTO v_stats
 FROM public.attendance_records r JOIN public.attendance_sessions s ON s.id=r.session_id JOIN public.academic_lectures l ON l.id=s.lecture_id
 WHERE r.course_id=p_course AND (v_manager OR r.student_id=auth.uid()) AND s.state='closed' AND NOT l.cancelled;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total,'stats',v_stats);
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT * FROM (VALUES
 ('academic_lectures','id,course_id,title,starts_at,ends_at,cancelled,created_by,created_at','id,course_id,starts_at,ends_at,cancelled,created_by,created_at'),
 ('attendance_sessions','id,lecture_id,course_id,state,opened_at,closed_at','id,lecture_id,course_id,state,opened_at,closed_at'),
 ('attendance_records','id,session_id,course_id,student_id,status,method,reason,updated_by,updated_at','id,session_id,course_id,student_id,status,method,updated_by,updated_at')) v(entity,fields,visible) LOOP
 EXECUTE format('CREATE TRIGGER audit_lock_actor BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.lock_actor()',r.entity);
 EXECUTE format('CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture(%L,%L,''ordinary'')',r.entity,r.fields,r.visible);
 EXECUTE format('CREATE TRIGGER audit_block_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.reject_truncate()',r.entity);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.schedule_academic_lecture(uuid,text,timestamptz,timestamptz),public.cancel_academic_lecture(uuid),public.open_attendance(uuid),public.close_attendance(uuid),public.attendance_qr(uuid),public.check_in_attendance(text),public.correct_attendance(uuid,uuid,text,text),public.attendance_report(uuid,integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.schedule_academic_lecture(uuid,text,timestamptz,timestamptz),public.cancel_academic_lecture(uuid),public.open_attendance(uuid),public.close_attendance(uuid),public.attendance_qr(uuid),public.check_in_attendance(text),public.correct_attendance(uuid,uuid,text,text),public.attendance_report(uuid,integer,integer) TO authenticated;

CREATE FUNCTION public.my_attendance_sections() RETURNS TABLE(id uuid,title text,section_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.id,c.title,c.section_label FROM public.courses c WHERE yhub_attendance_private.manages(c.id)
 OR yhub_attendance_private.enrolled(c.id) OR (EXISTS(SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='student')
 AND EXISTS(SELECT 1 FROM public.attendance_records r WHERE r.course_id=c.id AND r.student_id=auth.uid())) ORDER BY c.title,c.id
$$;
REVOKE ALL ON FUNCTION public.my_attendance_sections() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.my_attendance_sections() TO authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA yhub_attendance_private FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('y-attendance','application',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY[]::text[],ARRAY['student','instructor','admin','super_admin']::text[],ARRAY[]::text[],'[{"path":"/y-attendance","title":{"ar":"الحضور والغياب","en":"Y-Attendance"},"icon":"activity","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;

CREATE FUNCTION public.attendance_session_roster(p_session uuid) RETURNS TABLE(student_id uuid,full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE v_course uuid;BEGIN
 SELECT course_id INTO v_course FROM public.attendance_sessions WHERE id=p_session;
 IF NOT yhub_attendance_private.manages(v_course) THEN RAISE EXCEPTION 'Roster denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT u.id,u.full_name FROM public.users u WHERE
 EXISTS(SELECT 1 FROM public.attendance_records r WHERE r.session_id=p_session AND r.student_id=u.id)
 OR (u.role='student' AND EXISTS(SELECT 1 FROM public.course_enrollments e WHERE e.course_id=v_course AND e.student_id=u.id AND e.status='active')) ORDER BY u.full_name,u.id;
END $$;
REVOKE ALL ON FUNCTION public.attendance_session_roster(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.attendance_session_roster(uuid) TO authenticated;

COMMIT;
