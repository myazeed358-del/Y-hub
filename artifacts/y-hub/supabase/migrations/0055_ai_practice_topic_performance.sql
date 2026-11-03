-- Approved42: current private performance by trusted chapter/topic, not inferred labels.
BEGIN;
-- One eligibility/score rule for existing unit summaries and new topic summaries.
CREATE FUNCTION practice_private.performance_answers(p_actor uuid,p_course uuid)
RETURNS TABLE(mode text,evidence jsonb,score integer,excluded boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT s.mode,q.evidence,
 CASE WHEN r.state='resolved' AND d.resolved_choice IS NOT NULL THEN (q.choice=d.resolved_choice)::int
  WHEN r.id IS NULL AND q.math_verification IS NOT NULL THEN (q.choice=q.correct)::int END,
 coalesce(r.state='resolved' AND d.resolved_choice IS NULL,false)
 FROM public.ai_practice_sessions s JOIN practice_private.questions q ON q.session_id=s.id
 LEFT JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position
 LEFT JOIN practice_private.review_details d ON d.review_id=r.id
 WHERE s.user_id=p_actor AND s.course_id=p_course AND q.choice IS NOT NULL
 AND (s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL))
 -- Match session reads: invalidated/deleted/unreadable source scopes cannot expose
 -- their protected history through an aggregate RPC either.
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.selection) pick WHERE NOT practice_private.outline_matches(pick,p_course) OR NOT EXISTS(
  SELECT 1 FROM public.ai_tutor_sources src WHERE src.id=(pick->>'sourceId')::uuid AND src.course_id=p_course
   AND src.revision=(pick->>'revision')::uuid AND src.status='ready'));
$$;
REVOKE ALL ON FUNCTION practice_private.performance_answers(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION practice_private.performance_rows(p_actor uuid,p_course uuid)
RETURNS TABLE(mode text,unit_id uuid,score integer,excluded boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT f.mode,u.id,f.score,f.excluded FROM practice_private.performance_answers(p_actor,p_course) f
 LEFT JOIN LATERAL (
  SELECT CASE WHEN count(*)>0 AND count(*)=count(e->>'unit_id') AND count(DISTINCT e->>'unit_id')=1
   THEN min(e->>'unit_id')::uuid END id FROM jsonb_array_elements(f.evidence) e
 ) attributed ON true
 LEFT JOIN public.syllabus_units u ON u.id=attributed.id AND u.course_id=p_course;
$$;

-- Every citation must identify exactly the same single entry in this dimension.
-- A topic and its parent count once in each independent view, never twice in totals.
CREATE FUNCTION practice_private.performance_attribution(p_evidence jsonb,p_kind text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH candidates AS (
  SELECT e,CASE WHEN jsonb_array_length(parts)=1 THEN parts->0 END part
  FROM jsonb_array_elements(p_evidence) e CROSS JOIN LATERAL (
   SELECT coalesce(jsonb_agg(p),'[]'::jsonb) parts FROM jsonb_array_elements(coalesce(e->'outline','[]'::jsonb)) p WHERE p->>'kind'=p_kind
  ) chosen
 ), checked AS (
  SELECT CASE WHEN section.value IS NOT NULL THEN jsonb_build_object(
   'sourceId',src.id,'sourceRevision',src.revision,'outlineRevision',o.revision,
   'sectionId',(section.value->>'id')::uuid,'title',section.value->>'title','sourceTitle',src.title) END attribution
  FROM candidates c
  LEFT JOIN public.ai_tutor_sources src ON src.id=(e->>'source_id')::uuid AND src.revision=(e->>'revision')::uuid
  LEFT JOIN public.ai_practice_outlines o ON o.id=src.id AND o.source_revision=src.revision
  LEFT JOIN LATERAL (
   SELECT value FROM jsonb_array_elements(o.sections) WHERE value->>'id'=c.part->>'id' AND value->>'kind'=p_kind
  ) section ON true
 ) SELECT CASE WHEN count(*)>0 AND count(*)=count(attribution) AND count(DISTINCT attribution)=1
  THEN jsonb_agg(attribution)->0 END FROM checked;
$$;
REVOKE ALL ON FUNCTION practice_private.performance_attribution(jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.read_ai_practice_topic_performance(p_course uuid,p_kind text,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE config public.ai_practice_performance_weights; rows jsonb; result jsonb; total integer;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('chapter','topic') OR p_offset IS NULL OR p_offset<0 OR p_offset>10000
 THEN RAISE EXCEPTION 'Invalid performance scope' USING ERRCODE='22023'; END IF;
 IF NOT public.ai_tutor_access(p_course) THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO config FROM public.ai_practice_performance_weights WHERE course_id=p_course;
 IF NOT FOUND THEN config.practice_weight:=50;config.exam_weight:=50;config.revision:=0; END IF;
 -- Aggregate counts in SQL, not raw answers in the response. No actor/score/evidence from client.
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO rows FROM (
  SELECT practice_private.performance_attribution(evidence,p_kind) attribution,mode,
   coalesce(sum(score),0) earned,count(score) graded,count(*) FILTER(WHERE score IS NULL AND NOT excluded) pending,
   count(*) FILTER(WHERE excluded) excluded
  FROM practice_private.performance_answers(auth.uid(),p_course) GROUP BY attribution,mode
 ) r;
 SELECT count(DISTINCT r->'attribution') INTO total FROM jsonb_array_elements(rows) r;
 SELECT coalesce(jsonb_agg(jsonb_build_object('attribution',g.attribution,
  'summary',practice_private.performance_summary(g.items,config.practice_weight,config.exam_weight)) ORDER BY g.attribution),'[]'::jsonb)
 INTO result FROM (
  SELECT r->'attribution' attribution,jsonb_agg(r) items FROM jsonb_array_elements(rows) r
  GROUP BY r->'attribution' ORDER BY r->'attribution' OFFSET p_offset LIMIT 20
 ) g;
 RETURN jsonb_build_object('courseId',p_course,'kind',p_kind,'groups',result,'groupCount',total,
  'offset',p_offset,'hasMore',p_offset+20<total,
  'weights',jsonb_build_object('practice',config.practice_weight,'exam',config.exam_weight,'revision',config.revision));
END $$;
REVOKE ALL ON FUNCTION public.read_ai_practice_topic_performance(uuid,text,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.read_ai_practice_topic_performance(uuid,text,integer) TO authenticated;
COMMIT;
