-- Approved20/22: instructor-authored PDF chapters/topics bound to indexed physical pages.
BEGIN;
CREATE TABLE public.ai_practice_outlines (
 id uuid PRIMARY KEY REFERENCES public.ai_tutor_sources ON DELETE CASCADE,
 course_id uuid NOT NULL REFERENCES public.courses ON DELETE CASCADE,
 source_revision uuid NOT NULL,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 sections jsonb NOT NULL CHECK(jsonb_typeof(sections)='array' AND jsonb_array_length(sections)<=50)
);
ALTER TABLE public.ai_practice_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_practice_outlines FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_practice_outlines FROM PUBLIC,anon,authenticated,service_role;
-- Expose only a checked RPC: obsolete outlines must not bypass source invalidation.
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.ai_practice_outlines
 FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,course_id,source_revision,revision,sections','id,course_id,source_revision,revision','ordinary');

CREATE FUNCTION public.set_ai_practice_outline(p_source uuid,p_source_revision uuid,p_revision bigint,p_sections jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c uuid; src public.ai_tutor_sources; old public.ai_practice_outlines; item jsonb; parent jsonb;
 ids uuid[]:='{}'; pages integer[]; result bigint; normalized jsonb:='[]';
BEGIN
 IF p_revision IS NULL OR p_revision<0 OR p_source_revision IS NULL OR p_sections IS NULL
 OR jsonb_typeof(p_sections)<>'array' OR jsonb_array_length(p_sections)>50 OR octet_length(p_sections::text)>120000
 THEN RAISE EXCEPTION 'Invalid outline' USING ERRCODE='22023'; END IF;
 SELECT course_id INTO c FROM public.ai_tutor_sources WHERE id=p_source;
 PERFORM public.lock_managed_syllabus(c);
 SELECT * INTO src FROM public.ai_tutor_sources WHERE id=p_source FOR SHARE;
 IF NOT FOUND OR src.course_id IS DISTINCT FROM c OR src.kind<>'pdf' THEN RAISE EXCEPTION 'PDF unavailable' USING ERRCODE='42501'; END IF;
 IF src.revision<>p_source_revision OR src.status<>'ready' THEN RAISE EXCEPTION 'Index changed; reload' USING ERRCODE='PT409'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_sections) LOOP
  IF jsonb_typeof(item)<>'object' OR NOT(item ?& ARRAY['id','kind','title','parentId','pages']) OR item-ARRAY['id','kind','title','parentId','pages']<>'{}'::jsonb
  OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR coalesce(item->>'kind','') NOT IN ('chapter','topic')
  OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR length(btrim(item->>'title')) NOT BETWEEN 1 AND 160
  OR jsonb_typeof(item->'parentId') NOT IN ('string','null') OR jsonb_typeof(item->'pages') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'Invalid outline section' USING ERRCODE='22023'; END IF;
  IF (item->>'id')::uuid=ANY(ids) THEN RAISE EXCEPTION 'Duplicate section' USING ERRCODE='22023'; END IF;
  ids:=array_append(ids,(item->>'id')::uuid);
  IF jsonb_array_length(item->'pages') NOT BETWEEN 1 AND 300 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item->'pages') n WHERE jsonb_typeof(n)<>'number' OR n::text !~ '^[0-9]{1,3}$')
  THEN RAISE EXCEPTION 'Invalid physical pages' USING ERRCODE='22023'; END IF;
  SELECT array_agg(value::int) INTO pages FROM jsonb_array_elements_text(item->'pages');
  IF cardinality(pages)<>(SELECT count(DISTINCT n) FROM unnest(pages) n) OR EXISTS(SELECT 1 FROM unnest(pages) p WHERE p NOT BETWEEN 1 AND 300 OR NOT EXISTS(
   SELECT 1 FROM public.ai_tutor_chunks t WHERE t.source_id=p_source AND t.revision=p_source_revision AND t.page=p))
  THEN RAISE EXCEPTION 'Page is not indexed' USING ERRCODE='22023'; END IF;
  IF item->>'parentId' IS NOT NULL THEN
   SELECT value INTO parent FROM jsonb_array_elements(p_sections) WHERE (value->>'id')::uuid=(item->>'parentId')::uuid;
   IF item->>'kind'<>'topic' OR parent IS NULL OR parent->>'kind'<>'chapter' OR NOT((parent->'pages') @> (item->'pages'))
   THEN RAISE EXCEPTION 'Invalid chapter relationship' USING ERRCODE='22023'; END IF;
  END IF;
  normalized:=normalized||jsonb_build_array(jsonb_build_object('id',(item->>'id')::uuid,'kind',item->>'kind','title',btrim(item->>'title'),'parentId',(item->>'parentId')::uuid,
   'pages',(SELECT jsonb_agg(p ORDER BY p) FROM unnest(pages) p)));
 END LOOP;
 p_sections:=normalized;
 SELECT * INTO old FROM public.ai_practice_outlines WHERE id=p_source FOR UPDATE;
 IF FOUND AND (old.source_revision,old.sections) IS NOT DISTINCT FROM (p_source_revision,p_sections) THEN RETURN old.revision; END IF;
 IF p_revision<>coalesce(old.revision,0) THEN RAISE EXCEPTION 'Outline changed; reload' USING ERRCODE='PT409'; END IF;
 INSERT INTO public.ai_practice_outlines(id,course_id,source_revision,sections) VALUES(p_source,c,p_source_revision,p_sections)
 ON CONFLICT(id) DO UPDATE SET source_revision=EXCLUDED.source_revision,sections=EXCLUDED.sections,revision=ai_practice_outlines.revision+1
 RETURNING revision INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.get_ai_practice_outline(p_source uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE src public.ai_tutor_sources; outline public.ai_practice_outlines; current boolean;
BEGIN
 SELECT * INTO src FROM public.ai_tutor_sources WHERE id=p_source;
 IF NOT FOUND OR src.kind<>'pdf' OR NOT public.ai_tutor_access(src.course_id) THEN RAISE EXCEPTION 'PDF unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO outline FROM public.ai_practice_outlines WHERE id=p_source;
 current:=outline.source_revision=src.revision AND src.status='ready' AND NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(outline.sections) s CROSS JOIN LATERAL jsonb_array_elements_text(s->'pages') p
  WHERE NOT EXISTS(SELECT 1 FROM public.ai_tutor_chunks t WHERE t.source_id=src.id AND t.revision=src.revision AND t.page=p::integer));
 RETURN jsonb_build_object('sourceId',src.id,'sourceRevision',src.revision,'revision',coalesce(outline.revision,0),
  'canManage',public.ai_tutor_access(src.course_id,true),'stale',outline.id IS NOT NULL AND NOT current,
  'sections',CASE WHEN current THEN outline.sections ELSE '[]'::jsonb END);
