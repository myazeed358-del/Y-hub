-- 0025 is reserved by the independently reviewed exam-attempt workstream.
-- This migration has no dependency on exam_attempts and changes no FK/RLS policy.
BEGIN;
CREATE SCHEMA yhub_course_private;
REVOKE ALL ON SCHEMA yhub_course_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA yhub_course_private TO authenticated;

-- Minimal diagnostic guard. It returns no course content and does not delete.
-- Existing 0005 policy requires current manager role AND ownership for all roles,
-- including admin/super_admin. Do not silently broaden that policy.
CREATE FUNCTION yhub_course_private.lock_delete_access(p_course_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_owner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') THEN
   RAISE EXCEPTION 'Course deletion not permitted' USING ERRCODE='42501';
 END IF;
 SELECT instructor_id INTO v_owner FROM public.courses WHERE id=p_course_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Course not found' USING ERRCODE='P0002'; END IF;
 IF v_owner IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Course deletion not permitted' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION yhub_course_private.lock_delete_access(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION yhub_course_private.lock_delete_access(uuid) TO authenticated;

-- Actual DELETE runs as the caller: RLS still applies, including future policies.
-- Audit triggers and all dependent deletes share this transaction; exceptions roll
-- everything back. Never return success for a suppressed/zero-row DELETE.
CREATE FUNCTION public.delete_course_confirmed(p_course_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_deleted uuid;
BEGIN
 PERFORM yhub_course_private.lock_delete_access(p_course_id);
 DELETE FROM public.courses WHERE id=p_course_id RETURNING id INTO v_deleted;
 IF v_deleted IS NULL THEN RAISE EXCEPTION 'Course deletion rejected' USING ERRCODE='42501'; END IF;
 RETURN v_deleted;
END $$;
REVOKE ALL ON FUNCTION public.delete_course_confirmed(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.delete_course_confirmed(uuid) TO authenticated;
COMMIT;
