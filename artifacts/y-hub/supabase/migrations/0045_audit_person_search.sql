-- Decision24: event-scoped identity snapshots and read-only people search.
BEGIN;
-- Drain old capture invocations BEFORE replacing the function/backfilling. Locking
-- audit_events alone is insufficient: an old trigger could already be waiting to insert.
-- Plan a maintenance window for the backfill; lock contention aborts safely for retry.
SET LOCAL lock_timeout = '10s';
DO $$ DECLARE tables text; BEGIN
 SELECT string_agg(format('%I.%I',n.nspname,c.relname),',' ORDER BY n.nspname,c.relname)
 INTO tables FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal
  AND t.tgfoid='yhub_audit_private.capture()'::regprocedure);
 IF tables IS NOT NULL THEN EXECUTE 'LOCK TABLE '||tables||' IN SHARE ROW EXCLUSIVE MODE'; END IF;
END $$;
LOCK TABLE public.audit_events IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.audit_event_people (
 event_id uuid NOT NULL REFERENCES public.audit_events(id) ON DELETE RESTRICT,
 relation text NOT NULL CHECK(relation IN ('actor','affected')),
 person_id uuid NOT NULL,
 full_name text NOT NULL CHECK(length(full_name)<=150),
 full_name_ar text CHECK(length(full_name_ar)<=120),
 full_name_en text CHECK(length(full_name_en)<=120),
 user_number text CHECK(user_number ~ '^[0-9]{9}$'),
 recorded boolean NOT NULL,
 PRIMARY KEY(event_id,relation,person_id)
);
CREATE INDEX audit_people_person ON public.audit_event_people(person_id,relation,event_id);
CREATE INDEX audit_people_number ON public.audit_event_people(user_number,event_id);
ALTER TABLE public.audit_event_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_event_people FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_event_people FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.audit_event_people TO authenticated;
CREATE POLICY audit_people_read ON public.audit_event_people FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.audit_events e WHERE e.id=event_id)
);
CREATE TRIGGER audit_people_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_event_people
 FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.reject_mutation();

