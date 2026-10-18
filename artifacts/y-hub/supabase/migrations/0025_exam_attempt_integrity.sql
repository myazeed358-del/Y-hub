-- Server-owned attempts. Apply only after staging verification; never rewrite historical results.
BEGIN;
CREATE SCHEMA yhub_exam_private;
REVOKE ALL ON SCHEMA yhub_exam_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE public.exam_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL,
 deadline_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','submitted','expired')),
 UNIQUE(exam_id,student_id),
 CHECK (deadline_at > started_at)
);
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_attempts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.exam_attempts TO authenticated;
CREATE POLICY exam_attempt_owner_read ON public.exam_attempts FOR SELECT TO authenticated
 USING (student_id=auth.uid());
REVOKE INSERT,UPDATE,DELETE ON public.student_results FROM PUBLIC,anon,authenticated;

-- Row locks serialize authorization changes with a request. A revocation committed
-- before these locks is rejected; a later revocation waits for the admitted transaction.
CREATE FUNCTION yhub_exam_private.lock_access(p_exam_id uuid) RETURNS public.exams
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_exam public.exams; v_status text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR SHARE;
 IF NOT FOUND OR NOT coalesce(v_exam.is_published,false) THEN
   RAISE EXCEPTION 'Exam unavailable' USING ERRCODE='42501';
 END IF;
 SELECT status INTO v_status FROM public.course_enrollments
 WHERE course_id=v_exam.course_id AND student_id=auth.uid() FOR SHARE;
 IF v_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Active enrollment required' USING ERRCODE='42501'; END IF;
 RETURN v_exam;
END $$;

