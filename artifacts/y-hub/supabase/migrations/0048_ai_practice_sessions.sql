-- Approved 16/17/19/21/22/38: private, resumable, incrementally generated practice.
-- Additive only. Model suggestions are not official grades or verified mathematics.
BEGIN;
CREATE SCHEMA practice_private;
REVOKE ALL ON SCHEMA practice_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.ai_practice_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
 course_id uuid NOT NULL REFERENCES public.courses ON DELETE CASCADE,
 selection jsonb NOT NULL, units uuid[] NOT NULL, query text NOT NULL,
 mode text NOT NULL CHECK(mode IN ('practice','exam')),
 difficulty text NOT NULL CHECK(difficulty IN ('easy','medium','hard')),
 language text NOT NULL CHECK(language IN ('ar','en')),
 target integer NOT NULL CHECK(target BETWEEN 1 AND 100), allow_repeats boolean NOT NULL,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0), submitted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX practice_sessions_owner ON public.ai_practice_sessions(user_id,course_id,created_at DESC,id);
ALTER TABLE public.ai_practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_practice_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_practice_sessions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ai_practice_sessions TO authenticated;
CREATE POLICY practice_own_session ON public.ai_practice_sessions FOR SELECT TO authenticated
 USING(user_id=auth.uid() AND public.ai_tutor_access(course_id));
CREATE TABLE practice_private.questions (
 session_id uuid NOT NULL REFERENCES public.ai_practice_sessions ON DELETE CASCADE,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 100), prompt text NOT NULL,
 options jsonb NOT NULL, correct integer NOT NULL CHECK(correct BETWEEN 0 AND 3), explanation text NOT NULL,
 evidence jsonb NOT NULL, fingerprint text NOT NULL, choice integer CHECK(choice BETWEEN 0 AND 3), answered_at timestamptz,
 PRIMARY KEY(session_id,position)
);
CREATE INDEX practice_question_fingerprint ON practice_private.questions(fingerprint);
ALTER TABLE practice_private.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_private.questions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON practice_private.questions FROM PUBLIC,anon,authenticated,service_role;

