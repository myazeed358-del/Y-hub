-- Trusted transactional audit. Apply only after review/staging, never from the browser.
BEGIN;
CREATE SCHEMA yhub_audit_private;
REVOKE ALL ON SCHEMA yhub_audit_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  transaction_id bigint NOT NULL DEFAULT txid_current(),
  actor_id uuid, -- Deliberately no FK: account/entity deletion must preserve evidence.
  actor_role text NOT NULL CHECK (actor_role IN ('system','student','instructor','admin','super_admin')),
  actor_name text NOT NULL CHECK (length(actor_name) <= 150),
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  actions text[] NOT NULL CHECK (cardinality(actions) > 0),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  sensitivity text NOT NULL CHECK (sensitivity IN ('normal','high','critical')),
  super_admin_only boolean NOT NULL,
  old_values jsonb NOT NULL CHECK (jsonb_typeof(old_values) = 'object'),
  new_values jsonb NOT NULL CHECK (jsonb_typeof(new_values) = 'object'),
  context jsonb NOT NULL CHECK (jsonb_typeof(context) = 'object'),
  search_document tsvector NOT NULL,
  CHECK ((actor_id IS NULL) = (actor_role = 'system'))
);
CREATE INDEX audit_events_time ON public.audit_events (occurred_at DESC, id DESC);
CREATE INDEX audit_events_actor_time ON public.audit_events (actor_id, occurred_at DESC, id DESC);
CREATE INDEX audit_events_role_time ON public.audit_events (actor_role, super_admin_only, occurred_at DESC, id DESC);
CREATE INDEX audit_events_entity ON public.audit_events (entity_type, entity_id);
CREATE INDEX audit_events_actions ON public.audit_events USING gin (actions);
CREATE INDEX audit_events_search ON public.audit_events USING gin (search_document);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.audit_events TO authenticated;

-- Only the requesting user's current database role is exposed; no caller-supplied ID/JWT role.
CREATE FUNCTION public.audit_reader_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.role FROM public.users u WHERE u.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.audit_reader_role() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_reader_role() TO authenticated;
CREATE POLICY audit_events_read ON public.audit_events FOR SELECT TO authenticated USING (
  (SELECT public.audit_reader_role()) = 'super_admin'
  OR ((SELECT public.audit_reader_role()) = 'admin' AND actor_role = 'instructor' AND NOT super_admin_only)
);

-- Separate durable notification queue; no mail provider or browser insertion API.
CREATE TABLE public.audit_notifications (
  event_id uuid PRIMARY KEY REFERENCES public.audit_events(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  topic text NOT NULL CHECK (topic IN ('role_change','sensitive_delete'))
);
ALTER TABLE public.audit_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_notifications FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.audit_notifications TO authenticated;
CREATE POLICY audit_notifications_read ON public.audit_notifications FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.audit_events e WHERE e.id = event_id)
);

CREATE FUNCTION yhub_audit_private.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_events
FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.reject_mutation();
CREATE TRIGGER audit_notifications_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_notifications
FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.reject_mutation();

CREATE FUNCTION yhub_audit_private.reject_truncate() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Use audited row deletion instead of TRUNCATE' USING ERRCODE = '42501';
END;
$$;

-- A role change waits until the audited operation ends. Never trust a client actor field.
CREATE FUNCTION yhub_audit_private.lock_actor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    IF current_setting('role') NOT IN ('none','postgres','service_role') THEN
      RAISE EXCEPTION 'Audited operation requires a trusted actor' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid() FOR SHARE;
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Audit actor profile missing' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION yhub_audit_private.capture() RETURNS trigger
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
  -- Profiles: only role/major are tracked; unrelated personal updates are intentionally omitted.
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

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('courses','instructor_id,title,description,course_code,is_published,enrollment_open,syllabus_source','instructor_id,is_published,enrollment_open,syllabus_source','ordinary'),
    ('course_materials','course_id,title,type,url','course_id,type','ordinary'),
    ('exams','course_id,title,time_limit_minutes,is_published','course_id,time_limit_minutes,is_published','ordinary'),
    ('questions','course_id,exam_id,type,content,options,correct_answer,difficulty,points','course_id,exam_id,type,difficulty,points','ordinary'),
    ('course_enrollments','course_id,student_id,status','course_id,student_id,status','ordinary'),
    ('syllabus_units','course_id,title,sort_order','course_id,sort_order','ordinary'),
    ('syllabus_sections','unit_id,title,sort_order','unit_id,sort_order','ordinary'),
    ('users','role,major','role,major','reserved')
  ) AS t(entity,fields,visible,visibility) LOOP
    EXECUTE format('CREATE TRIGGER audit_block_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.reject_truncate()',r.entity);
    EXECUTE format('CREATE TRIGGER audit_lock_actor BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.lock_actor()',r.entity);
    EXECUTE format('CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture(%L,%L,%L)',r.entity,r.fields,r.visible,r.visibility);
  END LOOP;
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA yhub_audit_private FROM PUBLIC, anon, authenticated, service_role;

