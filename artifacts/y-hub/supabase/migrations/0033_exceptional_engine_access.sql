-- Independent of unmerged 0029-0032; apply reviewed migrations in numeric order.
BEGIN;
CREATE SCHEMA yhub_access_private;
REVOKE ALL ON SCHEMA yhub_access_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.module_policies(
 id text PRIMARY KEY CHECK(id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 kind text NOT NULL CHECK(kind IN ('engine','application','laboratory')),
 roles text[] NOT NULL,majors text[] NOT NULL,restricted_roles text[] NOT NULL,
 permissions text[] NOT NULL DEFAULT '{}', routes jsonb NOT NULL CHECK(jsonb_typeof(routes)='array'),
 enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE public.module_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.module_policies FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.module_policies TO authenticated;
CREATE POLICY module_metadata ON public.module_policies FOR SELECT TO authenticated USING(enabled);
CREATE TABLE public.engine_grants(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 engine_id text NOT NULL REFERENCES public.module_policies(id),
 granted_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,revoked_by uuid,
 CHECK(expires_at>created_at)
);
CREATE UNIQUE INDEX engine_grants_live ON public.engine_grants(course_id,student_id,engine_id) WHERE revoked_at IS NULL;
CREATE INDEX engine_grants_student ON public.engine_grants(student_id,engine_id) WHERE revoked_at IS NULL;
ALTER TABLE public.engine_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.engine_grants FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.engine_grants TO authenticated;

CREATE FUNCTION yhub_access_private.can_delegate(p_actor uuid,p_engine text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.module_policies m ON m.id=p_engine
 WHERE u.id=p_actor AND u.role='instructor' AND m.enabled AND m.kind='engine'
 AND 'student'=ANY(m.roles) AND 'instructor'=ANY(m.roles) AND cardinality(m.permissions)=0
 -- Teaching access is deliberately narrower than legacy instructor engine browsing.
 AND (cardinality(m.majors)=0 OR u.major=ANY(m.majors)));
$$;
CREATE FUNCTION yhub_access_private.allowed(p_actor uuid,p_module text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.module_policies m ON m.id=p_module
 WHERE u.id=p_actor AND m.enabled AND u.role=ANY(m.roles) AND cardinality(m.permissions)=0
 AND (NOT u.role=ANY(m.restricted_roles) OR cardinality(m.majors)=0 OR u.major=ANY(m.majors)
 OR (u.role='student' AND m.kind='engine' AND EXISTS(
 SELECT 1 FROM public.engine_grants g JOIN public.courses c ON c.id=g.course_id
 JOIN public.course_enrollments e ON e.course_id=c.id AND e.student_id=g.student_id
 WHERE g.student_id=u.id AND g.engine_id=m.id AND g.revoked_at IS NULL AND g.expires_at>statement_timestamp()
 AND e.status='active' AND c.instructor_id=g.granted_by
 AND yhub_access_private.can_delegate(g.granted_by,m.id)))));
$$;
CREATE FUNCTION public.can_use_module(p_module text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND yhub_access_private.allowed(auth.uid(),p_module);
$$;
CREATE FUNCTION public.my_module_access() RETURNS TABLE(module_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id FROM public.module_policies m WHERE yhub_access_private.allowed(auth.uid(),m.id) ORDER BY m.id;
$$;
CREATE FUNCTION public.delegable_engines() RETURNS TABLE(module_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id FROM public.module_policies m WHERE yhub_access_private.can_delegate(auth.uid(),m.id) ORDER BY m.id;
$$;
CREATE POLICY grants_read ON public.engine_grants FOR SELECT TO authenticated USING(
 student_id=auth.uid() OR EXISTS(SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND
 (u.role IN ('admin','super_admin') OR (u.role='instructor' AND EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.instructor_id=u.id)))));

CREATE FUNCTION public.grant_engine_access(p_course uuid,p_student uuid,p_engine text,p_expires timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_owner uuid;v_status text;
BEGIN
 -- Stable role/major, course owner and enrollment while authorizing + writing.
 PERFORM id FROM public.users WHERE id=ANY(ARRAY[auth.uid(),p_student]) ORDER BY id FOR SHARE;
 PERFORM id FROM public.module_policies WHERE id=p_engine FOR SHARE;
 IF NOT yhub_access_private.can_delegate(auth.uid(),p_engine) THEN RAISE EXCEPTION 'Engine delegation denied' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_student AND role='student') THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='42501'; END IF;
 SELECT instructor_id INTO v_owner FROM public.courses WHERE id=p_course FOR SHARE;
 IF v_owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Section management denied' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_status FROM public.course_enrollments WHERE course_id=p_course AND student_id=p_student FOR SHARE;
 IF v_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Active enrollment required' USING ERRCODE='42501'; END IF;
 IF p_expires IS NULL OR p_expires<=clock_timestamp() OR p_expires>clock_timestamp()+interval '366 days' THEN RAISE EXCEPTION 'Invalid expiry' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_course::text||p_student::text||p_engine,0));
 -- An expired row may be replaced; old audit history and old grant identity survive.
 UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid()
 WHERE course_id=p_course AND student_id=p_student AND engine_id=p_engine AND revoked_at IS NULL AND expires_at<=clock_timestamp();
 SELECT id INTO v_id FROM public.engine_grants WHERE course_id=p_course AND student_id=p_student AND engine_id=p_engine AND revoked_at IS NULL;
 IF FOUND THEN RETURN v_id; END IF;
 INSERT INTO public.engine_grants(course_id,student_id,engine_id,granted_by,expires_at)
 VALUES(p_course,p_student,p_engine,auth.uid(),p_expires) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE FUNCTION public.revoke_engine_access(p_grant uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;v_grant public.engine_grants;v_owner uuid;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') THEN RAISE EXCEPTION 'Revocation denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_grant FROM public.engine_grants WHERE id=p_grant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Grant unavailable' USING ERRCODE='42501'; END IF;
 SELECT instructor_id INTO v_owner FROM public.courses WHERE id=v_grant.course_id FOR SHARE;
 IF v_role='instructor' AND v_owner IS DISTINCT FROM auth.uid() THEN
 RAISE EXCEPTION 'Grant unavailable' USING ERRCODE='42501'; END IF;
 UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid() WHERE id=p_grant AND revoked_at IS NULL;
 RETURN p_grant;
END $$;
-- Permanent revocation prevents drop/re-enroll or demote/promote resurrecting old grants.
CREATE FUNCTION yhub_access_private.invalidate_grants() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='course_enrollments' THEN
  IF TG_OP='DELETE' OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'active') THEN
   UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid() WHERE course_id=OLD.course_id AND student_id=OLD.student_id AND revoked_at IS NULL;
  END IF;
 ELSIF TG_TABLE_NAME='courses' THEN
  IF NEW.instructor_id IS DISTINCT FROM OLD.instructor_id THEN UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid() WHERE course_id=OLD.id AND revoked_at IS NULL; END IF;
 ELSIF TG_TABLE_NAME='users' THEN
  IF (NEW.role,NEW.major) IS DISTINCT FROM (OLD.role,OLD.major) THEN UPDATE public.engine_grants SET revoked_at=clock_timestamp(),revoked_by=auth.uid() WHERE (granted_by=OLD.id OR student_id=OLD.id) AND revoked_at IS NULL; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER invalidate_engine_enrollment AFTER UPDATE OR DELETE ON public.course_enrollments FOR EACH ROW EXECUTE FUNCTION yhub_access_private.invalidate_grants();
CREATE TRIGGER invalidate_engine_assignment AFTER UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION yhub_access_private.invalidate_grants();
CREATE TRIGGER invalidate_engine_role AFTER UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION yhub_access_private.invalidate_grants();
CREATE TRIGGER audit_actor_lock BEFORE INSERT OR UPDATE OR DELETE ON public.engine_grants FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.lock_actor();
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.engine_grants FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture('id,course_id,student_id,engine_id,granted_by,created_at,expires_at,revoked_at,revoked_by','id,course_id,student_id,engine_id,granted_by,created_at,expires_at,revoked_at,revoked_by','ordinary');
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA yhub_access_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.can_use_module(text),public.my_module_access(),public.delegable_engines(),public.grant_engine_access(uuid,uuid,text,timestamptz),public.revoke_engine_access(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.can_use_module(text),public.my_module_access(),public.delegable_engines(),public.grant_engine_access(uuid,uuid,text,timestamptz),public.revoke_engine_access(uuid) TO authenticated;
-- Generated by node tools/export_module_policy.mjs; review/apply as deployment metadata only.
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('audit-log','application',ARRAY['admin','super_admin']::text[],ARRAY[]::text[],ARRAY['admin','super_admin']::text[],ARRAY[]::text[],'[{"path":"/audit-log","title":{"en":"Audit log","ar":"سجل التدقيق"},"icon":"activity","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('calculus-1','engine',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY['mathematics']::text[],ARRAY['student']::text[],ARRAY[]::text[],'[{"path":"/calculus-1","title":{"ar":"التفاضل والتكامل 1","en":"Calculus I"},"icon":"lineChart","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('calculus-iii','engine',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY['mathematics']::text[],ARRAY['student']::text[],ARRAY[]::text[],'[{"path":"/math-solver","title":{"ar":"التفاضل والتكامل 3","en":"Calculus III"},"icon":"box","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('calculus-plotter','engine',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY['mathematics']::text[],ARRAY['student']::text[],ARRAY[]::text[],'[{"path":"/calculus","title":{"en":"Graphing","ar":"الرسوم البيانية"},"icon":"lineChart","dashboardOrder":10}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('engine-access','application',ARRAY['instructor','admin','super_admin']::text[],ARRAY[]::text[],ARRAY['instructor','admin','super_admin']::text[],ARRAY[]::text[],'[{"path":"/engine-access","title":{"ar":"صلاحيات المحركات","en":"Engine permissions"},"icon":"box","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('fuzzy-lab','engine',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY['mathematics']::text[],ARRAY['student']::text[],ARRAY[]::text[],'[{"path":"/lab","title":{"en":"Statistics","ar":"الإحصاء"},"icon":"flaskConical","dashboardOrder":30}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('fuzzy-logic-solver','engine',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY['mathematics']::text[],ARRAY['student']::text[],ARRAY[]::text[],'[{"path":"/solver","title":{"en":"Equations","ar":"المعادلات"},"icon":"calculator","dashboardOrder":20}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('linear-algebra','engine',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY['mathematics']::text[],ARRAY['student']::text[],ARRAY[]::text[],'[{"path":"/linear-algebra","title":{"ar":"الجبر الخطي","en":"Linear Algebra"},"icon":"grid2x2","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('ode','engine',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY['mathematics']::text[],ARRAY['student']::text[],ARRAY[]::text[],'[{"path":"/ode","title":{"ar":"المعادلات التفاضلية","en":"Differential Equations"},"icon":"lineChart","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;
INSERT INTO public.module_policies(id,kind,roles,majors,restricted_roles,permissions,routes) VALUES ('y-sheets','application',ARRAY['student','instructor','admin','super_admin']::text[],ARRAY[]::text[],ARRAY['student','instructor','admin','super_admin']::text[],ARRAY[]::text[],'[{"path":"/y-sheets","title":{"ar":"Y-Sheets","en":"Y-Sheets"},"icon":"grid2x2","dashboardOrder":null}]'::jsonb) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,roles=EXCLUDED.roles,majors=EXCLUDED.majors,restricted_roles=EXCLUDED.restricted_roles,permissions=EXCLUDED.permissions,routes=EXCLUDED.routes;

-- Backend protocol bindings are reviewed operation policies, not UI registration.
CREATE TABLE yhub_access_private.compute_bindings(protocol text,scope text,engine_id text REFERENCES public.module_policies(id),PRIMARY KEY(protocol,scope,engine_id));
REVOKE ALL ON yhub_access_private.compute_bindings FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO yhub_access_private.compute_bindings VALUES
 ('phase','10','linear-algebra'),('phase','7','ode'),('phase','8','ode'),('phase','9','ode'),
 ('phase','6','calculus-1'),('phase','6','calculus-iii'),('phase','6','calculus-plotter'),('phase','fuzzy','fuzzy-logic-solver'),
 ('ast','solve_ode','ode'),('ast','eigenvalues','linear-algebra'),('ast','matrix_rref','linear-algebra'),
 ('ast','derive','calculus-1'),('ast','integrate','calculus-1'),('ast','limit','calculus-1'),
 ('ast','evaluate','fuzzy-logic-solver'),('ast','simplify','fuzzy-logic-solver'),('ast','solve_equation','fuzzy-logic-solver'),('ast','solve_inequality','fuzzy-logic-solver');
CREATE FUNCTION public.authorize_engine_compute(p_protocol text,p_scope text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM yhub_access_private.compute_bindings b
 WHERE b.protocol=p_protocol AND b.scope=p_scope AND yhub_access_private.allowed(auth.uid(),b.engine_id));
$$;
REVOKE ALL ON FUNCTION public.authorize_engine_compute(text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.authorize_engine_compute(text,text) TO authenticated;
COMMIT;