END $$;

CREATE FUNCTION practice_private.outline_pages(p_source uuid,p_generation uuid,p_revision bigint,p_ids uuid[]) RETURNS integer[]
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN cardinality(p_ids) BETWEEN 1 AND 50 AND
  (SELECT count(*) FROM jsonb_array_elements(o.sections) s WHERE (s->>'id')::uuid=ANY(p_ids))=cardinality(p_ids)
 THEN ARRAY(SELECT DISTINCT p::integer FROM jsonb_array_elements(o.sections) s CROSS JOIN LATERAL jsonb_array_elements_text(s->'pages') p
  WHERE (s->>'id')::uuid=ANY(p_ids) ORDER BY p::integer) END
 FROM public.ai_practice_outlines o WHERE o.id=p_source AND o.source_revision=p_generation AND o.revision=p_revision AND NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(o.sections) s CROSS JOIN LATERAL jsonb_array_elements_text(s->'pages') p
  WHERE NOT EXISTS(SELECT 1 FROM public.ai_tutor_chunks t WHERE t.source_id=o.id AND t.revision=o.source_revision AND t.page=p::integer));
$$;
CREATE FUNCTION practice_private.outline_matches(pick jsonb,p_course uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN NOT(pick ? 'outline') THEN true ELSE coalesce(
  EXISTS(SELECT 1 FROM public.ai_practice_outlines WHERE id=(pick->>'sourceId')::uuid AND course_id=p_course)
  AND practice_private.outline_pages((pick->>'sourceId')::uuid,(pick->>'revision')::uuid,(pick->'outline'->>'revision')::bigint,
   ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(pick->'outline'->'ids')))
  = ARRAY(SELECT value::integer FROM jsonb_array_elements_text(pick->'pages')),false) END;