-- Acquire current authorization locks before a mutation; a concurrent withdrawal/role
-- change either precedes this check or waits for its already-authorized transaction.
CREATE FUNCTION practice_private.authorize(p_actor uuid,p_course uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.courses WHERE id=p_course FOR SHARE;
 PERFORM 1 FROM public.users WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.course_enrollments WHERE course_id=p_course AND student_id=p_actor FOR SHARE;
 IF p_actor IS NULL OR NOT tutor_private.access(p_actor,p_course) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION practice_private.current_scope(s public.ai_practice_sessions) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(s.selection) LOOP
  PERFORM 1 FROM public.ai_tutor_sources src WHERE src.id=(item->>'sourceId')::uuid AND src.course_id=s.course_id
   AND src.revision=(item->>'revision')::uuid AND src.status='ready' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sources changed; create a new session' USING ERRCODE='PT409'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION practice_private.owned(p_id uuid,p_actor uuid) RETURNS public.ai_practice_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions;
BEGIN
 SELECT * INTO s FROM public.ai_practice_sessions WHERE id=p_id AND user_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='42501'; END IF;
 PERFORM practice_private.authorize(p_actor,s.course_id);
 SELECT * INTO s FROM public.ai_practice_sessions WHERE id=p_id AND user_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='42501'; END IF;
 PERFORM practice_private.current_scope(s);
 RETURN s;
END $$;
CREATE FUNCTION public.create_ai_practice_session(p_id uuid,p_course uuid,p_selection jsonb,p_units uuid[],p_query text,
 p_mode text,p_difficulty text,p_language text,p_target integer,p_allow_repeats boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; scope jsonb;
BEGIN
 IF p_id IS NULL OR p_mode IS NULL OR p_mode NOT IN ('practice','exam') OR p_difficulty IS NULL OR p_difficulty NOT IN ('easy','medium','hard')
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

CREATE FUNCTION public.read_ai_practice_session(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; questions jsonb;
BEGIN
 s:=practice_private.owned(p_id,auth.uid());
 SELECT coalesce(jsonb_agg(jsonb_build_object('position',q.position,'prompt',q.prompt,'options',q.options,'choice',q.choice,
  'answered',q.answered_at IS NOT NULL,
  'feedback',CASE WHEN s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL)
   THEN jsonb_build_object('suggestedChoice',q.correct,'matchesSuggestion',q.choice=q.correct,'explanation',q.explanation,'citations',q.evidence)
   ELSE NULL END) ORDER BY q.position),'[]'::jsonb) INTO questions FROM practice_private.questions q WHERE session_id=p_id;
 RETURN jsonb_build_object('id',s.id,'courseId',s.course_id,'mode',s.mode,'difficulty',s.difficulty,'language',s.language,'target',s.target,
  'revision',s.revision,'submittedAt',s.submitted_at,'questions',questions);
END $$;
-- The caller sees only its own paginated metadata, never another user's answers.
CREATE FUNCTION public.list_ai_practice_sessions(p_course uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT public.ai_tutor_access(p_course) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Invalid offset' USING ERRCODE='22023'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,mode,difficulty,language,target,created_at,updated_at,submitted_at
  FROM public.ai_practice_sessions WHERE course_id=p_course ORDER BY created_at DESC,id LIMIT 20 OFFSET p_offset) x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.save_ai_practice_answer(p_id uuid,p_position integer,p_revision bigint,p_choice integer,p_answer boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; q practice_private.questions;
BEGIN
 s:=practice_private.owned(p_id,auth.uid());
 IF p_choice IS NULL OR p_choice NOT BETWEEN 0 AND 3 OR p_answer IS NULL OR p_revision IS NULL THEN RAISE EXCEPTION 'Invalid choice' USING ERRCODE='22023'; END IF;
 SELECT * INTO q FROM practice_private.questions WHERE session_id=p_id AND position=p_position;
 IF NOT FOUND THEN RAISE EXCEPTION 'Question unavailable' USING ERRCODE='22023'; END IF;
 IF q.choice=p_choice AND (NOT p_answer OR q.answered_at IS NOT NULL) THEN RETURN s.revision; END IF;
 IF s.submitted_at IS NOT NULL OR q.answered_at IS NOT NULL OR s.revision<>p_revision THEN RAISE EXCEPTION 'Session changed; reload' USING ERRCODE='PT409'; END IF;
 UPDATE practice_private.questions SET choice=p_choice,answered_at=CASE WHEN p_answer THEN clock_timestamp() END WHERE session_id=p_id AND position=p_position;
 UPDATE public.ai_practice_sessions SET revision=revision+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING revision INTO s.revision;
 RETURN s.revision;
END $$;
CREATE FUNCTION public.submit_ai_practice_session(p_id uuid,p_revision bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions;
BEGIN
 s:=practice_private.owned(p_id,auth.uid());
 IF s.submitted_at IS NOT NULL THEN RETURN s.revision; END IF;
 IF p_revision IS NULL OR s.revision<>p_revision OR (SELECT count(*) FROM practice_private.questions WHERE session_id=p_id)<>s.target
 THEN RAISE EXCEPTION 'Session changed or generation incomplete' USING ERRCODE='PT409'; END IF;
 UPDATE public.ai_practice_sessions SET submitted_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1 WHERE id=p_id RETURNING revision INTO s.revision;
 RETURN s.revision;
END $$;

-- Rotate a bounded six-passage window through the selected scope. A whole-book
-- session must not silently reuse only its first passages for every question.
CREATE FUNCTION public.retrieve_ai_practice_evidence(p_id uuid,p_position integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; validated jsonb; result jsonb;
BEGIN
 SELECT * INTO s FROM public.ai_practice_sessions WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='42501'; END IF;
 IF p_position IS NULL OR p_position NOT BETWEEN 1 AND s.target OR s.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid position' USING ERRCODE='PT409'; END IF;
 validated:=public.preview_ai_practice_sources(s.course_id,s.selection,s.units,s.query);
 WITH selected AS (
  SELECT (v->>'sourceId')::uuid id,ARRAY(SELECT value::int FROM jsonb_array_elements_text(v->'pages')) pages FROM jsonb_array_elements(s.selection) v
 ), matches AS (
  SELECT c.id,c.source_id,c.revision,src.title,c.page,c.unit_id,c.text,c.ordinal,
   CASE r.role WHEN 'primary' THEN 0 WHEN 'reference' THEN 1 ELSE CASE src.kind WHEN 'pdf' THEN 2 ELSE 3 END END priority,
   ts_rank_cd(c.normalized_search,public.ai_tutor_search_query(s.query)) score
  FROM selected x JOIN public.ai_tutor_sources src ON src.id=x.id JOIN public.ai_tutor_chunks c ON c.source_id=src.id AND c.revision=src.revision
  LEFT JOIN public.ai_practice_references r ON r.id=src.id
  WHERE src.course_id=s.course_id AND src.status='ready' AND (cardinality(x.pages)=0 OR c.page=ANY(x.pages))
   AND (cardinality(s.units)=0 OR c.unit_id=ANY(s.units)) AND (btrim(s.query)='' OR c.normalized_search @@ public.ai_tutor_search_query(s.query))
 ), ranked AS (SELECT *,row_number() OVER(PARTITION BY source_id ORDER BY score DESC,ordinal,id) n FROM matches),
 ordered AS (SELECT *,row_number() OVER(ORDER BY n,priority,score DESC,source_id,ordinal) slot FROM ranked),
 windowed AS (SELECT * FROM ordered ORDER BY slot LIMIT 6 OFFSET (SELECT ((p_position-1)*6)%greatest(count(*),1) FROM ordered))
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'source_id',source_id,'revision',revision,'title',title,'page',page,'unit_id',unit_id,'text',text) ORDER BY slot),'[]'::jsonb) INTO result FROM windowed;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.retrieve_ai_practice_evidence(uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.retrieve_ai_practice_evidence(uuid,integer) TO authenticated;

-- Only the trusted Edge worker may persist a model proposal. Browser cannot call
-- these actor-parameter RPCs. The worker uses a getUser()-verified actor, never body identity.
CREATE FUNCTION public.ai_practice_generation_context(p_actor uuid,p_id uuid,p_position integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; n integer;
BEGIN
 s:=practice_private.owned(p_id,p_actor);
 SELECT count(*) INTO n FROM practice_private.questions WHERE session_id=p_id;
 IF p_position IS NULL OR p_position<1 OR p_position>s.target OR p_position>n+1 THEN RAISE EXCEPTION 'Invalid generation position' USING ERRCODE='PT409'; END IF;
 IF p_position<=n THEN RETURN jsonb_build_object('exists',true,'courseId',s.course_id); END IF;
 IF s.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Session submitted' USING ERRCODE='PT409'; END IF;
 RETURN jsonb_build_object('exists',false,'courseId',s.course_id,'selection',s.selection,'units',s.units,'query',s.query,'language',s.language,'difficulty',s.difficulty,
  'previous',coalesce((SELECT jsonb_agg(prompt) FROM (SELECT left(q.prompt,600) AS prompt FROM practice_private.questions q JOIN public.ai_practice_sessions old ON old.id=q.session_id
   WHERE old.user_id=p_actor AND old.course_id=s.course_id AND (NOT s.allow_repeats OR old.id=p_id)
   ORDER BY old.created_at DESC,q.position DESC LIMIT 20) recent),'[]'::jsonb));
END $$;
CREATE FUNCTION public.publish_ai_practice_question(p_actor uuid,p_id uuid,p_position integer,p_question jsonb,p_evidence_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; evidence jsonb; n integer; fp text;
BEGIN
 s:=practice_private.owned(p_id,p_actor);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||s.course_id::text,49));
 SELECT count(*) INTO n FROM practice_private.questions WHERE session_id=p_id;
 IF p_position BETWEEN 1 AND n THEN RETURN; END IF; -- lost acknowledgement / concurrent same-position request
 IF s.submitted_at IS NOT NULL OR p_position IS NULL OR p_position<>n+1 OR p_position>s.target THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='PT409'; END IF;
 IF p_question IS NULL OR jsonb_typeof(p_question)<>'object' OR NOT(p_question ?& ARRAY['prompt','options','correct','explanation'])
 OR (p_question-ARRAY['prompt','options','correct','explanation'])<>'{}'::jsonb
 OR jsonb_typeof(p_question->'prompt') IS DISTINCT FROM 'string' OR length(btrim(p_question->>'prompt')) NOT BETWEEN 1 AND 3000
 OR jsonb_typeof(p_question->'explanation') IS DISTINCT FROM 'string' OR length(btrim(p_question->>'explanation')) NOT BETWEEN 1 AND 6000
 OR jsonb_typeof(p_question->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(p_question->'options')<>4
 OR jsonb_typeof(p_question->'correct') IS DISTINCT FROM 'number' OR (p_question->>'correct') !~ '^[0-3]$'
 OR p_evidence_ids IS NULL OR cardinality(p_evidence_ids) NOT BETWEEN 1 AND 6 OR array_position(p_evidence_ids,NULL) IS NOT NULL
 THEN RAISE EXCEPTION 'Invalid question proposal' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_question->'options') opt WHERE jsonb_typeof(opt)<>'string' OR length(btrim(opt #>> '{}')) NOT BETWEEN 1 AND 1000)
 OR (SELECT count(DISTINCT lower(btrim(value))) FROM jsonb_array_elements_text(p_question->'options'))<>4
 THEN RAISE EXCEPTION 'Invalid choices' USING ERRCODE='22023'; END IF;
 -- Reconstruct citations from actual scope; never persist model-supplied source text/title/page.
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'source_id',c.source_id,'revision',c.revision,'title',src.title,'page',c.page,'unit_id',c.unit_id,'text',c.text)),'[]'::jsonb)
 INTO evidence FROM public.ai_tutor_chunks c JOIN public.ai_tutor_sources src ON src.id=c.source_id
 WHERE c.id=ANY(p_evidence_ids) AND src.course_id=s.course_id AND src.revision=c.revision AND src.status='ready'
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.selection) pick WHERE (pick->>'sourceId')::uuid=c.source_id AND (pick->>'revision')::uuid=c.revision
  AND (jsonb_array_length(pick->'pages')=0 OR pick->'pages' @> to_jsonb(ARRAY[c.page])))
 AND (cardinality(s.units)=0 OR c.unit_id=ANY(s.units))
 AND (btrim(s.query)='' OR c.normalized_search @@ public.ai_tutor_search_query(s.query));
 IF jsonb_array_length(evidence)<>(SELECT count(DISTINCT x) FROM unnest(p_evidence_ids) x) THEN RAISE EXCEPTION 'Evidence changed or outside scope' USING ERRCODE='PT409'; END IF;
 fp:=lower(regexp_replace(btrim(p_question->>'prompt'),'[[:space:]]+',' ','g'));
 IF EXISTS(SELECT 1 FROM practice_private.questions q JOIN public.ai_practice_sessions prior ON prior.id=q.session_id
  WHERE prior.user_id=p_actor AND prior.course_id=s.course_id AND q.fingerprint=fp AND (NOT s.allow_repeats OR prior.id=p_id))
 THEN RAISE EXCEPTION 'Repeated question; retry generation' USING ERRCODE='PT409'; END IF;
 INSERT INTO practice_private.questions(session_id,position,prompt,options,correct,explanation,evidence,fingerprint)
 VALUES(p_id,p_position,p_question->>'prompt',p_question->'options',(p_question->>'correct')::int,p_question->>'explanation',evidence,fp);
 UPDATE public.ai_practice_sessions SET revision=revision+1,updated_at=clock_timestamp() WHERE id=p_id;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA practice_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.create_ai_practice_session(uuid,uuid,jsonb,uuid[],text,text,text,text,integer,boolean),public.read_ai_practice_session(uuid),public.list_ai_practice_sessions(uuid,integer),public.save_ai_practice_answer(uuid,integer,bigint,integer,boolean),public.submit_ai_practice_session(uuid,bigint) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.create_ai_practice_session(uuid,uuid,jsonb,uuid[],text,text,text,text,integer,boolean),public.read_ai_practice_session(uuid),public.list_ai_practice_sessions(uuid,integer),public.save_ai_practice_answer(uuid,integer,bigint,integer,boolean),public.submit_ai_practice_session(uuid,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.ai_practice_generation_context(uuid,uuid,integer),public.publish_ai_practice_question(uuid,uuid,integer,jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_practice_generation_context(uuid,uuid,integer),public.publish_ai_practice_question(uuid,uuid,integer,jsonb,uuid[]) TO service_role;
COMMIT;
