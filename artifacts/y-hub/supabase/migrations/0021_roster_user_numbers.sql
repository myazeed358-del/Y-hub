-- Y-Hub Migration 0021
-- Expose immutable Y-Hub user numbers in authorized enrollment rosters.
-- Keep the original RPC intact for backward compatibility.

BEGIN;

CREATE FUNCTION public.get_managed_course_enrollment_roster_v2(
  p_course_id UUID
)
RETURNS TABLE (
  student_id UUID,
  full_name TEXT,
  user_number TEXT,
  enrolled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
BEGIN
  SELECT u.role INTO v_actor_role
  FROM public.users u
  WHERE u.id = v_actor_id;

  IF v_actor_id IS NULL
     OR COALESCE(v_actor_role, '') NOT IN
       ('instructor', 'admin', 'super_admin')
     OR NOT EXISTS (
       SELECT 1
       FROM public.courses c
       WHERE c.id = p_course_id
         AND (
           v_actor_role IN ('admin', 'super_admin')
           OR c.instructor_id = v_actor_id
         )
     )
  THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ce.student_id,
    COALESCE(NULLIF(BTRIM(u.full_name), ''), 'طالب')::TEXT,
    u.user_number,
    ce.enrolled_at
  FROM public.course_enrollments ce
  LEFT JOIN public.users u ON u.id = ce.student_id
  WHERE ce.course_id = p_course_id
    AND ce.status = 'active'
  ORDER BY u.full_name NULLS LAST, ce.enrolled_at;
END;
$$;

REVOKE ALL ON FUNCTION
  public.get_managed_course_enrollment_roster_v2(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_managed_course_enrollment_roster_v2(UUID)
TO authenticated;

COMMIT;