$$;
REVOKE ALL ON FUNCTION practice_private.outline_pages(uuid,uuid,bigint,uuid[]),practice_private.outline_matches(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Browser sends only IDs/versions; physical pages are reconstructed by the server.
CREATE FUNCTION public.resolve_ai_practice_selection(p_course uuid,p_selection jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE pick jsonb; selected uuid[]; pages integer[]; output jsonb:='[]'; src public.ai_tutor_sources;
BEGIN
 IF NOT public.ai_tutor_access(p_course) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 IF p_selection IS NULL OR jsonb_typeof(p_selection)<>'array' OR jsonb_array_length(p_selection) NOT BETWEEN 1 AND 10 OR octet_length(p_selection::text)>30000
 THEN RAISE EXCEPTION 'Invalid source selection' USING ERRCODE='22023'; END IF;
 FOR pick IN SELECT value FROM jsonb_array_elements(p_selection) LOOP
  IF jsonb_typeof(pick)<>'object' OR NOT(pick ?& ARRAY['sourceId','revision','pages']) OR pick-ARRAY['sourceId','revision','pages','outline']<>'{}'::jsonb
  THEN RAISE EXCEPTION 'Invalid source selection' USING ERRCODE='22023'; END IF;
  IF pick ? 'outline' THEN
   IF jsonb_typeof(pick->'outline') IS DISTINCT FROM 'object' OR NOT(pick->'outline' ?& ARRAY['revision','ids']) OR (pick->'outline')-ARRAY['revision','ids']<>'{}'::jsonb
   OR jsonb_typeof(pick->'outline'->'revision') IS DISTINCT FROM 'number' OR (pick->'outline'->>'revision') !~ '^[1-9][0-9]{0,14}$'
   OR jsonb_typeof(pick->'outline'->'ids') IS DISTINCT FROM 'array' OR jsonb_array_length(pick->'outline'->'ids') NOT BETWEEN 1 AND 50
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(pick->'outline'->'ids') i WHERE jsonb_typeof(i)<>'string')
   OR jsonb_typeof(pick->'pages') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'Invalid outline selection' USING ERRCODE='22023'; END IF;
   SELECT * INTO src FROM public.ai_tutor_sources WHERE id=(pick->>'sourceId')::uuid AND course_id=p_course AND kind='pdf';
   IF NOT FOUND THEN RAISE EXCEPTION 'PDF unavailable' USING ERRCODE='42501'; END IF;
   IF src.revision<>(pick->>'revision')::uuid OR src.status<>'ready' THEN RAISE EXCEPTION 'Index changed; reload' USING ERRCODE='PT409'; END IF;
   SELECT array_agg(value::uuid ORDER BY value::uuid) INTO selected FROM jsonb_array_elements_text(pick->'outline'->'ids');
   pages:=practice_private.outline_pages(src.id,src.revision,(pick->'outline'->>'revision')::bigint,selected);
   IF pages IS NULL THEN RAISE EXCEPTION 'Outline changed; reload' USING ERRCODE='PT409'; END IF;
   -- Empty is shorthand; supplied pages must match exactly, never broaden a chapter.
   IF pick->'pages'<>'[]'::jsonb AND pick->'pages'<>to_jsonb(pages) THEN RAISE EXCEPTION 'Pages disagree with outline' USING ERRCODE='22023'; END IF;
   pick:=jsonb_set(jsonb_set(pick,'{pages}',to_jsonb(pages)),'{outline,ids}',to_jsonb(selected));
  END IF;
  output:=output||jsonb_build_array(pick);
 END LOOP;
 RETURN output;
END $$;

-- Freeze teacher-authored names inside the same transaction as question publication.
CREATE FUNCTION practice_private.attach_outline_citations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE selection jsonb;
BEGIN
 SELECT s.selection INTO selection FROM public.ai_practice_sessions s WHERE s.id=NEW.session_id;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(selection) p WHERE p ? 'outline') THEN RETURN NEW; END IF;
 SELECT jsonb_agg(e||jsonb_build_object('outline',coalesce((
  SELECT jsonb_agg(jsonb_build_object('id',item->>'id','kind',item->>'kind','title',item->>'title') ORDER BY item->>'kind',item->>'id')
  FROM jsonb_array_elements(selection) pick JOIN public.ai_practice_outlines o ON o.id=(pick->>'sourceId')::uuid
  CROSS JOIN LATERAL jsonb_array_elements(o.sections) item
  WHERE o.id=(e->>'source_id')::uuid AND o.source_revision=(e->>'revision')::uuid AND o.revision=(pick->'outline'->>'revision')::bigint
   AND item->'pages' @> jsonb_build_array((e->>'page')::int)
   AND ((pick->'outline'->'ids') ? (item->>'id') OR EXISTS(SELECT 1 FROM jsonb_array_elements(o.sections) topic
    WHERE pick->'outline'->'ids' ? (topic->>'id') AND topic->>'parentId'=item->>'id' AND topic->'pages' @> jsonb_build_array((e->>'page')::int)))
 ),'[]'::jsonb)) ORDER BY n) INTO NEW.evidence FROM jsonb_array_elements(NEW.evidence) WITH ORDINALITY a(e,n);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION practice_private.attach_outline_citations() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER attach_outline_citations BEFORE INSERT ON practice_private.questions FOR EACH ROW EXECUTE FUNCTION practice_private.attach_outline_citations();
