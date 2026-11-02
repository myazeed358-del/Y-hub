-- Approved16: server-selected difficulty from released, verified practice outcomes.
BEGIN;
ALTER TABLE public.ai_practice_sessions DROP CONSTRAINT ai_practice_sessions_difficulty_check;
ALTER TABLE public.ai_practice_sessions ADD CONSTRAINT ai_practice_sessions_difficulty_check
 CHECK(difficulty IN ('easy','medium','hard','adaptive'));

-- Order-independent exact scope, including source generations and physical pages.
-- No guessed PDF chapter/topic equivalence. Same syllabus unit IDs stay distinct
-- from a different topic or an unrestricted whole-source session.
CREATE FUNCTION practice_private.scope_identity(p_selection jsonb,p_units uuid[],p_query text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object(
  'sources',(SELECT jsonb_agg(jsonb_build_object('sourceId',(x->>'sourceId')::uuid,'revision',(x->>'revision')::uuid,
   'pages',(SELECT coalesce(jsonb_agg(n ORDER BY n),'[]'::jsonb) FROM (SELECT DISTINCT value::integer n FROM jsonb_array_elements_text(x->'pages')) pages)) ORDER BY (x->>'sourceId')::uuid) FROM jsonb_array_elements(p_selection) x),
  'units',(SELECT coalesce(jsonb_agg(id ORDER BY id),'[]'::jsonb) FROM (SELECT DISTINCT unnest(p_units) id) u),
  'query',lower(regexp_replace(btrim(p_query),'[[:space:]]+',' ','g'))
 )::text,'UTF8')),'hex');
$$;
REVOKE ALL ON FUNCTION practice_private.scope_identity(jsonb,uuid[],text) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.ai_practice_sessions ADD COLUMN scope_identity text
 GENERATED ALWAYS AS (practice_private.scope_identity(selection,units,query)) STORED;
CREATE INDEX practice_adaptive_scope ON public.ai_practice_sessions(user_id,course_id,scope_identity);

-- Reserve once BEFORE the provider request. Retries/concurrent devices cannot
-- associate an already-generated question with a newly recomputed difficulty.
CREATE TABLE practice_private.generation_plans (
 session_id uuid NOT NULL REFERENCES public.ai_practice_sessions ON DELETE CASCADE,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 100),
 difficulty text NOT NULL CHECK(difficulty IN ('easy','medium','hard')),
 reason text NOT NULL CHECK(reason IN ('manual','insufficient','support','steady','stretch')),
 samples integer NOT NULL CHECK(samples BETWEEN 0 AND 20),
 policy text NOT NULL CHECK(policy='confirmed-scope-v1'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,position)
);
ALTER TABLE practice_private.generation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_private.generation_plans FORCE ROW LEVEL SECURITY;
REVOKE ALL ON practice_private.generation_plans FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION practice_private.plan_difficulty(s public.ai_practice_sessions,p_position integer)
RETURNS practice_private.generation_plans LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result practice_private.generation_plans; accuracy numeric;
BEGIN
 result.session_id:=s.id;result.position:=p_position;result.created_at:=clock_timestamp();
 result.policy:='confirmed-scope-v1';result.samples:=0;result.difficulty:=s.difficulty;result.reason:='manual';
 IF s.difficulty<>'adaptive' THEN RETURN result; END IF;
 -- Match the released assessment contract: model suggestions, drafts, unresolved
 -- reviews, exclusions and unsubmitted self-tests never contribute to adaptation.
 WITH scored AS (
  SELECT q.session_id,q.position,coalesce(q.derivative_identity,q.fingerprint) identity,
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

-- All publication paths pass through this trigger. Adaptive questions require the
-- same saved plan used by the worker, not a browser/model-supplied level or score.
CREATE FUNCTION practice_private.require_generation_plan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.ai_practice_sessions WHERE id=NEW.session_id AND difficulty='adaptive')
 AND NOT EXISTS(SELECT 1 FROM practice_private.generation_plans WHERE session_id=NEW.session_id AND position=NEW.position)
 THEN RAISE EXCEPTION 'Generation plan required' USING ERRCODE='PT409'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION practice_private.require_generation_plan() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER practice_generation_plan BEFORE INSERT ON practice_private.questions
 FOR EACH ROW EXECUTE FUNCTION practice_private.require_generation_plan();