CREATE FUNCTION yhub_exam_private.read_attempt(p_exam_id uuid,p_start boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_exam public.exams; v_attempt public.exam_attempts; v_result public.student_results; v_now timestamptz;
BEGIN
 v_exam := yhub_exam_private.lock_access(p_exam_id);
 SELECT * INTO v_result FROM public.student_results WHERE exam_id=p_exam_id AND student_id=auth.uid();
 -- Historical results remain authoritative without inventing a start/deadline.
 IF FOUND THEN
   RETURN jsonb_build_object('status','submitted','attempt_id',null,'started_at',null,'deadline_at',null,
     'server_now',clock_timestamp(),'result',jsonb_build_object('id',v_result.id,'score',v_result.score,'total_score',v_result.total_score));
 END IF;
 IF p_start THEN
   IF v_exam.time_limit_minutes IS NULL OR v_exam.time_limit_minutes<=0 THEN
     RAISE EXCEPTION 'Invalid exam duration' USING ERRCODE='22023';
   END IF;
   IF NOT EXISTS(SELECT 1 FROM public.questions WHERE exam_id=p_exam_id) THEN RAISE EXCEPTION 'Exam has no questions'; END IF;
   v_now := clock_timestamp();
   INSERT INTO public.exam_attempts(exam_id,student_id,started_at,deadline_at)
   VALUES(p_exam_id,auth.uid(),v_now,v_now+make_interval(mins=>v_exam.time_limit_minutes))
   ON CONFLICT(exam_id,student_id) DO NOTHING;
 END IF;
 SELECT * INTO v_attempt FROM public.exam_attempts WHERE exam_id=p_exam_id AND student_id=auth.uid() FOR UPDATE;
 -- Re-read after the row lock: another concurrent submit may just have committed.
 SELECT * INTO v_result FROM public.student_results WHERE exam_id=p_exam_id AND student_id=auth.uid();
 IF FOUND THEN
   RETURN jsonb_build_object('status','submitted','attempt_id',v_attempt.id,'started_at',v_attempt.started_at,
     'deadline_at',v_attempt.deadline_at,'server_now',clock_timestamp(),
     'result',jsonb_build_object('id',v_result.id,'score',v_result.score,'total_score',v_result.total_score));
 END IF;
 IF v_attempt.id IS NULL THEN
   RETURN jsonb_build_object('status','not_started','attempt_id',null,'started_at',null,'deadline_at',null,'server_now',clock_timestamp(),'result',null);
 END IF;
 IF v_attempt.status='active' AND clock_timestamp()>=v_attempt.deadline_at THEN
   UPDATE public.exam_attempts SET status='expired' WHERE id=v_attempt.id;
   v_attempt.status:='expired';
 END IF;
 RETURN jsonb_build_object('status',v_attempt.status,'attempt_id',v_attempt.id,'started_at',v_attempt.started_at,
   'deadline_at',v_attempt.deadline_at,'server_now',clock_timestamp(),'result',null);
END $$;

CREATE FUNCTION public.start_exam_attempt(p_exam_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT yhub_exam_private.read_attempt(p_exam_id,true) $$;
CREATE FUNCTION public.get_exam_attempt(p_exam_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT yhub_exam_private.read_attempt(p_exam_id,false) $$;

CREATE OR REPLACE FUNCTION public.submit_exam(p_exam_id uuid,p_answers jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state jsonb; v_q record; v_score integer:=0; v_total integer:=0; v_result uuid; v_course uuid;
BEGIN
 v_state:=yhub_exam_private.read_attempt(p_exam_id,false);
 IF v_state->>'status' IN ('submitted','expired') THEN RETURN v_state; END IF;
 IF v_state->>'status'<>'active' THEN RAISE EXCEPTION 'Start the attempt first' USING ERRCODE='22023'; END IF;
 IF p_answers IS NULL OR jsonb_typeof(p_answers)<>'object' OR octet_length(p_answers::text)>1048576 THEN
   RAISE EXCEPTION 'Invalid answers' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_answers) WHERE jsonb_typeof(value)<>'string') THEN
   RAISE EXCEPTION 'Answers must be strings' USING ERRCODE='22023';
 END IF;
 SELECT course_id INTO v_course FROM public.exams WHERE id=p_exam_id;
 -- Lock existing questions during grading; no client-provided score is accepted.
 FOR v_q IN SELECT id,course_id,correct_answer,points FROM public.questions WHERE exam_id=p_exam_id ORDER BY id FOR SHARE LOOP
   IF v_q.course_id IS DISTINCT FROM v_course THEN RAISE EXCEPTION 'Exam questions course mismatch'; END IF;
   v_total:=v_total+coalesce(v_q.points,1);
   IF lower(trim(p_answers->>v_q.id::text))=lower(v_q.correct_answer) THEN v_score:=v_score+coalesce(v_q.points,1); END IF;
 END LOOP;
 IF v_total=0 THEN RAISE EXCEPTION 'Exam has no questions'; END IF;
 -- Check actual wall time after lock waits, not transaction-start now().
 IF clock_timestamp()>=(v_state->>'deadline_at')::timestamptz THEN
   UPDATE public.exam_attempts SET status='expired' WHERE id=(v_state->>'attempt_id')::uuid;
   RETURN yhub_exam_private.read_attempt(p_exam_id,false);
 END IF;
 INSERT INTO public.student_results(exam_id,student_id,score,total_score,answers)
 VALUES(p_exam_id,auth.uid(),v_score,v_total,p_answers) RETURNING id INTO v_result;
 UPDATE public.exam_attempts SET status='submitted' WHERE id=(v_state->>'attempt_id')::uuid;
 RETURN yhub_exam_private.read_attempt(p_exam_id,false);
END $$;

-- Students cannot read questions before starting the server timer. Existing staff
-- authoring stays available to current owners/admins; answers are never returned.
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_exam_id uuid)
RETURNS TABLE(id uuid,course_id uuid,exam_id uuid,type text,content text,options jsonb,difficulty text,points int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_state jsonb;
BEGIN
 SELECT u.role INTO v_role FROM public.users u WHERE u.id=auth.uid() FOR SHARE;
 IF v_role='student' THEN
   v_state:=yhub_exam_private.read_attempt(p_exam_id,false);
   IF v_state->>'status'<>'active' THEN RAISE EXCEPTION 'Active attempt required' USING ERRCODE='42501'; END IF;
 ELSIF v_role IN ('admin','super_admin') THEN NULL;
 ELSIF v_role='instructor' AND EXISTS(SELECT 1 FROM public.exams e JOIN public.courses c ON c.id=e.course_id WHERE e.id=p_exam_id AND c.instructor_id=auth.uid()) THEN NULL;
 ELSE RAISE EXCEPTION 'Exam access denied' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT q.id,q.course_id,q.exam_id,q.type,q.content,q.options,q.difficulty,q.points FROM public.questions q WHERE q.exam_id=p_exam_id ORDER BY q.id;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA yhub_exam_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid),public.get_exam_attempt(uuid),public.submit_exam(uuid,jsonb),public.get_exam_questions(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid),public.get_exam_attempt(uuid),public.submit_exam(uuid,jsonb),public.get_exam_questions(uuid) TO authenticated;
COMMIT;