REVOKE ALL ON FUNCTION public.get_ai_practice_outline(uuid),public.set_ai_practice_outline(uuid,uuid,bigint,jsonb),public.resolve_ai_practice_selection(uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_practice_outline(uuid),public.set_ai_practice_outline(uuid,uuid,bigint,jsonb),public.resolve_ai_practice_selection(uuid,jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.preview_ai_practice_sources(p_course uuid,p_selection jsonb,p_units uuid[] DEFAULT '{}',p_query text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE pick jsonb; v_source public.ai_tutor_sources; v_pages integer[]; v_seen uuid[]:='{}'; v_result jsonb;
BEGIN
 p_selection:=public.resolve_ai_practice_selection(p_course,p_selection);
 IF NOT public.ai_tutor_access(p_course) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 IF p_selection IS NULL OR jsonb_typeof(p_selection)<>'array' OR octet_length(p_selection::text)>30000
 OR jsonb_array_length(p_selection) NOT BETWEEN 1 AND 10 OR p_units IS NULL OR cardinality(p_units)>100 OR array_position(p_units,NULL) IS NOT NULL
 OR p_query IS NULL OR length(p_query)>1500 THEN RAISE EXCEPTION 'Invalid source scope' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_units) requested(unit_id) WHERE NOT EXISTS(SELECT 1 FROM public.syllabus_units u WHERE u.id=requested.unit_id AND u.course_id=p_course))
 THEN RAISE EXCEPTION 'Unit unavailable' USING ERRCODE='42501'; END IF;
 FOR pick IN SELECT value FROM jsonb_array_elements(p_selection) LOOP
  IF jsonb_typeof(pick)<>'object' OR NOT (pick ?& ARRAY['sourceId','revision','pages']) OR (pick-ARRAY['sourceId','revision','pages','outline'])<>'{}'::jsonb
  OR jsonb_typeof(pick->'sourceId') IS DISTINCT FROM 'string' OR jsonb_typeof(pick->'revision') IS DISTINCT FROM 'string'
  OR jsonb_typeof(pick->'pages') IS DISTINCT FROM 'array' OR jsonb_array_length(pick->'pages')>300
  THEN RAISE EXCEPTION 'Invalid source selection' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_source FROM public.ai_tutor_sources WHERE id=(pick->>'sourceId')::uuid AND course_id=p_course;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source unavailable' USING ERRCODE='42501'; END IF;
  IF v_source.id=ANY(v_seen) THEN RAISE EXCEPTION 'Duplicate source' USING ERRCODE='22023'; END IF;
  v_seen:=array_append(v_seen,v_source.id);
  IF v_source.revision IS DISTINCT FROM (pick->>'revision')::uuid OR v_source.status<>'ready' THEN RAISE EXCEPTION 'Index changed or unavailable; reload' USING ERRCODE='PT409'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(pick->'pages') v WHERE jsonb_typeof(v)<>'number' OR v::text !~ '^[0-9]{1,3}$')
  THEN RAISE EXCEPTION 'Invalid pages' USING ERRCODE='22023'; END IF;
  SELECT coalesce(array_agg(value::int),'{}'::int[]) INTO v_pages FROM jsonb_array_elements_text(pick->'pages');
  IF EXISTS(SELECT 1 FROM unnest(v_pages) requested(page_number) WHERE requested.page_number NOT BETWEEN 1 AND 300 OR NOT EXISTS(
   SELECT 1 FROM public.ai_tutor_chunks c WHERE c.source_id=v_source.id AND c.revision=v_source.revision AND c.page=requested.page_number))
  THEN RAISE EXCEPTION 'Page has no verified indexed text' USING ERRCODE='22023'; END IF;
 END LOOP;
 WITH selection AS (
  SELECT (v->>'sourceId')::uuid id,ARRAY(SELECT value::int FROM jsonb_array_elements_text(v->'pages')) pages FROM jsonb_array_elements(p_selection) v
 ), matches AS (
  SELECT c.id,c.source_id,c.revision,s.title,c.page,c.unit_id,c.text,c.ordinal,
   CASE r.role WHEN 'primary' THEN 0 WHEN 'reference' THEN 1 ELSE CASE s.kind WHEN 'pdf' THEN 2 ELSE 3 END END priority,
   ts_rank_cd(c.normalized_search,public.ai_tutor_search_query(p_query)) score
  FROM selection x JOIN public.ai_tutor_sources s ON s.id=x.id JOIN public.ai_tutor_chunks c ON c.source_id=s.id AND c.revision=s.revision
  LEFT JOIN public.ai_practice_references r ON r.id=s.id
  WHERE s.course_id=p_course AND s.status='ready' AND (cardinality(x.pages)=0 OR c.page=ANY(x.pages))
  AND (cardinality(p_units)=0 OR c.unit_id=ANY(p_units))
  AND (btrim(p_query)='' OR c.normalized_search @@ public.ai_tutor_search_query(p_query))
 ), ranked AS (SELECT *,row_number() OVER(PARTITION BY source_id ORDER BY score DESC,ordinal,id) n FROM matches),
 bounded AS (SELECT * FROM ranked ORDER BY n,priority,score DESC,source_id,ordinal LIMIT 6)
 SELECT jsonb_build_object('evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'source_id',source_id,'revision',revision,'title',title,'page',page,'unit_id',unit_id,'text',text,'score',score) ORDER BY n,priority,score DESC,source_id,ordinal) FROM bounded),'[]'::jsonb),
 'hasMore',(SELECT count(*)>6 FROM matches)) INTO v_result;
 RETURN v_result;
