-- Approved decisions 15/20/40: trusted reference classification and source scope.
-- Reuses the Tutor index. This migration does not generate questions or grades.
BEGIN;
CREATE TABLE public.ai_practice_references (
 id uuid PRIMARY KEY REFERENCES public.ai_tutor_sources(id) ON DELETE CASCADE,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('primary','reference','lecture')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE UNIQUE INDEX practice_one_primary ON public.ai_practice_references(course_id) WHERE role='primary';
CREATE INDEX practice_references_course ON public.ai_practice_references(course_id);
ALTER TABLE public.ai_practice_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_practice_references FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_practice_references FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ai_practice_references TO authenticated;
CREATE POLICY practice_reference_read ON public.ai_practice_references FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.ai_tutor_sources s WHERE s.id=ai_practice_references.id AND s.course_id=ai_practice_references.course_id));
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.ai_practice_references
 FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,course_id,role,revision','id,course_id,role,revision','ordinary');

CREATE FUNCTION public.set_ai_practice_reference(p_source uuid,p_source_revision uuid,p_expected_revision bigint,p_role text,p_expected_primary uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_course uuid; v_source public.ai_tutor_sources; v_old public.ai_practice_references; v_primary uuid; v_revision bigint;
BEGIN
 IF p_role IS NULL OR p_role NOT IN ('primary','reference','lecture') OR p_expected_revision IS NULL OR p_expected_revision<0 OR p_source_revision IS NULL
 THEN RAISE EXCEPTION 'Invalid reference' USING ERRCODE='22023'; END IF;
 SELECT course_id INTO v_course FROM public.ai_tutor_sources WHERE id=p_source;
 PERFORM public.lock_managed_syllabus(v_course); -- current role and assigned owner, serialized section mutation
 SELECT * INTO v_source FROM public.ai_tutor_sources WHERE id=p_source FOR SHARE;
 IF NOT FOUND OR v_source.course_id IS DISTINCT FROM v_course OR v_source.kind<>'pdf' THEN RAISE EXCEPTION 'Reference unavailable' USING ERRCODE='42501'; END IF;
 IF v_source.revision IS DISTINCT FROM p_source_revision THEN RAISE EXCEPTION 'Source changed; reload' USING ERRCODE='PT409'; END IF;
 SELECT * INTO v_old FROM public.ai_practice_references WHERE id=p_source FOR UPDATE;
 IF FOUND AND v_old.role=p_role THEN RETURN v_old.revision; END IF;
 IF p_expected_revision<>coalesce(v_old.revision,0) THEN RAISE EXCEPTION 'Reference changed; reload' USING ERRCODE='PT409'; END IF;
 SELECT id INTO v_primary FROM public.ai_practice_references WHERE course_id=v_course AND role='primary';
 IF p_role='primary' THEN
  IF v_primary IS DISTINCT FROM p_expected_primary THEN RAISE EXCEPTION 'Primary book changed; reload' USING ERRCODE='PT409'; END IF;
  UPDATE public.ai_practice_references SET role='reference',revision=revision+1 WHERE id=v_primary;
 END IF;
 INSERT INTO public.ai_practice_references(id,course_id,role) VALUES(p_source,v_course,p_role)
 ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,revision=ai_practice_references.revision+1 RETURNING revision INTO v_revision;
 RETURN v_revision;
END $$;

CREATE FUNCTION public.get_ai_practice_sources(p_course uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_sources jsonb; v_units jsonb;
BEGIN
 IF NOT public.ai_tutor_access(p_course) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'revision',s.revision,'title',s.title,'kind',s.kind,'status',s.status,
  'role',CASE WHEN s.kind='syllabus' THEN 'syllabus' ELSE coalesce(r.role,'lecture') END,'policyRevision',coalesce(r.revision,0),
  'pages',coalesce((SELECT jsonb_agg(page ORDER BY page) FROM (SELECT DISTINCT c.page FROM public.ai_tutor_chunks c WHERE c.source_id=s.id AND c.revision=s.revision AND c.page IS NOT NULL) pages),'[]'::jsonb))
  ORDER BY CASE r.role WHEN 'primary' THEN 0 WHEN 'reference' THEN 1 ELSE 2 END,s.title,s.id),'[]'::jsonb) INTO v_sources
 FROM (SELECT * FROM public.ai_tutor_sources WHERE course_id=p_course ORDER BY title,id LIMIT 100) s LEFT JOIN public.ai_practice_references r ON r.id=s.id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'title',u.title) ORDER BY u.sort_order,u.id),'[]'::jsonb) INTO v_units
 FROM public.syllabus_units u WHERE u.course_id=p_course AND EXISTS(SELECT 1 FROM public.ai_tutor_chunks c JOIN public.ai_tutor_sources s ON s.id=c.source_id WHERE c.unit_id=u.id AND s.course_id=p_course);
 RETURN jsonb_build_object('courseId',p_course,'canManage',public.ai_tutor_access(p_course,true),'sources',v_sources,'units',v_units,
  'primaryId',(SELECT id FROM public.ai_practice_references WHERE course_id=p_course AND role='primary'),
  'limited',(SELECT count(*)>100 FROM public.ai_tutor_sources WHERE course_id=p_course));
END $$;

CREATE FUNCTION public.preview_ai_practice_sources(p_course uuid,p_selection jsonb,p_units uuid[] DEFAULT '{}',p_query text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE pick jsonb; v_source public.ai_tutor_sources; v_pages integer[]; v_seen uuid[]:='{}'; v_result jsonb;
BEGIN
 IF NOT public.ai_tutor_access(p_course) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 IF p_selection IS NULL OR jsonb_typeof(p_selection)<>'array' OR octet_length(p_selection::text)>30000
 OR jsonb_array_length(p_selection) NOT BETWEEN 1 AND 10 OR p_units IS NULL OR cardinality(p_units)>100 OR array_position(p_units,NULL) IS NOT NULL
 OR p_query IS NULL OR length(p_query)>1500 THEN RAISE EXCEPTION 'Invalid source scope' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_units) requested(unit_id) WHERE NOT EXISTS(SELECT 1 FROM public.syllabus_units u WHERE u.id=requested.unit_id AND u.course_id=p_course))
 THEN RAISE EXCEPTION 'Unit unavailable' USING ERRCODE='42501'; END IF;
 FOR pick IN SELECT value FROM jsonb_array_elements(p_selection) LOOP
  IF jsonb_typeof(pick)<>'object' OR NOT (pick ?& ARRAY['sourceId','revision','pages']) OR (pick-ARRAY['sourceId','revision','pages'])<>'{}'::jsonb
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
REVOKE ALL ON FUNCTION public.set_ai_practice_reference(uuid,uuid,bigint,text,uuid),public.get_ai_practice_sources(uuid),public.preview_ai_practice_sources(uuid,jsonb,uuid[],text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.set_ai_practice_reference(uuid,uuid,bigint,text,uuid),public.get_ai_practice_sources(uuid),public.preview_ai_practice_sources(uuid,jsonb,uuid[],text) TO authenticated;
COMMIT;
