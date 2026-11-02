-- Approved42: private learner performance, separate from completion/official grades.
BEGIN;
CREATE TABLE public.ai_practice_performance_weights (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 course_id uuid NOT NULL UNIQUE REFERENCES public.courses ON DELETE CASCADE,
 practice_weight integer NOT NULL CHECK(practice_weight BETWEEN 0 AND 100),
 exam_weight integer NOT NULL CHECK(exam_weight BETWEEN 0 AND 100),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 CHECK(practice_weight+exam_weight=100)
);
ALTER TABLE public.ai_practice_performance_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_practice_performance_weights FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_practice_performance_weights FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ai_practice_performance_weights TO authenticated;
CREATE POLICY practice_weights_read ON public.ai_practice_performance_weights FOR SELECT TO authenticated
 USING(public.ai_tutor_access(course_id));
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.ai_practice_performance_weights
 FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,course_id,practice_weight,exam_weight,revision','id,course_id,practice_weight,exam_weight,revision','ordinary');

CREATE FUNCTION public.set_ai_practice_performance_weights(p_course uuid,p_revision bigint,p_practice integer,p_exam integer)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.ai_practice_performance_weights; result bigint;
BEGIN
 IF p_revision IS NULL OR p_revision<0 OR p_practice IS NULL OR p_exam IS NULL
 OR p_practice NOT BETWEEN 0 AND 100 OR p_exam NOT BETWEEN 0 AND 100 OR p_practice+p_exam<>100
 THEN RAISE EXCEPTION 'Invalid performance weights' USING ERRCODE='22023'; END IF;
 PERFORM practice_private.authorize(auth.uid(),p_course);
 IF NOT tutor_private.access(auth.uid(),p_course,true) THEN RAISE EXCEPTION 'Assigned instructor required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_course::text,53));
 SELECT * INTO old FROM public.ai_practice_performance_weights WHERE course_id=p_course FOR UPDATE;
 IF FOUND AND (old.practice_weight,old.exam_weight) IS NOT DISTINCT FROM (p_practice,p_exam) THEN RETURN old.revision; END IF;
 IF p_revision<>coalesce(old.revision,0) THEN RAISE EXCEPTION 'Weights changed; reload' USING ERRCODE='PT409'; END IF;
 INSERT INTO public.ai_practice_performance_weights(course_id,practice_weight,exam_weight) VALUES(p_course,p_practice,p_exam)
 ON CONFLICT(course_id) DO UPDATE SET practice_weight=EXCLUDED.practice_weight,exam_weight=EXCLUDED.exam_weight,
 revision=ai_practice_performance_weights.revision+1 RETURNING revision INTO result;
 RETURN result;
END $$;

-- Shared by summaries and pages. No browser/worker execution grant; no user input
-- may claim a score, actor or topic. Access is checked by the public reader below.
CREATE FUNCTION practice_private.performance_rows(p_actor uuid,p_course uuid)
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
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.selection) pick WHERE NOT EXISTS(
  SELECT 1 FROM public.ai_tutor_sources src WHERE src.id=(pick->>'sourceId')::uuid AND src.course_id=p_course
   AND src.revision=(pick->>'revision')::uuid AND src.status='ready'));
$$;
REVOKE ALL ON FUNCTION practice_private.performance_rows(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION practice_private.performance_summary(p_rows jsonb,p_practice integer,p_exam integer)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 WITH counts AS (
  SELECT kind,
   coalesce(sum((row->>'earned')::bigint),0) earned,coalesce(sum((row->>'graded')::bigint),0) graded,
   coalesce(sum((row->>'pending')::bigint),0) pending,coalesce(sum((row->>'excluded')::bigint),0) excluded
  FROM unnest(ARRAY['practice','exam']) kind LEFT JOIN LATERAL (
   SELECT x row FROM jsonb_array_elements(p_rows) x WHERE x->>'mode'=kind
  ) data ON true GROUP BY kind
 ), percentages AS (
  SELECT *,100.0*earned/nullif(graded,0) percent,
   CASE WHEN graded>0 THEN CASE kind WHEN 'practice' THEN p_practice ELSE p_exam END ELSE 0 END weight FROM counts
 ) SELECT jsonb_build_object('score',round(sum(coalesce(percent,0)*weight)/nullif(sum(weight),0),2),
  'coverage',sum(weight),
  'practice',(SELECT jsonb_build_object('earned',earned,'graded',graded,'pending',pending,'excluded',excluded,'percent',round(percent,2)) FROM percentages WHERE kind='practice'),
  'exam',(SELECT jsonb_build_object('earned',earned,'graded',graded,'pending',pending,'excluded',excluded,'percent',round(percent,2)) FROM percentages WHERE kind='exam')) FROM percentages;
$$;
REVOKE ALL ON FUNCTION practice_private.performance_summary(jsonb,integer,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.read_ai_practice_performance(p_course uuid,p_offset integer DEFAULT 0) RETURNS jsonb
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
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.selection) pick WHERE NOT EXISTS(SELECT 1 FROM public.ai_tutor_sources src
  WHERE src.id=(pick->>'sourceId')::uuid AND src.course_id=p_course AND src.revision=(pick->>'revision')::uuid AND src.status='ready'));
 RETURN jsonb_build_object('courseId',p_course,'canManage',public.ai_tutor_access(p_course,true),
  'weights',jsonb_build_object('practice',config.practice_weight,'exam',config.exam_weight,'revision',config.revision),
  'summary',practice_private.performance_summary(rows,config.practice_weight,config.exam_weight),'units',units,'unitCount',total,
  'offset',p_offset,'hasMore',p_offset+20<total,'unavailableSessions',unavailable);
END $$;
REVOKE ALL ON FUNCTION public.set_ai_practice_performance_weights(uuid,bigint,integer,integer),public.read_ai_practice_performance(uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.set_ai_practice_performance_weights(uuid,bigint,integer,integer),public.read_ai_practice_performance(uuid,integer) TO authenticated;
COMMIT;
