-- Decision 69, phase 1. Configuration and investigation holds only.
-- No purge job, deletion privilege, or weakening of append-only triggers.
BEGIN;
CREATE TABLE yhub_audit_private.retention_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 months integer NOT NULL DEFAULT 24 CHECK(months BETWEEN 12 AND 60),
 revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0)
);
INSERT INTO yhub_audit_private.retention_policy DEFAULT VALUES;
CREATE TABLE yhub_audit_private.investigation_holds (
 event_id uuid PRIMARY KEY REFERENCES public.audit_events(id) ON DELETE RESTRICT,
 active boolean NOT NULL DEFAULT true,
 revision integer NOT NULL DEFAULT 1 CHECK(revision > 0)
);
ALTER TABLE yhub_audit_private.retention_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE yhub_audit_private.retention_policy FORCE ROW LEVEL SECURITY;
ALTER TABLE yhub_audit_private.investigation_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE yhub_audit_private.investigation_holds FORCE ROW LEVEL SECURITY;
REVOKE ALL ON yhub_audit_private.retention_policy,yhub_audit_private.investigation_holds FROM PUBLIC,anon,authenticated,service_role;

-- Serialize role changes with each authorized operation, not caller JWT metadata.
CREATE FUNCTION yhub_audit_private.require_retention_owner() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF v_role IS DISTINCT FROM 'super_admin' THEN
  RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501';
 END IF;
END;
$$;
CREATE FUNCTION yhub_audit_private.record_retention_change(p_entity uuid,p_action text,p_old jsonb,p_new jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event uuid; v_name text;
BEGIN
 PERFORM yhub_audit_private.require_retention_owner();
 SELECT full_name INTO v_name FROM public.users WHERE id=auth.uid();
 INSERT INTO public.audit_events(actor_id,actor_role,actor_name,operation,actions,entity_type,entity_id,
  sensitivity,super_admin_only,old_values,new_values,context,search_document)
 VALUES(auth.uid(),'super_admin',left(coalesce(v_name,''),150),'UPDATE',ARRAY[p_action],
  'audit_retention',p_entity,'critical',true,p_old,p_new,'{}',to_tsvector('simple',p_action)) RETURNING id INTO v_event;
 PERFORM yhub_audit_private.record_people(v_event,'{}','{}',true);
END;
$$;
CREATE FUNCTION public.get_audit_retention_policy() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM yhub_audit_private.require_retention_owner();
 SELECT jsonb_build_object('months',months,'revision',revision) INTO v_result
 FROM yhub_audit_private.retention_policy WHERE singleton;
 RETURN v_result;
END;
$$;
CREATE FUNCTION public.set_audit_retention_policy(p_months integer,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old yhub_audit_private.retention_policy%ROWTYPE;
BEGIN
 PERFORM yhub_audit_private.require_retention_owner();
 IF p_months IS NULL OR p_months NOT BETWEEN 12 AND 60 OR p_revision IS NULL THEN
  RAISE EXCEPTION 'Invalid retention policy' USING ERRCODE='22023';
 END IF;
 SELECT * INTO STRICT v_old FROM yhub_audit_private.retention_policy WHERE singleton FOR UPDATE;
 IF v_old.revision <> p_revision THEN RAISE EXCEPTION 'Retention policy changed; reload' USING ERRCODE='PT409'; END IF;
 IF v_old.months <> p_months THEN
  UPDATE yhub_audit_private.retention_policy SET months=p_months,revision=revision+1 WHERE singleton;
  PERFORM yhub_audit_private.record_retention_change('00000000-0000-0000-0000-000000000069','retention_policy_changed',
   jsonb_build_object('months',v_old.months),jsonb_build_object('months',p_months));
 END IF;
 RETURN public.get_audit_retention_policy();
END;
$$;
CREATE FUNCTION public.get_audit_investigation_hold(p_event uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM yhub_audit_private.require_retention_owner();
 IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE id=p_event) THEN
  RAISE EXCEPTION 'Audit event not found' USING ERRCODE='22023';
 END IF;
 SELECT jsonb_build_object('active',active,'revision',revision) INTO v_result
 FROM yhub_audit_private.investigation_holds WHERE event_id=p_event;
 RETURN coalesce(v_result,jsonb_build_object('active',false,'revision',0));
END;
$$;
CREATE FUNCTION public.set_audit_investigation_hold(p_event uuid,p_active boolean,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old jsonb;
BEGIN
 PERFORM yhub_audit_private.require_retention_owner();
 IF p_active IS NULL OR p_revision IS NULL THEN RAISE EXCEPTION 'Invalid hold' USING ERRCODE='22023'; END IF;
 -- Future maintenance must take this same lock before selecting/deleting candidates.
 PERFORM 1 FROM yhub_audit_private.retention_policy WHERE singleton FOR UPDATE;
 PERFORM 1 FROM public.audit_events WHERE id=p_event FOR KEY SHARE;
 v_old:=public.get_audit_investigation_hold(p_event);
 IF (v_old->>'revision')::integer <> p_revision THEN RAISE EXCEPTION 'Hold changed; reload' USING ERRCODE='PT409'; END IF;
 IF (v_old->>'active')::boolean <> p_active THEN
  INSERT INTO yhub_audit_private.investigation_holds(event_id,active) VALUES(p_event,p_active)
  ON CONFLICT(event_id) DO UPDATE SET active=excluded.active,revision=investigation_holds.revision+1;
  PERFORM yhub_audit_private.record_retention_change(p_event,'investigation_hold_changed',
   jsonb_build_object('active',(v_old->>'active')::boolean),jsonb_build_object('active',p_active));
 END IF;
 RETURN public.get_audit_investigation_hold(p_event);
END;
$$;
REVOKE ALL ON FUNCTION yhub_audit_private.require_retention_owner(),yhub_audit_private.record_retention_change(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_audit_retention_policy(),public.set_audit_retention_policy(integer,integer),public.get_audit_investigation_hold(uuid),public.set_audit_investigation_hold(uuid,boolean,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_audit_retention_policy(),public.set_audit_retention_policy(integer,integer),public.get_audit_investigation_hold(uuid),public.set_audit_investigation_hold(uuid,boolean,integer) TO authenticated;
COMMIT;
