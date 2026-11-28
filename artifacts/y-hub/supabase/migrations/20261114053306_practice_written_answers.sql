-- Decision18: bounded written polynomial answers. Private content, server scoring,
-- current authorization and existing release/review rules. No historical backfill.
BEGIN;
ALTER TABLE practice_private.questions
 ADD COLUMN written_answer text CHECK(length(written_answer) BETWEEN 1 AND 400),
 ADD COLUMN written_score integer CHECK(written_score IN (0,1)),
 ADD COLUMN written_explanation text CHECK(length(written_explanation) BETWEEN 1 AND 4000),
 ADD CONSTRAINT practice_written_answer CHECK (
  (written_answer IS NULL AND written_score IS NULL AND written_explanation IS NULL)
  OR (written_answer IS NOT NULL AND choice IS NULL AND written_explanation IS NOT NULL
   AND (derivative_identity IS NOT NULL OR antiderivative_identity IS NOT NULL)));
ALTER TABLE practice_private.review_details
 ADD COLUMN written_auto_score integer CHECK(written_auto_score IN (0,1)),
 ADD COLUMN written_resolved_score integer CHECK(written_resolved_score IN (0,1));

-- Shared rule for assessment, weighted performance and future adaptive plans.
CREATE FUNCTION practice_private.answer_score(q practice_private.questions,r public.ai_practice_reviews,d practice_private.review_details)
RETURNS integer LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN r.state='resolved' THEN
  CASE WHEN q.written_answer IS NOT NULL THEN d.written_resolved_score
   WHEN d.resolved_choice IS NOT NULL THEN (q.choice=d.resolved_choice)::int END
 WHEN r.id IS NULL AND q.math_verification IS NOT NULL THEN
  CASE WHEN q.written_answer IS NOT NULL THEN q.written_score ELSE (q.choice=q.correct)::int END END;
$$;
CREATE FUNCTION practice_private.answer_excluded(q practice_private.questions,r public.ai_practice_reviews,d practice_private.review_details)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(r.state='resolved' AND CASE WHEN q.written_answer IS NOT NULL
  THEN d.written_resolved_score IS NULL ELSE d.resolved_choice IS NULL END,false);
$$;
CREATE FUNCTION practice_private.written_question(p_actor uuid,p_id uuid,p_position integer)
RETURNS practice_private.questions LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; q practice_private.questions;
BEGIN
 s:=practice_private.owned(p_id,p_actor);
 PERFORM 1 FROM public.module_policies WHERE id='calculus-1' FOR SHARE;
 PERFORM 1 FROM public.engine_grants WHERE student_id=p_actor AND engine_id='calculus-1' FOR SHARE;
 IF NOT yhub_access_private.allowed(p_actor,'calculus-1') THEN RAISE EXCEPTION 'Engine access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM practice_private.questions WHERE session_id=p_id AND position=p_position;
 IF NOT FOUND OR (q.derivative_identity IS NULL AND q.antiderivative_identity IS NULL)
 THEN RAISE EXCEPTION 'Written answer not supported' USING ERRCODE='22023'; END IF;
 RETURN q;
END $$;