END $$;

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
 p_selection:=public.resolve_ai_practice_selection(p_course,p_selection);
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

CREATE OR REPLACE FUNCTION practice_private.current_scope(s public.ai_practice_sessions) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(s.selection) LOOP
  PERFORM 1 FROM public.ai_tutor_sources src WHERE src.id=(item->>'sourceId')::uuid AND src.course_id=s.course_id
   AND src.revision=(item->>'revision')::uuid AND src.status='ready' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sources changed; create a new session' USING ERRCODE='PT409'; END IF;
  IF item ? 'outline' THEN
   PERFORM 1 FROM public.ai_practice_outlines WHERE id=(item->>'sourceId')::uuid FOR SHARE;
   IF NOT practice_private.outline_matches(item,s.course_id) THEN RAISE EXCEPTION 'Outline changed; create a new session' USING ERRCODE='PT409'; END IF;
  END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION practice_private.scope_identity(p_selection jsonb,p_units uuid[],p_query text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object(
  'sources',(SELECT jsonb_agg(jsonb_build_object('sourceId',(x->>'sourceId')::uuid,'revision',(x->>'revision')::uuid,
   'pages',(SELECT coalesce(jsonb_agg(n ORDER BY n),'[]'::jsonb) FROM (SELECT DISTINCT value::integer n FROM jsonb_array_elements_text(x->'pages')) pages)) || CASE WHEN x ? 'outline' THEN jsonb_build_object('outline',x->'outline') ELSE '{}'::jsonb END ORDER BY (x->>'sourceId')::uuid) FROM jsonb_array_elements(p_selection) x),
  'units',(SELECT coalesce(jsonb_agg(id ORDER BY id),'[]'::jsonb) FROM (SELECT DISTINCT unnest(p_units) id) u),
  'query',lower(regexp_replace(btrim(p_query),'[[:space:]]+',' ','g'))
 )::text,'UTF8')),'hex');
$$;

