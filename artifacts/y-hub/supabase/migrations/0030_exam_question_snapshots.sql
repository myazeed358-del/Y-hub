-- Stable exam versions per attempt. No historical result is recomputed.
BEGIN;
CREATE TABLE yhub_exam_private.attempt_questions (
 attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
 question_id uuid NOT NULL, -- no FK to the mutable question bank
 course_id uuid NOT NULL, type text NOT NULL, content text NOT NULL,
 options jsonb, difficulty text, points integer, correct_answer text,
 PRIMARY KEY(attempt_id,question_id)
);
ALTER TABLE yhub_exam_private.attempt_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON yhub_exam_private.attempt_questions FROM PUBLIC,anon,authenticated,service_role;
-- Existing active attempts have no recoverable original version. Capture the
-- deployment-time bank; staging rollout must drain active attempts first.
INSERT INTO yhub_exam_private.attempt_questions
SELECT a.id,q.id,q.course_id,q.type,q.content,q.options,q.difficulty,q.points,q.correct_answer
FROM public.exam_attempts a JOIN public.questions q ON q.exam_id=a.exam_id WHERE a.status='active';

CREATE FUNCTION yhub_exam_private.capture_attempt_questions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO yhub_exam_private.attempt_questions
 SELECT NEW.id,q.id,q.course_id,q.type,q.content,q.options,q.difficulty,q.points,q.correct_answer
 FROM public.questions q WHERE q.exam_id=NEW.exam_id ORDER BY q.id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exam has no questions'; END IF;
 IF EXISTS(SELECT 1 FROM yhub_exam_private.attempt_questions q JOIN public.exams e ON e.id=NEW.exam_id
   WHERE q.attempt_id=NEW.id AND q.course_id IS DISTINCT FROM e.course_id) THEN
   RAISE EXCEPTION 'Exam questions course mismatch';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION yhub_exam_private.capture_attempt_questions() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER capture_attempt_questions AFTER INSERT ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION yhub_exam_private.capture_attempt_questions();

-- Serialize bank mutations with the parent's FOR SHARE lock held by attempt start.
CREATE FUNCTION yhub_exam_private.lock_question_exam() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM id FROM public.exams WHERE id=ANY(ARRAY[
   CASE WHEN TG_OP<>'INSERT' THEN OLD.exam_id END,
   CASE WHEN TG_OP<>'DELETE' THEN NEW.exam_id END]) ORDER BY id FOR UPDATE;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION yhub_exam_private.lock_question_exam() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER lock_question_exam BEFORE INSERT OR UPDATE OR DELETE ON public.questions
FOR EACH ROW EXECUTE FUNCTION yhub_exam_private.lock_question_exam();

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
 -- Grade the immutable server snapshot, never the mutable authoring bank.
 FOR v_q IN SELECT question_id AS id,course_id,correct_answer,points FROM yhub_exam_private.attempt_questions WHERE attempt_id=(v_state->>'attempt_id')::uuid ORDER BY question_id FOR SHARE LOOP
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
 IF v_role='student' THEN
   RETURN QUERY SELECT q.question_id,q.course_id,p_exam_id,q.type,q.content,q.options,q.difficulty,q.points
   FROM yhub_exam_private.attempt_questions q WHERE q.attempt_id=(v_state->>'attempt_id')::uuid ORDER BY q.question_id;
   RETURN;
 END IF;
 RETURN QUERY SELECT q.id,q.course_id,q.exam_id,q.type,q.content,q.options,q.difficulty,q.points FROM public.questions q WHERE q.exam_id=p_exam_id ORDER BY q.id;
END $$;
COMMIT;