-- Context and writer are service-only; the Edge runtime derives actor from JWT.
CREATE FUNCTION public.ai_practice_written_context(p_actor uuid,p_id uuid,p_position integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q practice_private.questions; s public.ai_practice_sessions;
BEGIN
 q:=practice_private.written_question(p_actor,p_id,p_position);
 SELECT * INTO s FROM public.ai_practice_sessions WHERE id=p_id;
 RETURN jsonb_build_object('courseId',s.course_id,'language',s.language,'verification',q.math_verification);
END $$;
CREATE FUNCTION public.save_ai_practice_written_answer(p_actor uuid,p_id uuid,p_position integer,p_revision bigint,
 p_text text,p_score integer,p_explanation text,p_answer boolean DEFAULT false) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q practice_private.questions; s public.ai_practice_sessions;
BEGIN
 q:=practice_private.written_question(p_actor,p_id,p_position);
 SELECT * INTO s FROM public.ai_practice_sessions WHERE id=p_id;
 IF p_text IS NULL OR length(btrim(p_text)) NOT BETWEEN 1 AND 400 OR length(p_text)>400
 OR (p_score IS NOT NULL AND p_score NOT IN (0,1)) OR p_explanation IS NULL OR length(p_explanation) NOT BETWEEN 1 AND 4000
 OR p_revision IS NULL OR p_revision<1 OR p_answer IS NULL
 THEN RAISE EXCEPTION 'Invalid written answer' USING ERRCODE='22023'; END IF;
 -- Lost-ack retry is idempotent and does not replace a saved computation.
 IF q.written_answer=p_text AND (NOT p_answer OR q.answered_at IS NOT NULL) THEN RETURN s.revision; END IF;
 IF s.submitted_at IS NOT NULL OR q.answered_at IS NOT NULL OR s.revision<>p_revision
 THEN RAISE EXCEPTION 'Session changed; reload' USING ERRCODE='PT409'; END IF;
 UPDATE practice_private.questions SET choice=NULL,written_answer=p_text,written_score=p_score,written_explanation=p_explanation,
  answered_at=CASE WHEN p_answer THEN clock_timestamp() END WHERE session_id=p_id AND position=p_position;
 UPDATE public.ai_practice_sessions SET revision=revision+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING revision INTO s.revision;
 RETURN s.revision;
END $$;

CREATE FUNCTION public.publish_ai_practice_written_recheck(p_actor uuid,p_review uuid,p_revision bigint,p_score integer,p_explanation text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions; q practice_private.questions;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review AND student_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 s:=practice_private.owned(r.session_id,p_actor);q:=practice_private.reviewable(s,r.position);
 -- A null outcome records an unsuccessful attempt without computing or grading;
 -- it must still permit human review if the separate engine grant was revoked.
 IF p_score IS NOT NULL THEN PERFORM practice_private.written_question(p_actor,r.session_id,r.position); END IF;
 IF q.written_answer IS NULL THEN RAISE EXCEPTION 'Not a written answer' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review FOR UPDATE;
 IF r.state<>'automatic_pending' THEN RETURN r.revision; END IF;
 IF p_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'Review changed' USING ERRCODE='PT409'; END IF;
 IF (p_score IS NOT NULL AND p_score NOT IN (0,1)) OR p_explanation IS NULL OR length(btrim(p_explanation)) NOT BETWEEN 1 AND 4000
 THEN RAISE EXCEPTION 'Invalid recheck' USING ERRCODE='22023'; END IF;
 UPDATE practice_private.review_details SET written_auto_score=p_score,auto_explanation=p_explanation WHERE review_id=p_review;
 UPDATE public.ai_practice_reviews SET state='needs_review',revision=revision+1,
 auto_outcome=CASE WHEN p_score IS NULL THEN 'uncertain' WHEN p_score=q.written_score THEN 'agrees' ELSE 'disagrees' END
 WHERE id=p_review RETURNING revision INTO r.revision;
 RETURN r.revision;
END $$;

CREATE FUNCTION public.resolve_ai_practice_written_review(p_review uuid,p_revision bigint,p_score integer,p_explanation text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; d practice_private.review_details;
BEGIN
 r:=practice_private.reviewer_context(p_review);
 IF NOT EXISTS(SELECT 1 FROM practice_private.questions WHERE session_id=r.session_id AND position=r.position AND written_answer IS NOT NULL)
 THEN RAISE EXCEPTION 'Not a written answer' USING ERRCODE='22023'; END IF;
 IF (p_score IS NOT NULL AND p_score NOT IN (0,1)) OR p_explanation IS NULL OR length(btrim(p_explanation)) NOT BETWEEN 10 AND 2000
 THEN RAISE EXCEPTION 'Resolution needs a score or explicit exclusion and explanation' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM practice_private.review_details WHERE review_id=p_review;
 IF r.state='resolved' AND (d.written_resolved_score,d.resolution) IS NOT DISTINCT FROM (p_score,btrim(p_explanation)) THEN RETURN r.revision; END IF;
 IF r.state<>'requested' OR p_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'Review already changed' USING ERRCODE='PT409'; END IF;
 UPDATE practice_private.review_details SET written_resolved_score=p_score,resolution=btrim(p_explanation) WHERE review_id=p_review;
 UPDATE public.ai_practice_reviews SET state='resolved',resolved_at=clock_timestamp(),resolved_by=auth.uid(),revision=revision+1 WHERE id=p_review RETURNING revision INTO r.revision;
 RETURN r.revision;
END $$;

REVOKE ALL ON FUNCTION practice_private.answer_score(practice_private.questions,public.ai_practice_reviews,practice_private.review_details),
 practice_private.answer_excluded(practice_private.questions,public.ai_practice_reviews,practice_private.review_details),
 practice_private.written_question(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.ai_practice_written_context(uuid,uuid,integer),
 public.save_ai_practice_written_answer(uuid,uuid,integer,bigint,text,integer,text,boolean),
 public.publish_ai_practice_written_recheck(uuid,uuid,bigint,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_practice_written_context(uuid,uuid,integer),
 public.save_ai_practice_written_answer(uuid,uuid,integer,bigint,text,integer,text,boolean),
 public.publish_ai_practice_written_recheck(uuid,uuid,bigint,integer,text) TO service_role;
REVOKE ALL ON FUNCTION public.resolve_ai_practice_written_review(uuid,bigint,integer,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_ai_practice_written_review(uuid,bigint,integer,text) TO authenticated;


-- Preserve existing contracts and privileges while extending written-answer eligibility.
CREATE OR REPLACE FUNCTION public.save_ai_practice_answer(p_id uuid,p_position integer,p_revision bigint,p_choice integer,p_answer boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; q practice_private.questions;
BEGIN
 s:=practice_private.owned(p_id,auth.uid());
 IF p_choice IS NULL OR p_choice NOT BETWEEN 0 AND 3 OR p_answer IS NULL OR p_revision IS NULL THEN RAISE EXCEPTION 'Invalid choice' USING ERRCODE='22023'; END IF;
 SELECT * INTO q FROM practice_private.questions WHERE session_id=p_id AND position=p_position;
 IF NOT FOUND THEN RAISE EXCEPTION 'Question unavailable' USING ERRCODE='22023'; END IF;
 IF q.choice=p_choice AND (NOT p_answer OR q.answered_at IS NOT NULL) THEN RETURN s.revision; END IF;
 IF s.submitted_at IS NOT NULL OR q.answered_at IS NOT NULL OR s.revision<>p_revision THEN RAISE EXCEPTION 'Session changed; reload' USING ERRCODE='PT409'; END IF;
 UPDATE practice_private.questions SET choice=p_choice,written_answer=NULL,written_score=NULL,written_explanation=NULL,answered_at=CASE WHEN p_answer THEN clock_timestamp() END WHERE session_id=p_id AND position=p_position;
 UPDATE public.ai_practice_sessions SET revision=revision+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING revision INTO s.revision;
 RETURN s.revision;
END $$;

CREATE OR REPLACE FUNCTION public.read_ai_practice_session(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; questions jsonb;
BEGIN
 s:=practice_private.owned(p_id,auth.uid());
 SELECT coalesce(jsonb_agg(jsonb_build_object('position',q.position,'prompt',q.prompt,'options',q.options,'choice',q.choice,
  'answered',q.answered_at IS NOT NULL,'writtenAnswer',q.written_answer,
  'acceptsWritten',(q.derivative_identity IS NOT NULL OR q.antiderivative_identity IS NOT NULL),
  'generation',jsonb_build_object('difficulty',coalesce(p.difficulty,s.difficulty),'reason',coalesce(p.reason,'manual'),'samples',coalesce(p.samples,0)),
  'feedback',CASE WHEN s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL)
   THEN jsonb_build_object('suggestedChoice',q.correct,'matchesSuggestion',q.choice=q.correct,
    'writtenResult',CASE WHEN q.written_answer IS NOT NULL THEN jsonb_build_object('score',q.written_score,'explanation',q.written_explanation) END,'explanation',q.explanation,'citations',q.evidence,'verification',CASE WHEN q.math_verification IS NOT NULL THEN q.math_verification->>'method' END)
   ELSE NULL END) ORDER BY q.position),'[]'::jsonb) INTO questions FROM practice_private.questions q LEFT JOIN practice_private.generation_plans p ON p.session_id=q.session_id AND p.position=q.position WHERE q.session_id=p_id;
 RETURN jsonb_build_object('id',s.id,'courseId',s.course_id,'mode',s.mode,'difficulty',s.difficulty,'language',s.language,'target',s.target,
  'revision',s.revision,'submittedAt',s.submitted_at,'questions',questions);
END $$;

CREATE OR REPLACE FUNCTION practice_private.reviewable(s public.ai_practice_sessions,p_position integer) RETURNS practice_private.questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q practice_private.questions;
BEGIN
 SELECT * INTO q FROM practice_private.questions WHERE session_id=s.id AND position=p_position;
 IF NOT FOUND OR (q.choice IS NULL AND q.written_answer IS NULL) OR NOT(s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL))
 THEN RAISE EXCEPTION 'Answer not ready for review' USING ERRCODE='PT409'; END IF;
 RETURN q;
END $$;

CREATE OR REPLACE FUNCTION public.ai_practice_review_context(p_actor uuid,p_review uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions; q practice_private.questions;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review AND student_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 s:=practice_private.owned(r.session_id,p_actor);q:=practice_private.reviewable(s,r.position);
 RETURN jsonb_build_object('courseId',r.course_id,'revision',r.revision,'done',r.state<>'automatic_pending',
  'writtenAnswer',q.written_answer,'verification',CASE WHEN q.written_answer IS NOT NULL THEN q.math_verification END,
  'language',s.language,'prompt',q.prompt,'options',q.options,'evidence',q.evidence);
END $$;

CREATE OR REPLACE FUNCTION public.publish_ai_practice_recheck(p_actor uuid,p_review uuid,p_revision bigint,p_kind text,p_choice integer,p_explanation text,p_evidence uuid[])
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions; q practice_private.questions;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review AND student_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 s:=practice_private.owned(r.session_id,p_actor);q:=practice_private.reviewable(s,r.position);
 IF q.written_answer IS NOT NULL THEN RAISE EXCEPTION 'Use written recheck' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review FOR UPDATE;
 IF r.state<>'automatic_pending' THEN RETURN r.revision; END IF; -- duplicate/late delivery cannot overwrite a human decision
 IF p_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'Review changed' USING ERRCODE='PT409'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('suggestion','uncertain','unavailable') OR p_explanation IS NULL OR length(btrim(p_explanation)) NOT BETWEEN 1 AND 4000
 OR (p_kind='suggestion' AND (p_choice IS NULL OR p_choice NOT BETWEEN 0 AND 3)) OR (p_kind<>'suggestion' AND p_choice IS NOT NULL)
 OR p_evidence IS NULL OR cardinality(p_evidence)>6 OR array_position(p_evidence,NULL) IS NOT NULL OR (p_kind='suggestion' AND cardinality(p_evidence)=0)
 THEN RAISE EXCEPTION 'Invalid recheck' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_evidence) e(id) WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.evidence) actual WHERE (actual->>'id')::uuid=e.id))
 THEN RAISE EXCEPTION 'Unsupported evidence' USING ERRCODE='22023'; END IF;
 UPDATE practice_private.review_details SET auto_choice=p_choice,auto_explanation=p_explanation WHERE review_id=p_review;
 UPDATE public.ai_practice_reviews SET state='needs_review',revision=revision+1,
  auto_outcome=CASE WHEN p_kind='suggestion' THEN CASE WHEN p_choice=q.correct THEN 'agrees' ELSE 'disagrees' END ELSE p_kind END
 WHERE id=p_review RETURNING revision INTO r.revision;
 RETURN r.revision;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_ai_practice_review(p_review uuid,p_revision bigint,p_choice integer,p_explanation text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; d practice_private.review_details;
BEGIN
 r:=practice_private.reviewer_context(p_review);
 IF EXISTS(SELECT 1 FROM practice_private.questions WHERE session_id=r.session_id AND position=r.position AND written_answer IS NOT NULL) THEN RAISE EXCEPTION 'Use written resolution' USING ERRCODE='22023'; END IF;
 IF (p_choice IS NOT NULL AND p_choice NOT BETWEEN 0 AND 3) OR p_explanation IS NULL OR length(btrim(p_explanation)) NOT BETWEEN 10 AND 2000
 THEN RAISE EXCEPTION 'Resolution needs a supported choice or explicit exclusion and explanation' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM practice_private.review_details WHERE review_id=p_review;
 IF r.state='resolved' AND (d.resolved_choice,d.resolution) IS NOT DISTINCT FROM (p_choice,btrim(p_explanation)) THEN RETURN r.revision; END IF;
 IF r.state<>'requested' OR p_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'Review already changed' USING ERRCODE='PT409'; END IF;
 UPDATE practice_private.review_details SET resolved_choice=p_choice,resolution=btrim(p_explanation) WHERE review_id=p_review;
 UPDATE public.ai_practice_reviews SET state='resolved',resolved_at=clock_timestamp(),resolved_by=auth.uid(),revision=revision+1 WHERE id=p_review RETURNING revision INTO r.revision;
 RETURN r.revision;
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
 RETURN jsonb_build_object('review',to_jsonb(r),'question',jsonb_build_object('prompt',q.prompt,'options',q.options,'choice',q.choice,'writtenAnswer',q.written_answer,'suggestedChoice',q.correct,'explanation',q.explanation,'citations',q.evidence,'verification',q.math_verification->>'method'),
  'automatic',jsonb_build_object('score',d.written_auto_score,'choice',d.auto_choice,'explanation',d.auto_explanation),
  'resolution',CASE WHEN r.state='resolved' THEN jsonb_build_object('choice',d.resolved_choice,'explanation',d.resolution,'score',practice_private.answer_score(q,r,d)) END);
END $$;

CREATE OR REPLACE FUNCTION public.get_ai_practice_assessment(p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; result jsonb;
BEGIN
 s:=practice_private.owned(p_session,auth.uid());
 WITH evaluated AS (
 SELECT q.position,r.id,r.revision,r.auto_outcome,
 CASE WHEN r.id IS NOT NULL THEN r.state WHEN q.math_verification IS NOT NULL AND (q.written_answer IS NULL OR q.written_score IS NOT NULL) THEN 'math_verified' ELSE 'unverified' END state,
 practice_private.answer_score(q,r,d) score,
 practice_private.answer_excluded(q,r,d) excluded
 FROM practice_private.questions q LEFT JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position
 LEFT JOIN practice_private.review_details d ON d.review_id=r.id
 WHERE q.session_id=p_session AND (q.choice IS NOT NULL OR q.written_answer IS NOT NULL) AND (s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL))
 ) SELECT jsonb_build_object(
 'items',coalesce(jsonb_agg(jsonb_build_object('position',position,'id',id,'state',state,'revision',revision,'outcome',auto_outcome,'score',score) ORDER BY position),'[]'::jsonb),
 'earned',coalesce(sum(score),0),'graded',count(score),'pending',count(*) FILTER(WHERE score IS NULL AND NOT coalesce(excluded,false)),
 'excluded',count(*) FILTER(WHERE excluded)) INTO result FROM evaluated;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION practice_private.performance_answers(p_actor uuid,p_course uuid)
RETURNS TABLE(mode text,evidence jsonb,score integer,excluded boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT s.mode,q.evidence,
 practice_private.answer_score(q,r,d),
 practice_private.answer_excluded(q,r,d)
 FROM public.ai_practice_sessions s JOIN practice_private.questions q ON q.session_id=s.id
 LEFT JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position
 LEFT JOIN practice_private.review_details d ON d.review_id=r.id
 WHERE s.user_id=p_actor AND s.course_id=p_course AND (q.choice IS NOT NULL OR q.written_answer IS NOT NULL)
 AND (s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL))
 -- Match session reads: invalidated/deleted/unreadable source scopes cannot expose
 -- their protected history through an aggregate RPC either.
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.selection) pick WHERE NOT practice_private.outline_matches(pick,p_course) OR NOT EXISTS(
  SELECT 1 FROM public.ai_tutor_sources src WHERE src.id=(pick->>'sourceId')::uuid AND src.course_id=p_course
   AND src.revision=(pick->>'revision')::uuid AND src.status='ready'));
$$;
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
   practice_private.answer_score(q,r,d) score
  FROM public.ai_practice_sessions prior JOIN practice_private.questions q ON q.session_id=prior.id
  LEFT JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position
  LEFT JOIN practice_private.review_details d ON d.review_id=r.id
  WHERE prior.user_id=s.user_id AND prior.course_id=s.course_id AND prior.scope_identity=s.scope_identity
   AND (q.choice IS NOT NULL OR q.written_answer IS NOT NULL) AND (prior.submitted_at IS NOT NULL OR (prior.mode='practice' AND q.answered_at IS NOT NULL))
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
COMMIT;