CREATE OR REPLACE FUNCTION public.create_ai_practice_session(p_id uuid,p_course uuid,p_selection jsonb,p_units uuid[],p_query text,
 p_mode text,p_difficulty text,p_language text,p_target integer,p_allow_repeats boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; scope jsonb;
BEGIN
 IF p_id IS NULL OR p_mode IS NULL OR p_mode NOT IN ('practice','exam') OR p_difficulty IS NULL OR p_difficulty NOT IN ('easy','medium','hard','adaptive')
 OR p_language IS NULL OR p_language NOT IN ('ar','en') OR p_target IS NULL OR p_target NOT BETWEEN 1 AND 100 OR p_allow_repeats IS NULL
 THEN RAISE EXCEPTION 'Invalid session settings' USING ERRCODE='22023'; END IF;
 PERFORM practice_private.authorize(auth.uid(),p_course);
 -- Existing contract validates IDs, pages, current revisions, units and bounded input.
 scope:=public.preview_ai_practice_sources(p_course,p_selection,p_units,p_query);
 IF jsonb_array_length(scope->'evidence')=0 THEN RAISE EXCEPTION 'No indexed passages match this scope' USING ERRCODE='PT422'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,48));
 SELECT * INTO s FROM public.ai_practice_sessions WHERE id=p_id;
 IF FOUND THEN
  IF s.user_id IS DISTINCT FROM auth.uid() OR (s.course_id,s.selection,s.units,s.query,s.mode,s.difficulty,s.language,s.target,s.allow_repeats)
   IS DISTINCT FROM (p_course,p_selection,p_units,p_query,p_mode,p_difficulty,p_language,p_target,p_allow_repeats)
  THEN RAISE EXCEPTION 'Session creation conflict' USING ERRCODE='PT409'; END IF;
  RETURN s.id;
 END IF;
 INSERT INTO public.ai_practice_sessions(id,user_id,course_id,selection,units,query,mode,difficulty,language,target,allow_repeats)
 VALUES(p_id,auth.uid(),p_course,p_selection,p_units,p_query,p_mode,p_difficulty,p_language,p_target,p_allow_repeats) RETURNING * INTO s;
 PERFORM practice_private.current_scope(s);
 RETURN p_id;
END $$;


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
  'previous',coalesce((SELECT jsonb_agg(prompt) FROM (SELECT left(q.prompt,600) AS prompt FROM practice_private.questions q JOIN public.ai_practice_sessions old ON old.id=q.session_id
   WHERE old.user_id=p_actor AND old.course_id=s.course_id AND (NOT s.allow_repeats OR old.id=p_id)
   ORDER BY old.created_at DESC,q.position DESC LIMIT 20) recent),'[]'::jsonb));
END $$;


CREATE OR REPLACE FUNCTION public.read_ai_practice_session(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; questions jsonb;
BEGIN
 s:=practice_private.owned(p_id,auth.uid());
 SELECT coalesce(jsonb_agg(jsonb_build_object('position',q.position,'prompt',q.prompt,'options',q.options,'choice',q.choice,
  'answered',q.answered_at IS NOT NULL,
  'generation',jsonb_build_object('difficulty',coalesce(p.difficulty,s.difficulty),'reason',coalesce(p.reason,'manual'),'samples',coalesce(p.samples,0)),
  'feedback',CASE WHEN s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL)
   THEN jsonb_build_object('suggestedChoice',q.correct,'matchesSuggestion',q.choice=q.correct,'explanation',q.explanation,'citations',q.evidence,'verification',CASE WHEN q.math_verification IS NOT NULL THEN q.math_verification->>'method' END)
   ELSE NULL END) ORDER BY q.position),'[]'::jsonb) INTO questions FROM practice_private.questions q LEFT JOIN practice_private.generation_plans p ON p.session_id=q.session_id AND p.position=q.position WHERE q.session_id=p_id;
 RETURN jsonb_build_object('id',s.id,'courseId',s.course_id,'mode',s.mode,'difficulty',s.difficulty,'language',s.language,'target',s.target,
  'revision',s.revision,'submittedAt',s.submitted_at,'questions',questions);
END $$;

COMMIT;
