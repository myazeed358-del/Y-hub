-- Phase 3. Additive hardening; apply only after isolated staging review.
BEGIN;
-- RLS does not govern TRUNCATE or trigger creation. Browser roles need neither.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC,anon,authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;

CREATE POLICY academic_enrollment_read ON public.course_enrollments AS RESTRICTIVE FOR SELECT TO authenticated
USING (student_id=auth.uid() OR (
 EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role IN ('instructor','admin','super_admin'))
 AND public.academic_section_visible(course_id,true)
));

-- This platform event-trigger function is not supplied by the repository.
-- Harden it only if present; preserve its existing body/ownership/definer mode.
-- Deployment review must inspect pg_get_functiondef on the actual target first.
DO $$
BEGIN
 IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
   IF (SELECT prorettype FROM pg_proc WHERE oid='public.rls_auto_enable()'::regprocedure) <> 'event_trigger'::regtype THEN
     RAISE EXCEPTION 'Unexpected rls_auto_enable contract; review target definition';
   END IF;
   ALTER FUNCTION public.rls_auto_enable() SET search_path=pg_catalog;
   REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated;
 END IF;
END;
$$;

CREATE OR REPLACE FUNCTION yhub_exam_private.lock_access(p_exam_id uuid) RETURNS public.exams
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_exam public.exams; v_status text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR SHARE;
 IF NOT FOUND OR NOT coalesce(v_exam.is_published,false) THEN
   RAISE EXCEPTION 'Exam unavailable' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.courses WHERE id=v_exam.course_id AND is_published FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Section unavailable' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_status FROM public.course_enrollments
 WHERE course_id=v_exam.course_id AND student_id=auth.uid() FOR SHARE;
 IF v_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Active enrollment required' USING ERRCODE='42501'; END IF;
 RETURN v_exam;
END $$;

COMMIT;