-- Keyset pagination: bounded pages, RLS applies equally to RPC and direct table reads.
CREATE FUNCTION public.search_audit_events(
  p_search text DEFAULT '', p_actor uuid DEFAULT NULL, p_action text DEFAULT NULL,
  p_entity text DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_before_time timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL, p_limit integer DEFAULT 26
) RETURNS SETOF public.audit_events
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 101 OR length(coalesce(p_search,'')) > 200
    OR ((p_before_time IS NULL) <> (p_before_id IS NULL))
    OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to) THEN
    RAISE EXCEPTION 'Invalid audit filters' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT e.* FROM public.audit_events e
  WHERE (coalesce(p_search,'') = '' OR e.search_document @@ websearch_to_tsquery('simple',p_search))
    AND (p_actor IS NULL OR e.actor_id = p_actor)
    AND (p_action IS NULL OR p_action = ANY(e.actions))
    AND (p_entity IS NULL OR e.entity_type = p_entity)
    AND (p_from IS NULL OR e.occurred_at >= p_from) AND (p_to IS NULL OR e.occurred_at < p_to)
    AND (p_before_time IS NULL OR (e.occurred_at,e.id) < (p_before_time,p_before_id))
  ORDER BY e.occurred_at DESC,e.id DESC LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.search_audit_events(text,uuid,text,text,timestamptz,timestamptz,timestamptz,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.search_audit_events(text,uuid,text,text,timestamptz,timestamptz,timestamptz,uuid,integer) TO authenticated;

-- Server-only idempotent repair of notification delivery intent; no event creation API.
CREATE FUNCTION public.requeue_audit_notifications(p_limit integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
  INSERT INTO public.audit_notifications(event_id,topic)
  SELECT e.id,CASE WHEN 'role_changed'=ANY(e.actions) THEN 'role_change' ELSE 'sensitive_delete' END
  FROM public.audit_events e WHERE (e.operation='DELETE' OR 'role_changed'=ANY(e.actions))
    AND NOT EXISTS(SELECT 1 FROM public.audit_notifications n WHERE n.event_id=e.id)
  ORDER BY e.occurred_at,e.id LIMIT p_limit ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.requeue_audit_notifications(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.requeue_audit_notifications(integer) TO service_role;

-- Preserve existing role-management rules, but hold the actor/target roles while checking/writing.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid,p_new_role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_admin_role text; v_target_role text; v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_admin_role FROM public.users WHERE id=auth.uid() FOR SHARE;
  IF coalesce(v_admin_role,'') NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
  IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'Cannot modify own role via this function'; END IF;
  IF p_new_role IS NULL OR p_new_role NOT IN ('student','instructor','admin','super_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('super_admin_role_lock'));
  SELECT role INTO v_target_role FROM public.users WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF (v_target_role='super_admin' OR p_new_role='super_admin') AND v_admin_role<>'super_admin' THEN RAISE EXCEPTION 'Only super_admin can manage super_admin'; END IF;
  IF v_admin_role='admin' AND (v_target_role='admin' OR p_new_role IN ('admin','super_admin')) THEN RAISE EXCEPTION 'Admin cannot manage administrative roles'; END IF;
  IF v_target_role='super_admin' AND p_new_role<>'super_admin' THEN
    SELECT count(*) INTO v_count FROM public.users WHERE role='super_admin';
    IF v_count<=1 THEN RAISE EXCEPTION 'Cannot remove the last super_admin'; END IF;
  END IF;
  UPDATE public.users SET role=p_new_role WHERE id=p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid,text) TO authenticated;
COMMIT;
