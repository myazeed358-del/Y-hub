-- Approved18/17: bounded integer-polynomial antiderivatives, verified by the existing engine.
-- Additive upgrade; no historical question, key, score or evidence is rewritten.
BEGIN;
CREATE FUNCTION practice_private.antiderivative_identity(p_verification jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE task jsonb; coefficients jsonb; item jsonb; option jsonb; numbers integer[]:='{}';
 candidate integer[]; candidates text[]:='{}'; n numeric; last_power integer;
BEGIN
 IF p_verification IS NULL OR jsonb_typeof(p_verification) IS DISTINCT FROM 'object'
 OR NOT(p_verification ?& ARRAY['method','task']) OR (p_verification-ARRAY['method','task'])<>'{}'::jsonb
 OR p_verification->>'method' IS DISTINCT FROM 'polynomial-antiderivative-v1' THEN RETURN NULL; END IF;
 task:=p_verification->'task';
 IF jsonb_typeof(task) IS DISTINCT FROM 'object' OR task->>'kind' IS DISTINCT FROM 'polynomial_antiderivative'
 OR NOT(task ?& ARRAY['kind','variable','coefficients','options'])
 OR (task-ARRAY['kind','variable','coefficients','options'])<>'{}'::jsonb
 OR coalesce(task->>'variable','') NOT IN ('x','t') THEN RETURN NULL; END IF;
 coefficients:=task->'coefficients';
 IF jsonb_typeof(coefficients) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
 IF jsonb_array_length(coefficients) NOT BETWEEN 1 AND 8 THEN RETURN NULL; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(coefficients) LOOP
  IF jsonb_typeof(item)<>'number' THEN RETURN NULL; END IF;
  n:=(item #>> '{}')::numeric;
  IF n<>trunc(n) OR abs(n)>100 THEN RETURN NULL; END IF;
  numbers:=array_append(numbers,n::integer);
 END LOOP;
 IF jsonb_typeof(task->'options') IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
 IF jsonb_array_length(task->'options')<>4 THEN RETURN NULL; END IF;
 FOR option IN SELECT value FROM jsonb_array_elements(task->'options') LOOP
  IF jsonb_typeof(option) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  IF jsonb_array_length(option) NOT BETWEEN 1 AND 9 THEN RETURN NULL; END IF;
  candidate:='{}';
  FOR item IN SELECT value FROM jsonb_array_elements(option) LOOP
   IF jsonb_typeof(item)<>'number' THEN RETURN NULL; END IF;
   n:=(item #>> '{}')::numeric;
   IF n<>trunc(n) OR abs(n)>800 THEN RETURN NULL; END IF;
   candidate:=array_append(candidate,n::integer);
  END LOOP;
  -- The worker publishes canonical families +C, with the additive constant absorbed.
  IF candidate[1]<>0 THEN RETURN NULL; END IF;
  last_power:=cardinality(candidate);
  WHILE last_power>1 AND candidate[last_power]=0 LOOP last_power:=last_power-1; END LOOP;
  IF to_jsonb(candidate[1:last_power])::text=ANY(candidates) THEN RETURN NULL; END IF;
  candidates:=array_append(candidates,to_jsonb(candidate[1:last_power])::text);
 END LOOP;
 last_power:=cardinality(numbers);
 WHILE last_power>1 AND numbers[last_power]=0 LOOP last_power:=last_power-1; END LOOP;
 -- In contrast to differentiation, the integrand's constant DOES matter.
 RETURN 'polynomial-antiderivative-v1:'||to_jsonb(numbers[1:last_power])::text;
END $$;
REVOKE ALL ON FUNCTION practice_private.antiderivative_identity(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE practice_private.questions DROP CONSTRAINT practice_math_verification;
ALTER TABLE practice_private.questions ADD CONSTRAINT practice_math_verification CHECK(
 math_verification IS NULL OR ((jsonb_typeof(math_verification)='object'
 AND math_verification->>'method' IN ('polynomial-derivative-v1','polynomial-antiderivative-v1')
 AND jsonb_typeof(math_verification->'task')='object') IS TRUE));
ALTER TABLE practice_private.questions ADD COLUMN antiderivative_identity text
 GENERATED ALWAYS AS (practice_private.antiderivative_identity(math_verification)) STORED;
CREATE INDEX practice_antiderivative_identity ON practice_private.questions(antiderivative_identity,session_id)
 WHERE antiderivative_identity IS NOT NULL;

CREATE OR REPLACE FUNCTION public.publish_ai_practice_math_question(p_actor uuid,p_id uuid,p_position integer,p_question jsonb,p_evidence_ids uuid[],p_verification jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; identity text;
BEGIN
 s:=practice_private.owned(p_id,p_actor);
 -- Current permission, never a browser flag or a cached JWT role. Lock the policy
 -- and existing grants so revocation serializes with this publication transaction.
 PERFORM 1 FROM public.module_policies WHERE id='calculus-1' FOR SHARE;
 PERFORM 1 FROM public.engine_grants WHERE student_id=p_actor AND engine_id='calculus-1' FOR SHARE;
 IF NOT yhub_access_private.allowed(p_actor,'calculus-1') THEN RAISE EXCEPTION 'Engine access denied' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM practice_private.questions WHERE session_id=p_id AND position=p_position) THEN RETURN; END IF;
 IF p_verification IS NULL OR jsonb_typeof(p_verification)<>'object' OR NOT(p_verification ?& ARRAY['method','task'])
 OR (p_verification-ARRAY['method','task'])<>'{}'::jsonb
 OR coalesce(p_verification->>'method','') NOT IN ('polynomial-derivative-v1','polynomial-antiderivative-v1')
 OR jsonb_typeof(p_verification->'task') IS DISTINCT FROM 'object'
 OR octet_length(p_verification::text)>2000 THEN RAISE EXCEPTION 'Invalid verification contract' USING ERRCODE='22023'; END IF;
 identity:=CASE p_verification->>'method' WHEN 'polynomial-derivative-v1' THEN practice_private.derivative_identity(p_verification)
 ELSE practice_private.antiderivative_identity(p_verification) END;
 IF identity IS NULL THEN RAISE EXCEPTION 'Unsupported polynomial identity' USING ERRCODE='22023'; END IF;
 -- Same owner/section serialization as the ordinary publisher; checking before this
 -- lock would allow equivalent questions to race across different sessions/devices.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||s.course_id::text,49));
 IF EXISTS(SELECT 1 FROM practice_private.questions q JOIN public.ai_practice_sessions prior ON prior.id=q.session_id
  WHERE prior.user_id=p_actor AND prior.course_id=s.course_id AND (q.antiderivative_identity=identity OR q.derivative_identity=identity)
  AND (NOT s.allow_repeats OR prior.id=p_id))
 THEN RAISE EXCEPTION 'Repeated mathematical question; retry generation' USING ERRCODE='PT409'; END IF;
 -- Existing publication locks sources, validates actual evidence and rejects duplicate
 -- history. Its question insert and this private metadata are one transaction.
 PERFORM public.publish_ai_practice_question(p_actor,p_id,p_position,p_question,p_evidence_ids);
 UPDATE practice_private.questions SET math_verification=p_verification WHERE session_id=p_id AND position=p_position;
END $$;
REVOKE ALL ON FUNCTION public.publish_ai_practice_math_question(uuid,uuid,integer,jsonb,uuid[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_ai_practice_math_question(uuid,uuid,integer,jsonb,uuid[],jsonb) TO service_role;

CREATE OR REPLACE FUNCTION practice_private.plan_difficulty(s public.ai_practice_sessions,p_position integer)
RETURNS practice_private.generation_plans LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result practice_private.generation_plans; accuracy numeric;
BEGIN
 result.session_id:=s.id;result.position:=p_position;result.created_at:=clock_timestamp();
 result.policy:='confirmed-scope-v1';result.samples:=0;result.difficulty:=s.difficulty;result.reason:='manual';
 IF s.difficulty<>'adaptive' THEN RETURN result; END IF;
 -- Match the released assessment contract: model suggestions, drafts, unresolved
 -- reviews, exclusions and unsubmitted self-tests never contribute to adaptation.
 WITH scored AS (
  SELECT q.session_id,q.position,coalesce(q.antiderivative_identity,q.derivative_identity,q.fingerprint) identity,
   coalesce(q.answered_at,prior.submitted_at) answered_at,
   CASE WHEN r.state='resolved' AND d.resolved_choice IS NOT NULL THEN (q.choice=d.resolved_choice)::int
    WHEN r.id IS NULL AND q.math_verification IS NOT NULL THEN (q.choice=q.correct)::int END score
  FROM public.ai_practice_sessions prior JOIN practice_private.questions q ON q.session_id=prior.id
  LEFT JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position
  LEFT JOIN practice_private.review_details d ON d.review_id=r.id
  WHERE prior.user_id=s.user_id AND prior.course_id=s.course_id AND prior.scope_identity=s.scope_identity
   AND q.choice IS NOT NULL AND (prior.submitted_at IS NOT NULL OR (prior.mode='practice' AND q.answered_at IS NOT NULL))
 ), distinct_exercises AS (
  SELECT DISTINCT ON(identity) * FROM scored WHERE score IS NOT NULL
  ORDER BY identity,answered_at DESC,session_id DESC,position DESC
 ), recent AS (SELECT score FROM distinct_exercises ORDER BY answered_at DESC,session_id DESC,position DESC LIMIT 20)
 SELECT count(*),avg(score) INTO result.samples,accuracy FROM recent;
 IF result.samples<5 THEN result.difficulty:='medium';result.reason:='insufficient';
 ELSIF accuracy<0.5 THEN result.difficulty:='easy';result.reason:='support';
 ELSIF accuracy>=0.8 THEN result.difficulty:='hard';result.reason:='stretch';
 ELSE result.difficulty:='medium';result.reason:='steady'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION practice_private.plan_difficulty(public.ai_practice_sessions,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.ai_practice_generation_context(p_actor uuid,p_id uuid,p_position integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; n integer; plan practice_private.generation_plans;
BEGIN
 s:=practice_private.owned(p_id,p_actor);
 SELECT count(*) INTO n FROM practice_private.questions WHERE session_id=p_id;
 IF p_position IS NULL OR p_position<1 OR p_position>s.target OR p_position>n+1 THEN RAISE EXCEPTION 'Invalid generation position' USING ERRCODE='PT409'; END IF;
 IF p_position<=n THEN RETURN jsonb_build_object('exists',true,'courseId',s.course_id); END IF;
 IF s.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Session submitted' USING ERRCODE='PT409'; END IF;
 SELECT * INTO plan FROM practice_private.generation_plans WHERE session_id=p_id AND position=p_position;
 IF NOT FOUND THEN
  plan:=practice_private.plan_difficulty(s,p_position);
  INSERT INTO practice_private.generation_plans VALUES(plan.*);
 END IF;
 RETURN jsonb_build_object('exists',false,'courseId',s.course_id,'selection',s.selection,'units',s.units,'query',s.query,'language',s.language,'difficulty',plan.difficulty,
  'previousDerivativeInputs',coalesce((SELECT jsonb_agg(coefficients) FROM (
   SELECT q.math_verification->'task'->'coefficients' AS coefficients FROM practice_private.questions q
   JOIN public.ai_practice_sessions old ON old.id=q.session_id
   WHERE old.user_id=p_actor AND old.course_id=s.course_id AND q.derivative_identity IS NOT NULL
   AND (NOT s.allow_repeats OR old.id=p_id)
   ORDER BY old.created_at DESC,q.position DESC LIMIT 20) recent),'[]'::jsonb),
  'previousAntiderivativeInputs',coalesce((SELECT jsonb_agg(coefficients) FROM (
   SELECT q.math_verification->'task'->'coefficients' AS coefficients FROM practice_private.questions q
   JOIN public.ai_practice_sessions old ON old.id=q.session_id
   WHERE old.user_id=p_actor AND old.course_id=s.course_id AND q.antiderivative_identity IS NOT NULL
   AND (NOT s.allow_repeats OR old.id=p_id)
   ORDER BY old.created_at DESC,q.position DESC LIMIT 20) recent),'[]'::jsonb),
  'previous',coalesce((SELECT jsonb_agg(prompt) FROM (SELECT left(q.prompt,600) AS prompt FROM practice_private.questions q JOIN public.ai_practice_sessions old ON old.id=q.session_id
   WHERE old.user_id=p_actor AND old.course_id=s.course_id AND (NOT s.allow_repeats OR old.id=p_id)
   ORDER BY old.created_at DESC,q.position DESC LIMIT 20) recent),'[]'::jsonb));
END $$;


COMMIT;
