-- Approved attendance decisions 2-6, 8-10, 35-37. Existing histories are preserved.
BEGIN;
ALTER TABLE public.attendance_sessions
 ADD COLUMN expires_at timestamptz,
 ADD COLUMN qr_interval_seconds integer NOT NULL DEFAULT 10 CHECK(qr_interval_seconds BETWEEN 10 AND 120);
-- Preserve the old deadline for historical sessions, rather than rewriting attendance.
UPDATE public.attendance_sessions s SET expires_at=l.ends_at FROM public.academic_lectures l WHERE l.id=s.lecture_id;
ALTER TABLE public.attendance_sessions ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE public.attendance_sessions DROP CONSTRAINT attendance_sessions_state_check;
ALTER TABLE public.attendance_sessions ADD CONSTRAINT attendance_sessions_state_check CHECK(state IN ('open','closed','cancelled'));
COMMENT ON COLUMN public.attendance_sessions.expires_at IS 'Server-authoritative logical close deadline. Effective state is closed at this time even if no client or scheduler runs. Stored state records explicit close/cancel only.';
DROP TRIGGER audit_capture ON public.attendance_sessions;
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.attendance_sessions FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,lecture_id,course_id,state,opened_at,closed_at,expires_at,qr_interval_seconds','id,lecture_id,course_id,state,opened_at,closed_at,expires_at,qr_interval_seconds','ordinary');

