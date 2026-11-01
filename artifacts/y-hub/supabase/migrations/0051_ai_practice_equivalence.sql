-- Approved17: exact equivalence for the existing bounded polynomial derivative task.
-- Additive migration; historical attempts, choices, scores and citations are preserved.
BEGIN;

-- This is input normalization, not a second differentiation engine. For polynomials
-- over the reals, equal nonconstant coefficients are necessary and sufficient for
-- equal first derivatives (after renaming the single variable). Constants, language
-- and answer choice order do not define a new exercise. No equivalence is inferred
-- for ordinary/theoretical questions, unsupported expressions or unknown versions.
CREATE FUNCTION practice_private.derivative_identity(p_verification jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE task jsonb; coefficients jsonb; item jsonb; numbers integer[]:='{}'; n numeric; last_power integer;
BEGIN
 IF p_verification IS NULL OR jsonb_typeof(p_verification) IS DISTINCT FROM 'object'
 OR p_verification->>'method' IS DISTINCT FROM 'polynomial-derivative-v1' THEN RETURN NULL; END IF;
 task:=p_verification->'task';
 IF jsonb_typeof(task) IS DISTINCT FROM 'object' OR task->>'kind' IS DISTINCT FROM 'polynomial_derivative'
 OR coalesce(task->>'variable','') NOT IN ('x','t') THEN RETURN NULL; END IF;
 coefficients:=task->'coefficients';
 IF jsonb_typeof(coefficients) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
 IF jsonb_array_length(coefficients) NOT BETWEEN 1 AND 9 THEN RETURN NULL; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(coefficients) LOOP
  IF jsonb_typeof(item)<>'number' THEN RETURN NULL; END IF;
  n:=(item #>> '{}')::numeric;
  IF n<>trunc(n) OR abs(n)>100 THEN RETURN NULL; END IF;
  numbers:=array_append(numbers,n::integer);
 END LOOP;
 numbers[1]:=0; -- the additive constant has zero derivative
 last_power:=cardinality(numbers);
 WHILE last_power>1 AND numbers[last_power]=0 LOOP last_power:=last_power-1; END LOOP;
 RETURN 'polynomial-derivative-v1:'||to_jsonb(numbers[1:last_power])::text;
END $$;
REVOKE ALL ON FUNCTION practice_private.derivative_identity(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Stored/generated: derived solely from the trusted metadata, never a browser key.
-- Historical verified rows are indexed without changing their questions or grades;
-- preexisting duplicates are retained. Unsupported historical metadata remains NULL.
ALTER TABLE practice_private.questions ADD COLUMN derivative_identity text
 GENERATED ALWAYS AS (practice_private.derivative_identity(math_verification)) STORED;
CREATE INDEX practice_derivative_identity ON practice_private.questions(derivative_identity,session_id)
 WHERE derivative_identity IS NOT NULL;

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
 OR (p_verification-ARRAY['method','task'])<>'{}'::jsonb OR p_verification->>'method' IS DISTINCT FROM 'polynomial-derivative-v1'
 OR jsonb_typeof(p_verification->'task') IS DISTINCT FROM 'object' OR p_verification->'task'->>'kind' IS DISTINCT FROM 'polynomial_derivative'
 OR octet_length(p_verification::text)>2000 THEN RAISE EXCEPTION 'Invalid verification contract' USING ERRCODE='22023'; END IF;
 identity:=practice_private.derivative_identity(p_verification);
 IF identity IS NULL THEN RAISE EXCEPTION 'Unsupported derivative identity' USING ERRCODE='22023'; END IF;
 -- Same owner/section serialization as the ordinary publisher; checking before this
 -- lock would allow equivalent questions to race across different sessions/devices.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||s.course_id::text,49));
 IF EXISTS(SELECT 1 FROM practice_private.questions q JOIN public.ai_practice_sessions prior ON prior.id=q.session_id
  WHERE prior.user_id=p_actor AND prior.course_id=s.course_id AND q.derivative_identity=identity
  AND (NOT s.allow_repeats OR prior.id=p_id))
 THEN RAISE EXCEPTION 'Repeated mathematical question; retry generation' USING ERRCODE='PT409'; END IF;
 -- Existing publication locks sources, validates actual evidence and rejects duplicate
 -- history. Its question insert and this private metadata are one transaction.
 PERFORM public.publish_ai_practice_question(p_actor,p_id,p_position,p_question,p_evidence_ids);
 UPDATE practice_private.questions SET math_verification=p_verification WHERE session_id=p_id AND position=p_position;
END $$;
REVOKE ALL ON FUNCTION public.publish_ai_practice_math_question(uuid,uuid,integer,jsonb,uuid[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_ai_practice_math_question(uuid,uuid,integer,jsonb,uuid[],jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ai_practice_generation_context(p_actor uuid,p_id uuid,p_position integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; n integer;
BEGIN
 s:=practice_private.owned(p_id,p_actor);
 SELECT count(*) INTO n FROM practice_private.questions WHERE session_id=p_id;
 IF p_position IS NULL OR p_position<1 OR p_position>s.target OR p_position>n+1 THEN RAISE EXCEPTION 'Invalid generation position' USING ERRCODE='PT409'; END IF;
 IF p_position<=n THEN RETURN jsonb_build_object('exists',true,'courseId',s.course_id); END IF;
 IF s.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Session submitted' USING ERRCODE='PT409'; END IF;
 RETURN jsonb_build_object('exists',false,'courseId',s.course_id,'selection',s.selection,'units',s.units,'query',s.query,'language',s.language,'difficulty',s.difficulty,
  'previousDerivativeInputs',coalesce((SELECT jsonb_agg(coefficients) FROM (
   SELECT q.math_verification->'task'->'coefficients' AS coefficients FROM practice_private.questions q
   JOIN public.ai_practice_sessions old ON old.id=q.session_id
   WHERE old.user_id=p_actor AND old.course_id=s.course_id AND q.derivative_identity IS NOT NULL
   AND (NOT s.allow_repeats OR old.id=p_id)
   ORDER BY old.created_at DESC,q.position DESC LIMIT 20) recent),'[]'::jsonb),
  'previous',coalesce((SELECT jsonb_agg(prompt) FROM (SELECT left(q.prompt,600) AS prompt FROM practice_private.questions q JOIN public.ai_practice_sessions old ON old.id=q.session_id
   WHERE old.user_id=p_actor AND old.course_id=s.course_id AND (NOT s.allow_repeats OR old.id=p_id)
   ORDER BY old.created_at DESC,q.position DESC LIMIT 20) recent),'[]'::jsonb));
END $$;

COMMIT;
