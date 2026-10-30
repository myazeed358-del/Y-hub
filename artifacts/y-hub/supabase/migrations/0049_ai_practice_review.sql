-- Approved 23/39: bounded automatic recheck, explicit human review and honest scoring.
-- No official exam grade changes, no inferred administrative knowledge entitlement.
BEGIN;
CREATE TABLE public.ai_practice_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL, position integer NOT NULL,
 course_id uuid NOT NULL REFERENCES public.courses ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'automatic_pending' CHECK(state IN ('automatic_pending','needs_review','requested','resolved')),
 auto_outcome text CHECK(auto_outcome IN ('agrees','disagrees','uncertain','unavailable')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 requested_at timestamptz, resolved_at timestamptz, resolved_by uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(session_id,position) REFERENCES practice_private.questions ON DELETE CASCADE,
 UNIQUE(session_id,position),
 CHECK((state='automatic_pending')=(auto_outcome IS NULL)),
 CHECK((state IN ('requested','resolved'))=(requested_at IS NOT NULL)),
 CHECK((state='resolved')=(resolved_at IS NOT NULL AND resolved_by IS NOT NULL))
);
CREATE INDEX practice_reviews_queue ON public.ai_practice_reviews(course_id,state,created_at,id);
CREATE INDEX practice_reviews_owner ON public.ai_practice_reviews(student_id,session_id);
CREATE TABLE practice_private.review_details (
 review_id uuid PRIMARY KEY REFERENCES public.ai_practice_reviews ON DELETE CASCADE,
 auto_choice integer CHECK(auto_choice BETWEEN 0 AND 3), auto_explanation text CHECK(length(auto_explanation)<=4000),
 resolved_choice integer CHECK(resolved_choice BETWEEN 0 AND 3), resolution text CHECK(length(resolution)<=2000)
);
ALTER TABLE public.ai_practice_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_practice_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE practice_private.review_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_private.review_details FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_practice_reviews,practice_private.review_details FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ai_practice_reviews TO authenticated;
CREATE FUNCTION public.can_manage_ai_practice_review(p_course uuid,p_student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND auth.uid()<>p_student AND tutor_private.access(auth.uid(),p_course,true) AND tutor_private.access(p_student,p_course);
$$;
REVOKE ALL ON FUNCTION public.can_manage_ai_practice_review(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_ai_practice_review(uuid,uuid) TO authenticated;
CREATE POLICY practice_review_read ON public.ai_practice_reviews FOR SELECT TO authenticated USING(
 (student_id=auth.uid() AND public.ai_tutor_access(course_id)) OR
 (state IN ('requested','resolved') AND public.can_manage_ai_practice_review(course_id,student_id)));
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.ai_practice_reviews FOR EACH ROW
 EXECUTE FUNCTION yhub_audit_private.capture('id,session_id,position,course_id,student_id,state,auto_outcome,revision,requested_at,resolved_at,resolved_by,created_at',
 'id,session_id,position,course_id,student_id,state,auto_outcome,revision,requested_at,resolved_at,resolved_by,created_at','ordinary');

CREATE FUNCTION practice_private.reviewable(s public.ai_practice_sessions,p_position integer) RETURNS practice_private.questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q practice_private.questions;
BEGIN
 SELECT * INTO q FROM practice_private.questions WHERE session_id=s.id AND position=p_position;
 IF NOT FOUND OR q.choice IS NULL OR NOT(s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL))
 THEN RAISE EXCEPTION 'Answer not ready for review' USING ERRCODE='PT409'; END IF;
 RETURN q;
END $$;
CREATE FUNCTION public.begin_ai_practice_review(p_session uuid,p_position integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; v_id uuid;
BEGIN
 s:=practice_private.owned(p_session,auth.uid());
 PERFORM practice_private.reviewable(s,p_position);
 SELECT id INTO v_id FROM public.ai_practice_reviews WHERE session_id=p_session AND position=p_position;
 IF FOUND THEN RETURN v_id; END IF;
 INSERT INTO public.ai_practice_reviews(session_id,position,course_id,student_id) VALUES(p_session,p_position,s.course_id,s.user_id) RETURNING id INTO v_id;
 INSERT INTO practice_private.review_details(review_id) VALUES(v_id);
 RETURN v_id;
END $$;
CREATE FUNCTION public.request_ai_practice_human_review(p_review uuid,p_revision bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review AND student_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 s:=practice_private.owned(r.session_id,auth.uid());PERFORM practice_private.reviewable(s,r.position);
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review FOR UPDATE;
 IF r.state IN ('requested','resolved') THEN RETURN r.revision; END IF;
 IF r.state<>'needs_review' OR p_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'Automatic recheck required or review changed' USING ERRCODE='PT409'; END IF;
 UPDATE public.ai_practice_reviews SET state='requested',requested_at=clock_timestamp(),revision=revision+1 WHERE id=p_review RETURNING revision INTO r.revision;
 RETURN r.revision;
END $$;

-- Owner-only worker context; only trusted service execution can use actor arguments.
CREATE FUNCTION public.ai_practice_review_context(p_actor uuid,p_review uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions; q practice_private.questions;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review AND student_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 s:=practice_private.owned(r.session_id,p_actor);q:=practice_private.reviewable(s,r.position);
 RETURN jsonb_build_object('courseId',r.course_id,'revision',r.revision,'done',r.state<>'automatic_pending',
  'language',s.language,'prompt',q.prompt,'options',q.options,'evidence',q.evidence);
END $$;
CREATE FUNCTION public.publish_ai_practice_recheck(p_actor uuid,p_review uuid,p_revision bigint,p_kind text,p_choice integer,p_explanation text,p_evidence uuid[])
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions; q practice_private.questions;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review AND student_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 s:=practice_private.owned(r.session_id,p_actor);q:=practice_private.reviewable(s,r.position);
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

CREATE FUNCTION practice_private.reviewer_context(p_review uuid) RETURNS public.ai_practice_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review;
 IF NOT FOUND OR r.state NOT IN ('requested','resolved') OR NOT public.can_manage_ai_practice_review(r.course_id,r.student_id)
 THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 PERFORM practice_private.authorize(auth.uid(),r.course_id);
 IF NOT public.can_manage_ai_practice_review(r.course_id,r.student_id) THEN RAISE EXCEPTION 'Reviewer no longer authorized' USING ERRCODE='42501'; END IF;
 s:=practice_private.owned(r.session_id,r.student_id);PERFORM practice_private.reviewable(s,r.position);
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review FOR UPDATE;
 RETURN r;
END $$;
CREATE FUNCTION public.get_ai_practice_review(p_review uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; s public.ai_practice_sessions; q practice_private.questions; d practice_private.review_details;
BEGIN
 SELECT * INTO r FROM public.ai_practice_reviews WHERE id=p_review;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='42501'; END IF;
 IF r.student_id=auth.uid() THEN s:=practice_private.owned(r.session_id,auth.uid());
 ELSE r:=practice_private.reviewer_context(p_review);SELECT * INTO s FROM public.ai_practice_sessions WHERE id=r.session_id; END IF;
 q:=practice_private.reviewable(s,r.position);
 SELECT * INTO d FROM practice_private.review_details WHERE review_id=p_review;
 RETURN jsonb_build_object('review',to_jsonb(r),'question',jsonb_build_object('prompt',q.prompt,'options',q.options,'choice',q.choice,'suggestedChoice',q.correct,'explanation',q.explanation,'citations',q.evidence),
  'automatic',jsonb_build_object('choice',d.auto_choice,'explanation',d.auto_explanation),
  'resolution',CASE WHEN r.state='resolved' THEN jsonb_build_object('choice',d.resolved_choice,'explanation',d.resolution,'score',CASE WHEN d.resolved_choice IS NOT NULL THEN (q.choice=d.resolved_choice)::int END) END);
END $$;
CREATE FUNCTION public.resolve_ai_practice_review(p_review uuid,p_revision bigint,p_choice integer,p_explanation text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ai_practice_reviews; d practice_private.review_details;
BEGIN
 r:=practice_private.reviewer_context(p_review);
 IF (p_choice IS NOT NULL AND p_choice NOT BETWEEN 0 AND 3) OR p_explanation IS NULL OR length(btrim(p_explanation)) NOT BETWEEN 10 AND 2000
 THEN RAISE EXCEPTION 'Resolution needs a supported choice or explicit exclusion and explanation' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM practice_private.review_details WHERE review_id=p_review;
 IF r.state='resolved' AND (d.resolved_choice,d.resolution) IS NOT DISTINCT FROM (p_choice,btrim(p_explanation)) THEN RETURN r.revision; END IF;
 IF r.state<>'requested' OR p_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'Review already changed' USING ERRCODE='PT409'; END IF;
 UPDATE practice_private.review_details SET resolved_choice=p_choice,resolution=btrim(p_explanation) WHERE review_id=p_review;
 UPDATE public.ai_practice_reviews SET state='resolved',resolved_at=clock_timestamp(),resolved_by=auth.uid(),revision=revision+1 WHERE id=p_review RETURNING revision INTO r.revision;
 RETURN r.revision;
END $$;
CREATE FUNCTION public.list_ai_practice_reviews(p_course uuid,p_resolved boolean DEFAULT false,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.ai_tutor_access(p_course,true) THEN RAISE EXCEPTION 'Review queue unavailable' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 OR p_resolved IS NULL THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
  SELECT r.id,r.position,r.state,r.revision,r.created_at,r.student_id,u.full_name_ar,u.full_name_en,u.full_name,u.user_number
  FROM public.ai_practice_reviews r JOIN public.users u ON u.id=r.student_id
  WHERE r.course_id=p_course AND r.state=CASE WHEN p_resolved THEN 'resolved' ELSE 'requested' END AND public.can_manage_ai_practice_review(r.course_id,r.student_id)
  ORDER BY r.created_at,r.id LIMIT 20 OFFSET p_offset) x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.get_ai_practice_assessment(p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_practice_sessions; items jsonb; earned integer; graded integer; pending integer; excluded integer;
BEGIN
 s:=practice_private.owned(p_session,auth.uid());
 SELECT coalesce(jsonb_agg(jsonb_build_object('position',q.position,'id',r.id,'state',coalesce(r.state,'unverified'),'revision',r.revision,'outcome',r.auto_outcome,
  'score',CASE WHEN r.state='resolved' AND d.resolved_choice IS NOT NULL THEN (q.choice=d.resolved_choice)::int END) ORDER BY q.position),'[]'::jsonb),
 coalesce(sum(CASE WHEN r.state='resolved' AND d.resolved_choice IS NOT NULL AND q.choice=d.resolved_choice THEN 1 ELSE 0 END),0),
 count(*) FILTER(WHERE r.state='resolved' AND d.resolved_choice IS NOT NULL),
 count(*) FILTER(WHERE r.id IS NULL OR r.state<>'resolved'),count(*) FILTER(WHERE r.state='resolved' AND d.resolved_choice IS NULL)
 INTO items,earned,graded,pending,excluded FROM practice_private.questions q LEFT JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position
 LEFT JOIN practice_private.review_details d ON d.review_id=r.id
 WHERE q.session_id=p_session AND q.choice IS NOT NULL AND (s.submitted_at IS NOT NULL OR (s.mode='practice' AND q.answered_at IS NOT NULL));
 RETURN jsonb_build_object('items',items,'earned',earned,'graded',graded,'pending',pending,'excluded',excluded);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA practice_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.begin_ai_practice_review(uuid,integer),public.request_ai_practice_human_review(uuid,bigint),public.get_ai_practice_review(uuid),public.resolve_ai_practice_review(uuid,bigint,integer,text),public.list_ai_practice_reviews(uuid,boolean,integer),public.get_ai_practice_assessment(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.begin_ai_practice_review(uuid,integer),public.request_ai_practice_human_review(uuid,bigint),public.get_ai_practice_review(uuid),public.resolve_ai_practice_review(uuid,bigint,integer,text),public.list_ai_practice_reviews(uuid,boolean,integer),public.get_ai_practice_assessment(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.ai_practice_review_context(uuid,uuid),public.publish_ai_practice_recheck(uuid,uuid,bigint,text,integer,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_practice_review_context(uuid,uuid),public.publish_ai_practice_recheck(uuid,uuid,bigint,text,integer,text,uuid[]) TO service_role;
COMMIT;