CREATE FUNCTION public.open_attendance_v2(p_lecture uuid,p_duration_minutes integer DEFAULT 10,p_qr_seconds integer DEFAULT 10) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.academic_lectures;v_id uuid;v_schema text;v_secret bytea;
BEGIN
 IF p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 1 AND 120 OR p_qr_seconds IS NULL OR p_qr_seconds NOT BETWEEN 10 AND 120 THEN RAISE EXCEPTION 'Invalid duration or QR interval' USING ERRCODE='22023'; END IF;
 SELECT * INTO v FROM public.academic_lectures WHERE id=p_lecture;
 PERFORM yhub_attendance_private.lock_manager(v.course_id);
 SELECT * INTO v FROM public.academic_lectures WHERE id=p_lecture FOR UPDATE;
 SELECT id INTO v_id FROM public.attendance_sessions WHERE lecture_id=p_lecture;
 IF FOUND THEN RETURN v_id; END IF; -- Idempotent; never reopen a closed/cancelled session.
 IF v.cancelled OR clock_timestamp()<v.starts_at-interval '30 minutes' OR clock_timestamp()>v.ends_at THEN RAISE EXCEPTION 'Lecture is not available for attendance' USING ERRCODE='22023'; END IF;
 -- One statement snapshot defines both the start and eligible membership. Later joins
 -- cannot add to this roster; later withdrawals cannot erase it. Absence is provisional
 -- while open and becomes final at the deadline/early close without a browser job.
 WITH start AS MATERIALIZED (SELECT clock_timestamp() AS at), new_session AS (
 INSERT INTO public.attendance_sessions(lecture_id,course_id,opened_at,expires_at,qr_interval_seconds)
 SELECT v.id,v.course_id,start.at,start.at+make_interval(mins=>p_duration_minutes),p_qr_seconds FROM start RETURNING id
 ), roster AS (
 INSERT INTO public.attendance_records(session_id,course_id,student_id,status,method,updated_by)
 SELECT n.id,v.course_id,e.student_id,'absent','roster',auth.uid() FROM new_session n CROSS JOIN public.course_enrollments e JOIN public.users u ON u.id=e.student_id
 WHERE e.course_id=v.course_id AND e.status='active' AND u.role='student'
 ) SELECT id INTO v_id FROM new_session;
 SELECT n.nspname INTO v_schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto';
 EXECUTE format('SELECT %I.gen_random_bytes(32)',v_schema) INTO v_secret;
 INSERT INTO yhub_attendance_private.secrets VALUES(v_id,v_secret);
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.open_attendance(p_lecture uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT public.open_attendance_v2(p_lecture,10,10) $$;

-- RLS remains responsible for who can read a session (including one's own history).
CREATE FUNCTION public.get_attendance_session(p_lecture uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(s)||jsonb_build_object('state',CASE WHEN s.state='open' AND s.expires_at<=statement_timestamp() THEN 'closed' ELSE s.state END,'serverTime',statement_timestamp())
 FROM public.attendance_sessions s WHERE s.lecture_id=p_lecture;
$$;
CREATE FUNCTION public.extend_attendance(p_session uuid,p_minutes integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v public.attendance_sessions;BEGIN
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session;
 PERFORM yhub_attendance_private.lock_manager(v.course_id);
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session FOR UPDATE;
 IF p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 120 OR v.state<>'open' OR v.expires_at<=clock_timestamp()
 OR v.expires_at+make_interval(mins=>p_minutes)>v.opened_at+interval '120 minutes'
 OR EXISTS(SELECT 1 FROM public.academic_lectures WHERE id=v.lecture_id AND cancelled) THEN RAISE EXCEPTION 'Session cannot be extended' USING ERRCODE='22023'; END IF;
 UPDATE public.attendance_sessions SET expires_at=expires_at+make_interval(mins=>p_minutes) WHERE id=p_session;
 RETURN p_session;
END $$;
CREATE FUNCTION public.cancel_attendance(p_session uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v_course uuid;BEGIN
 SELECT course_id INTO v_course FROM public.attendance_sessions WHERE id=p_session;
 PERFORM yhub_attendance_private.lock_manager(v_course);
 UPDATE public.attendance_sessions SET state='cancelled',closed_at=coalesce(closed_at,clock_timestamp()) WHERE id=p_session AND state<>'cancelled';
 RETURN p_session;
END $$;
CREATE OR REPLACE FUNCTION public.close_attendance(p_session uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v_course uuid;BEGIN
 SELECT course_id INTO v_course FROM public.attendance_sessions WHERE id=p_session;
 PERFORM yhub_attendance_private.lock_manager(v_course);
 UPDATE public.attendance_sessions SET state='closed',closed_at=least(expires_at,clock_timestamp()) WHERE id=p_session AND state='open';RETURN p_session;
END $$;
CREATE OR REPLACE FUNCTION public.attendance_qr(p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v public.attendance_sessions;v_bucket bigint;v_now timestamptz;BEGIN
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session;
 PERFORM yhub_attendance_private.lock_manager(v.course_id);
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session FOR SHARE;
 v_now:=clock_timestamp();
 IF v.state<>'open' OR v_now>=v.expires_at OR EXISTS(SELECT 1 FROM public.academic_lectures WHERE id=v.lecture_id AND cancelled) THEN RAISE EXCEPTION 'Attendance closed' USING ERRCODE='22023'; END IF;
 v_bucket:=floor(extract(epoch FROM v_now)/v.qr_interval_seconds);
 RETURN jsonb_build_object('token',p_session::text||'.'||v_bucket::text||'.'||yhub_attendance_private.signature(p_session,v_bucket),'expiresAt',least(v.expires_at,to_timestamp((v_bucket+1)*v.qr_interval_seconds)),'serverTime',v_now,'intervalSeconds',v.qr_interval_seconds);
END $$;
CREATE OR REPLACE FUNCTION public.check_in_attendance(p_token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_bucket bigint;v public.attendance_sessions;v_role text;v_status text;v_record uuid;
BEGIN
 IF p_token IS NULL OR length(p_token)>160 OR p_token !~ '^[a-f0-9-]{36}\.[0-9]{1,12}\.[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid QR' USING ERRCODE='22023'; END IF;
 v_id:=split_part(p_token,'.',1)::uuid;v_bucket:=split_part(p_token,'.',2)::bigint;
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.attendance_sessions WHERE id=v_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid QR' USING ERRCODE='22023'; END IF;
 SELECT status INTO v_status FROM public.course_enrollments WHERE course_id=v.course_id AND student_id=auth.uid() FOR SHARE;
 IF v_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Active enrollment required' USING ERRCODE='42501'; END IF;
 IF v.state<>'open' OR clock_timestamp()>=v.expires_at OR v_bucket<>floor(extract(epoch FROM clock_timestamp())/v.qr_interval_seconds)
 OR EXISTS(SELECT 1 FROM public.academic_lectures WHERE id=v.lecture_id AND cancelled)
 OR split_part(p_token,'.',3) IS DISTINCT FROM yhub_attendance_private.signature(v_id,v_bucket) THEN RAISE EXCEPTION 'QR expired or invalid' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_record FROM public.attendance_records WHERE session_id=v_id AND student_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Not eligible at session start' USING ERRCODE='42501'; END IF;
 UPDATE public.attendance_records SET status='present',method='qr',updated_by=auth.uid(),updated_at=clock_timestamp()
 WHERE id=v_record AND status='absent' AND method='roster';
 RETURN v_record;
END $$;
CREATE OR REPLACE FUNCTION public.correct_attendance(p_session uuid,p_student uuid,p_status text,p_reason text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v public.attendance_sessions;v_id uuid;BEGIN
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session;
 PERFORM yhub_attendance_private.lock_manager(v.course_id);
 SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session FOR UPDATE;
 IF p_status IS NULL OR p_status NOT IN ('present','absent') OR length(coalesce(p_reason,''))>500 THEN RAISE EXCEPTION 'Invalid attendance correction' USING ERRCODE='22023'; END IF;
 IF v.state='cancelled' OR EXISTS(SELECT 1 FROM public.academic_lectures WHERE id=v.lecture_id AND cancelled) THEN RAISE EXCEPTION 'Session cancelled' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_id FROM public.attendance_records WHERE session_id=p_session AND student_id=p_student;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not eligible at session start' USING ERRCODE='42501'; END IF;
 UPDATE public.attendance_records SET status=p_status,method='manual',reason=nullif(btrim(p_reason),''),updated_by=auth.uid(),updated_at=clock_timestamp()
 WHERE id=v_id AND (status IS DISTINCT FROM p_status OR method<>'manual' OR reason IS DISTINCT FROM nullif(btrim(p_reason),''));
 RETURN v_id;
END $$;
CREATE FUNCTION public.attendance_session_roster_v2(p_session uuid) RETURNS TABLE(student_id uuid,full_name text,user_number text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE v_course uuid;BEGIN
 SELECT course_id INTO v_course FROM public.attendance_sessions WHERE id=p_session;
 IF NOT yhub_attendance_private.manages(v_course) THEN RAISE EXCEPTION 'Roster denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT u.id,u.full_name,u.user_number FROM public.users u JOIN public.attendance_records r ON r.student_id=u.id WHERE r.session_id=p_session ORDER BY u.full_name,u.id;
END $$;
CREATE OR REPLACE FUNCTION public.attendance_session_roster(p_session uuid) RETURNS TABLE(student_id uuid,full_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT r.student_id,r.full_name FROM public.attendance_session_roster_v2(p_session) r $$;
CREATE OR REPLACE FUNCTION public.attendance_report(p_course uuid,p_offset integer DEFAULT 0,p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE v_role text;v_manager boolean;v_rows jsonb;v_total bigint;v_stats jsonb;BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid();v_manager:=yhub_attendance_private.manages(p_course);
 IF NOT v_manager AND v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Read denied' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO v_total FROM public.attendance_records r WHERE r.course_id=p_course AND (v_manager OR r.student_id=auth.uid());
 SELECT coalesce(jsonb_agg(to_jsonb(rows)),'[]') INTO v_rows FROM (
 SELECT r.*,u.full_name,u.user_number,l.title,s.opened_at AS starts_at,
 CASE WHEN l.cancelled OR s.state='cancelled' THEN 'cancelled' WHEN s.state='open' AND s.expires_at<=statement_timestamp() THEN 'closed' ELSE s.state END AS state
 FROM public.attendance_records r JOIN public.users u ON u.id=r.student_id JOIN public.attendance_sessions s ON s.id=r.session_id JOIN public.academic_lectures l ON l.id=s.lecture_id
 WHERE r.course_id=p_course AND (v_manager OR r.student_id=auth.uid()) ORDER BY s.opened_at DESC,r.id LIMIT p_limit OFFSET p_offset) rows;
 SELECT jsonb_build_object('eligible',count(*),'absent',count(*) FILTER(WHERE r.status='absent'),'present',count(*) FILTER(WHERE r.status='present'),'excused',count(*) FILTER(WHERE r.status='excused')) INTO v_stats
 FROM public.attendance_records r JOIN public.attendance_sessions s ON s.id=r.session_id JOIN public.academic_lectures l ON l.id=s.lecture_id
 WHERE r.course_id=p_course AND (v_manager OR r.student_id=auth.uid()) AND s.state<>'cancelled' AND (s.state='closed' OR s.expires_at<=statement_timestamp()) AND NOT l.cancelled;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total,'stats',v_stats);
END $$;
REVOKE ALL ON FUNCTION public.open_attendance_v2(uuid,integer,integer),public.get_attendance_session(uuid),public.extend_attendance(uuid,integer),public.cancel_attendance(uuid),public.attendance_session_roster_v2(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.open_attendance_v2(uuid,integer,integer),public.get_attendance_session(uuid),public.extend_attendance(uuid,integer),public.cancel_attendance(uuid),public.attendance_session_roster_v2(uuid) TO authenticated;
-- Historical 'excused' rows stay intact; only present/absent are accepted by write RPCs.
-- No student notification is produced. Audit capture remains mandatory/transactional.
COMMIT;
