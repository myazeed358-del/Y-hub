-- Approved18 first supported capability: exact bounded polynomial differentiation.
-- Metadata is emitted only by the trusted server worker using the existing engine.
BEGIN;
ALTER TABLE practice_private.questions ADD COLUMN math_verification jsonb;
ALTER TABLE practice_private.questions ADD CONSTRAINT practice_math_verification CHECK(
 math_verification IS NULL OR (jsonb_typeof(math_verification)='object'
 AND math_verification->>'method'='polynomial-derivative-v1'
 AND jsonb_typeof(math_verification->'task')='object'));
CREATE FUNCTION public.publish_ai_practice_math_question(p_actor uuid,p_id uuid,p_position integer,p_question jsonb,p_evidence_ids uuid[],p_verification jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions;
BEGIN
 s:=practice_private.owned(p_id,p_actor);
 -- Current permission, never a browser flag or a cached JWT role. Lock the policy
 -- and existing grants so revocation serializes with this publication transaction.
 PERFORM 1 FROM public.module_policies WHERE id='calculus-1' FOR SHARE;
 PERFORM 1 FROM public.engine_grants WHERE student_id=p_actor AND engine_id='calculus-1' FOR SHARE;
 IF NOT yhub_access_private.allowed(p_actor,'calculus-1') THEN RAISE EXCEPTION 'Engine access denied' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM practice_private.questions WHERE session_id=p_id AND position=p_position) THEN RETURN; END IF;
 IF p_verification IS NULL OR jsonb_typeof(p_verification)<>'object' OR NOT(p_verification ?& ARRAY['method','task'])
 OR (p_verification-ARRAY['method','task'])<>'{}'::jsonb OR p_verification->>'method' IS DISTINCT FROM 'polynomial-derivative-v1'
 OR jsonb_typeof(p_verification->'task') IS DISTINCT FROM 'object' OR p_verification->'task'->>'kind' IS DISTINCT FROM 'polynomial_derivative'
 OR octet_length(p_verification::text)>2000 THEN RAISE EXCEPTION 'Invalid verification contract' USING ERRCODE='22023'; END IF;
 -- Existing publication locks sources, validates actual evidence and rejects duplicate
 -- history. Its question insert and this private metadata are one transaction.
 PERFORM public.publish_ai_practice_question(p_actor,p_id,p_position,p_question,p_evidence_ids);
 UPDATE practice_private.questions SET math_verification=p_verification WHERE session_id=p_id AND position=p_position;
END $$;
REVOKE ALL ON FUNCTION public.publish_ai_practice_math_question(uuid,uuid,integer,jsonb,uuid[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_ai_practice_math_question(uuid,uuid,integer,jsonb,uuid[],jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.read_ai_practice_session(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; questions jsonb;
BEGIN
 s:=practice_private.owned(p_id,auth.uid());
 SELECT coalesce(jsonb_agg(jsonb_build_object('position',q.position,'prompt',q.prompt,'options',q.options,'choice',q.choice,
  'answered',q.answered_at IS NOT NULL,
  'feedback',CASE WHEN s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL)
   THEN jsonb_build_object('suggestedChoice',q.correct,'matchesSuggestion',q.choice=q.correct,'explanation',q.explanation,'citations',q.evidence,'verification',CASE WHEN q.math_verification IS NOT NULL THEN q.math_verification->>'method' END)
   ELSE NULL END) ORDER BY q.position),'[]'::jsonb) INTO questions FROM practice_private.questions q WHERE session_id=p_id;
 RETURN jsonb_build_object('id',s.id,'courseId',s.course_id,'mode',s.mode,'difficulty',s.difficulty,'language',s.language,'target',s.target,
  'revision',s.revision,'submittedAt',s.submitted_at,'questions',questions);
END $$;

CREATE OR REPLACE FUNCTION public.get_ai_practice_assessment(p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; result jsonb;
BEGIN
 s:=practice_private.owned(p_session,auth.uid());
 WITH evaluated AS (
 SELECT q.position,r.id,r.revision,r.auto_outcome,
 CASE WHEN r.id IS NOT NULL THEN r.state WHEN q.math_verification IS NOT NULL THEN 'math_verified' ELSE 'unverified' END state,
 CASE WHEN r.state='resolved' THEN CASE WHEN d.resolved_choice IS NOT NULL THEN (q.choice=d.resolved_choice)::int END
 WHEN r.id IS NULL AND q.math_verification IS NOT NULL THEN (q.choice=q.correct)::int END score,
 r.state='resolved' AND d.resolved_choice IS NULL excluded
 FROM practice_private.questions q LEFT JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position
 LEFT JOIN practice_private.review_details d ON d.review_id=r.id
 WHERE q.session_id=p_session AND q.choice IS NOT NULL AND (s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL))
 ) SELECT jsonb_build_object(
 'items',coalesce(jsonb_agg(jsonb_build_object('position',position,'id',id,'state',state,'revision',revision,'outcome',auto_outcome,'score',score) ORDER BY position),'[]'::jsonb),
 'earned',coalesce(sum(score),0),'graded',count(score),'pending',count(*) FILTER(WHERE score IS NULL AND NOT coalesce(excluded,false)),
 'excluded',count(*) FILTER(WHERE excluded)) INTO result FROM evaluated;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.get_ai_practice_review(p_review uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions; q practice_private.questions; d practice_private.review_details;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 IF r.student_id=auth.uid() THEN s:=practice_private.owned(r.session_id,auth.uid());
 ELSE r:=practice_private.reviewer_context(p_review);SELECT * INTO s FROM public.ai_practice_sessions WHERE id=r.session_id; END IF;
 q:=practice_private.reviewable(s,r.position);
 SELECT * INTO d FROM practice_private.review_details WHERE review_id=p_review;
 RETURN jsonb_build_object('review',to_jsonb(r),'question',jsonb_build_object('prompt',q.prompt,'options',q.options,'choice',q.choice,'suggestedChoice',q.correct,'explanation',q.explanation,'citations',q.evidence,'verification',q.math_verification->>'method'),
  'automatic',jsonb_build_object('choice',d.auto_choice,'explanation',d.auto_explanation),
  'resolution',CASE WHEN r.state='resolved' THEN jsonb_build_object('choice',d.resolved_choice,'explanation',d.resolution,'score',CASE WHEN d.resolved_choice IS NOT NULL THEN (q.choice=d.resolved_choice)::int END) END);
END $$;
COMMIT;