CREATE OR REPLACE FUNCTION practice_private.performance_rows(p_actor uuid,p_course uuid)
RETURNS TABLE(mode text,unit_id uuid,score integer,excluded boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT s.mode,u.id,
 CASE WHEN r.state='resolved' AND d.resolved_choice IS NOT NULL THEN (q.choice=d.resolved_choice)::int
  WHEN r.id IS NULL AND q.math_verification IS NOT NULL THEN (q.choice=q.correct)::int END,
 coalesce(r.state='resolved' AND d.resolved_choice IS NULL,false)
 FROM public.ai_practice_sessions s JOIN practice_private.questions q ON q.session_id=s.id
 LEFT JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position
 LEFT JOIN practice_private.review_details d ON d.review_id=r.id
 LEFT JOIN LATERAL (
  SELECT CASE WHEN count(*)>0 AND count(*)=count(e->>'unit_id') AND count(DISTINCT e->>'unit_id')=1
   THEN min(e->>'unit_id')::uuid END id FROM jsonb_array_elements(q.evidence) e
 ) attributed ON true
 LEFT JOIN public.syllabus_units u ON u.id=attributed.id AND u.course_id=s.course_id
 WHERE s.user_id=p_actor AND s.course_id=p_course AND q.choice IS NOT NULL
 AND (s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL))
 -- Match session reads: invalidated/deleted/unreadable source scopes cannot expose
 -- their protected history through an aggregate RPC either.
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.selection) pick WHERE NOT practice_private.outline_matches(pick,p_course) OR NOT EXISTS(
  SELECT 1 FROM public.ai_tutor_sources src WHERE src.id=(pick->>'sourceId')::uuid AND src.course_id=p_course
   AND src.revision=(pick->>'revision')::uuid AND src.status='ready'));
$$;

CREATE OR REPLACE FUNCTION public.read_ai_practice_performance(p_course uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE config public.ai_practice_performance_weights; rows jsonb; units jsonb; total integer; unavailable integer;
BEGIN
 IF p_offset IS NULL OR p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 IF NOT public.ai_tutor_access(p_course) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO config FROM public.ai_practice_performance_weights WHERE course_id=p_course;
 IF NOT FOUND THEN config.practice_weight:=50;config.exam_weight:=50;config.revision:=0; END IF;
 -- One SQL snapshot per RPC. No score cache survives a review or revocation.
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO rows FROM (
  SELECT mode,unit_id,coalesce(sum(score),0) earned,count(score) graded,
   count(*) FILTER(WHERE score IS NULL AND NOT excluded) pending,count(*) FILTER(WHERE excluded) excluded
  FROM practice_private.performance_rows(auth.uid(),p_course) GROUP BY mode,unit_id
 ) r;
 SELECT count(*) INTO total FROM (SELECT DISTINCT r->>'unit_id' id FROM jsonb_array_elements(rows) r) groups;
 SELECT coalesce(jsonb_agg(jsonb_build_object('unitId',g.id,'title',u.title,
  'summary',practice_private.performance_summary(g.items,config.practice_weight,config.exam_weight)) ORDER BY u.sort_order NULLS LAST,g.id NULLS LAST),'[]'::jsonb)
 INTO units FROM (
  SELECT (r->>'unit_id')::uuid id,jsonb_agg(r) items FROM jsonb_array_elements(rows) r GROUP BY r->>'unit_id'
 ) g LEFT JOIN public.syllabus_units u ON u.id=g.id AND u.course_id=p_course;
 -- Limit response size without truncating the overall weighted totals.
 SELECT coalesce(jsonb_agg(item ORDER BY n),'[]'::jsonb) INTO units FROM jsonb_array_elements(units) WITH ORDINALITY a(item,n) WHERE n>p_offset AND n<=p_offset+20;
 SELECT count(*) INTO unavailable FROM public.ai_practice_sessions s WHERE s.user_id=auth.uid() AND s.course_id=p_course
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.selection) pick WHERE NOT practice_private.outline_matches(pick,p_course) OR NOT EXISTS(SELECT 1 FROM public.ai_tutor_sources src
  WHERE src.id=(pick->>'sourceId')::uuid AND src.course_id=p_course AND src.revision=(pick->>'revision')::uuid AND src.status='ready'));
 RETURN jsonb_build_object('courseId',p_course,'canManage',public.ai_tutor_access(p_course,true),
  'weights',jsonb_build_object('practice',config.practice_weight,'exam',config.exam_weight,'revision',config.revision),
  'summary',practice_private.performance_summary(rows,config.practice_weight,config.exam_weight),'units',units,'unitCount',total,
  'offset',p_offset,'hasMore',p_offset+20<total,'unavailableSessions',unavailable);
END $$;

COMMIT;