-- Only called by the trusted capture trigger or this migration. Never a client RPC.
CREATE FUNCTION yhub_audit_private.record_people(p_event uuid,p_old jsonb,p_new jsonb,p_recorded boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.audit_events%ROWTYPE; r record; u public.users%ROWTYPE; v_row jsonb; v_number text; v_name text;
BEGIN
 SELECT * INTO STRICT e FROM public.audit_events WHERE id=p_event;
 FOR r IN
  SELECT DISTINCT relation,person_id FROM (
   SELECT 'actor'::text relation,e.actor_id person_id WHERE e.actor_id IS NOT NULL
   UNION ALL
   SELECT 'affected', x.id::uuid FROM (
    SELECT e.entity_id::text id WHERE e.entity_type='users'
    UNION ALL SELECT row_data->>key FROM (VALUES(p_old),(p_new)) rows(row_data)
      CROSS JOIN (VALUES('student_id'),('instructor_id')) keys(key)
   ) x WHERE x.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  ) people
 LOOP
  SELECT * INTO u FROM public.users WHERE id=r.person_id;
  v_row:=CASE WHEN e.entity_type='users' AND e.entity_id=r.person_id
    THEN CASE WHEN e.operation='DELETE' THEN p_old ELSE p_new END ELSE '{}'::jsonb END;
  v_number:=coalesce(u.user_number,v_row->>'user_number');
  IF v_number IS NULL THEN
   -- The immutable number ledger survives account deletion. Do not guess if ambiguous.
   SELECT CASE WHEN count(DISTINCT user_number)=1 THEN min(user_number) END INTO v_number
   FROM yhub_internal.user_number_issues WHERE auth_user_id=r.person_id;
  END IF;
  v_name:=CASE WHEN r.relation='actor' THEN e.actor_name
    ELSE coalesce(u.full_name,NULLIF(v_row->>'full_name','[REDACTED]'),'') END;
  INSERT INTO public.audit_event_people(event_id,relation,person_id,full_name,full_name_ar,full_name_en,user_number,recorded)
  VALUES(e.id,r.relation,r.person_id,left(v_name,150),
   CASE WHEN p_recorded THEN left(coalesce(u.full_name_ar,v_row->>'full_name_ar'),120) END,
   CASE WHEN p_recorded THEN left(coalesce(u.full_name_en,v_row->>'full_name_en'),120) END,
   v_number,p_recorded);
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION yhub_audit_private.record_people(uuid,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION yhub_audit_private.capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  v_row jsonb;
  v_before jsonb := '{}'; v_after jsonb := '{}';
  v_fields text[] := string_to_array(TG_ARGV[0], ',');
  v_visible text[] := string_to_array(TG_ARGV[1], ',');
  v_changed text[] := '{}'; v_key text;
  v_actor uuid := auth.uid(); v_role text; v_name text;
  v_actions text[]; v_sensitivity text := 'normal'; v_reserved boolean;
  v_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND v_old = v_new THEN RETURN NULL; END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN v_old ELSE v_new END;
  FOREACH v_key IN ARRAY v_fields LOOP
    IF (v_old->v_key) IS DISTINCT FROM (v_new->v_key) THEN
      v_changed := array_append(v_changed, v_key);
      IF v_old ? v_key THEN
        v_before := v_before || jsonb_build_object(v_key, CASE WHEN v_key = ANY(v_visible) THEN v_old->v_key ELSE '"[REDACTED]"'::jsonb END);
      END IF;
      IF v_new ? v_key THEN
        v_after := v_after || jsonb_build_object(v_key, CASE WHEN v_key = ANY(v_visible) THEN v_new->v_key ELSE '"[REDACTED]"'::jsonb END);
      END IF;
    END IF;
  END LOOP;
  -- Profiles: only identity/role/major are tracked; unrelated personal updates are intentionally omitted.
  IF TG_OP = 'UPDATE' AND cardinality(v_changed) = 0 THEN RETURN NULL; END IF;
  IF v_actor IS NULL THEN v_role := 'system'; v_name := 'System';
  ELSIF TG_TABLE_NAME = 'users' AND (v_old->>'id')::uuid = v_actor THEN
    v_role := v_old->>'role'; v_name := left(coalesce(v_old->>'full_name',''),150);
  ELSE
    SELECT role, left(coalesce(full_name,''),150) INTO v_role,v_name FROM public.users WHERE id = v_actor;
    IF v_role IS NULL THEN RAISE EXCEPTION 'Audit actor missing' USING ERRCODE = '42501'; END IF;
  END IF;
  v_actions := ARRAY[CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END];
  IF TG_OP = 'UPDATE' AND 'is_published' = ANY(v_changed) THEN
    v_actions := array_append(v_actions, CASE WHEN (v_new->>'is_published')::boolean THEN 'published' ELSE 'unpublished' END);
  END IF;
  IF TG_OP = 'UPDATE' AND 'enrollment_open' = ANY(v_changed) THEN
    v_actions := array_append(v_actions, CASE WHEN (v_new->>'enrollment_open')::boolean THEN 'enrollment_opened' ELSE 'enrollment_closed' END);
  END IF;
  IF TG_TABLE_NAME = 'course_enrollments' AND TG_OP = 'UPDATE' THEN v_actions := array_append(v_actions,'enrollment_changed'); END IF;
  IF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE' THEN
    IF 'role' = ANY(v_changed) THEN v_actions := array_append(v_actions,'role_changed'); END IF;
    IF 'major' = ANY(v_changed) THEN v_actions := array_append(v_actions,'access_changed'); END IF;
  END IF;
  v_reserved := TG_ARGV[2] = 'reserved' OR v_role <> 'instructor';
  IF TG_OP = 'DELETE' THEN v_sensitivity := 'high'; END IF;
  IF TG_ARGV[2] = 'reserved' OR (TG_OP = 'DELETE' AND v_role IN ('admin','super_admin','system')) THEN v_sensitivity := 'critical'; END IF;
  INSERT INTO public.audit_events(actor_id,actor_role,actor_name,operation,actions,entity_type,entity_id,
    sensitivity,super_admin_only,old_values,new_values,context,search_document)
  VALUES (v_actor,v_role,v_name,TG_OP,v_actions,TG_TABLE_NAME,(v_row->>'id')::uuid,
    v_sensitivity,v_reserved,v_before,v_after,
    jsonb_strip_nulls(jsonb_build_object('changed_fields',v_changed,'course_id',v_row->>'course_id',
      'unit_id',v_row->>'unit_id','exam_id',v_row->>'exam_id','source',CASE WHEN v_actor IS NULL THEN 'system' ELSE 'authenticated' END)),
    to_tsvector('simple',v_name || ' ' || TG_TABLE_NAME || ' ' || array_to_string(v_actions,' '))) RETURNING id INTO v_id;
  PERFORM yhub_audit_private.record_people(v_id,v_old,v_new,true);
  -- Intentionally no catch around required audit insertion: any failure aborts the domain write.
  IF 'role_changed' = ANY(v_actions) OR TG_OP = 'DELETE' THEN
    BEGIN
      INSERT INTO public.audit_notifications(event_id,topic)
      VALUES (v_id,CASE WHEN 'role_changed' = ANY(v_actions) THEN 'role_change' ELSE 'sensitive_delete' END);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Audit notification enqueue failed, SQLSTATE %; retry from audit event', SQLSTATE;
    END;
  END IF;
  RETURN NULL;
END;
$$;

-- Events remain immutable. Legacy companions are explicitly labelled lookups, not
-- invented historical snapshots. Missing unchanged relationships cannot be recovered.
DO $$ DECLARE e record; BEGIN
 FOR e IN SELECT id,old_values,new_values FROM public.audit_events LOOP
  PERFORM yhub_audit_private.record_people(e.id,e.old_values,e.new_values,false);
 END LOOP;
END $$;

CREATE FUNCTION public.audit_person_matches(p public.audit_event_people,q text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT strpos(lower(concat_ws(' ',p.full_name,p.full_name_ar,p.full_name_en,p.user_number)),lower(btrim(coalesce(q,''))))>0
$$;
REVOKE ALL ON FUNCTION public.audit_person_matches(public.audit_event_people,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.audit_person_matches(public.audit_event_people,text) TO authenticated;

CREATE FUNCTION public.search_audit_events_v2(
 p_search text DEFAULT '',p_actor uuid DEFAULT NULL,p_action text DEFAULT NULL,p_entity text DEFAULT NULL,
 p_from timestamptz DEFAULT NULL,p_to timestamptz DEFAULT NULL,
 p_before_time timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 26,
 p_person_search text DEFAULT '',p_person_scope text DEFAULT 'either'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF public.audit_reader_role() IS NULL OR public.audit_reader_role() NOT IN ('admin','super_admin') THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>101 OR length(coalesce(p_search,''))>200
 OR length(coalesce(p_person_search,''))>120 OR p_person_scope IS NULL OR p_person_scope NOT IN ('actor','affected','either')
 OR ((p_before_time IS NULL)<>(p_before_id IS NULL)) OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>=p_to) THEN
  RAISE EXCEPTION 'Invalid audit filters' USING ERRCODE='22023';
 END IF;
 WITH filtered AS MATERIALIZED (
  -- Count/filter narrow identifiers; do not spool full redacted JSON for every match.
  SELECT e.id,e.occurred_at FROM public.audit_events e WHERE
   (coalesce(p_search,'')='' OR e.search_document @@ websearch_to_tsquery('simple',p_search))
   AND (p_action IS NULL OR p_action=ANY(e.actions)) AND (p_entity IS NULL OR e.entity_type=p_entity)
   AND (p_from IS NULL OR e.occurred_at>=p_from) AND (p_to IS NULL OR e.occurred_at<p_to)
   AND ((p_actor IS NULL AND btrim(coalesce(p_person_search,''))='') OR EXISTS(
    SELECT 1 FROM public.audit_event_people person WHERE person.event_id=e.id
     AND (p_person_scope='either' OR person.relation=p_person_scope)
     AND (p_actor IS NULL OR person.person_id=p_actor)
     AND (p_actor IS NOT NULL OR public.audit_person_matches(person,p_person_search))
   ))
 ), page AS (
  SELECT * FROM filtered e WHERE p_before_time IS NULL OR (e.occurred_at,e.id)<(p_before_time,p_before_id)
  ORDER BY occurred_at DESC,id DESC LIMIT p_limit
 )
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'events',coalesce((
  SELECT jsonb_agg(to_jsonb(e)-'search_document'-'transaction_id'||jsonb_build_object('people',coalesce((
   SELECT jsonb_agg(to_jsonb(person)-'event_id' ORDER BY relation,person_id) FROM public.audit_event_people person WHERE person.event_id=e.id
  ),'[]'::jsonb)) ORDER BY e.occurred_at DESC,e.id DESC) FROM page page_ids JOIN public.audit_events e ON e.id=page_ids.id
 ),'[]'::jsonb)) INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.search_audit_events_v2(text,uuid,text,text,timestamptz,timestamptz,timestamptz,uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_audit_events_v2(text,uuid,text,text,timestamptz,timestamptz,timestamptz,uuid,integer,text,text) TO authenticated;

CREATE FUNCTION public.suggest_audit_people(p_search text,p_scope text DEFAULT 'either',p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF public.audit_reader_role() IS NULL OR public.audit_reader_role() NOT IN ('admin','super_admin') THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>20 OR p_scope IS NULL OR p_scope NOT IN ('actor','affected','either')
 OR p_search IS NULL OR length(p_search)>120 THEN RAISE EXCEPTION 'Invalid person search' USING ERRCODE='22023'; END IF;
 IF length(btrim(p_search))<2 THEN RETURN '[]'::jsonb; END IF;
 WITH matches AS (
  SELECT DISTINCT ON(p.person_id) p.*,e.occurred_at FROM public.audit_event_people p JOIN public.audit_events e ON e.id=p.event_id
  WHERE (p_scope='either' OR p.relation=p_scope) AND public.audit_person_matches(p,p_search)
  ORDER BY p.person_id,e.occurred_at DESC,e.id DESC
 ), limited AS (SELECT * FROM matches ORDER BY occurred_at DESC,person_id LIMIT p_limit)
 SELECT coalesce(jsonb_agg(to_jsonb(p)-'event_id'-'occurred_at'),'[]'::jsonb) INTO result FROM limited p;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.suggest_audit_people(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suggest_audit_people(text,text,integer) TO authenticated;
COMMIT;
