-- Y-Hub: secure course enrollment roster
BEGIN;

-- Admins may read all courses, including unpublished ones.
-- This policy grants SELECT only, not editing privileges.
CREATE POLICY "Roster admins can view all courses"
ON public.courses
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('admin', 'super_admin')
  )
);

-- Counts for courses the authenticated manager is allowed to manage.
CREATE FUNCTION public.list_managed_course_enrollment_counts()
RETURNS TABLE(course_id UUID, enrollment_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT;
BEGIN
  SELECT u.role INTO actor_role
  FROM public.users u WHERE u.id = actor_id;

  IF actor_id IS NULL OR COALESCE(actor_role, '') NOT IN
    ('instructor', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, COUNT(ce.student_id)
  FROM public.courses c
  LEFT JOIN public.course_enrollments ce
    ON ce.course_id = c.id AND ce.status = 'active'
  WHERE actor_role IN ('admin', 'super_admin')
     OR c.instructor_id = actor_id
  GROUP BY c.id;
END;
$$;

REVOKE ALL ON FUNCTION
  public.list_managed_course_enrollment_counts()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.list_managed_course_enrollment_counts()
TO authenticated;

-- Names are returned only after verifying course ownership or admin role.
CREATE FUNCTION public.get_managed_course_enrollment_roster(
  p_course_id UUID
)
RETURNS TABLE(
  student_id UUID,
  full_name TEXT,
  enrolled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT;
BEGIN
  SELECT u.role INTO actor_role
  FROM public.users u WHERE u.id = actor_id;

  IF actor_id IS NULL
     OR COALESCE(actor_role, '') NOT IN
        ('instructor', 'admin', 'super_admin')
     OR NOT EXISTS (
       SELECT 1 FROM public.courses c
       WHERE c.id = p_course_id
         AND (
           actor_role IN ('admin', 'super_admin')
           OR c.instructor_id = actor_id
         )
     ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ce.student_id,
    COALESCE(NULLIF(BTRIM(u.full_name), ''), 'طالب')::TEXT,
    ce.enrolled_at
  FROM public.course_enrollments ce
  LEFT JOIN public.users u ON u.id = ce.student_id
  WHERE ce.course_id = p_course_id
    AND ce.status = 'active'
  ORDER BY u.full_name NULLS LAST, ce.enrolled_at;
END;
$$;

REVOKE ALL ON FUNCTION
  public.get_managed_course_enrollment_roster(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_managed_course_enrollment_roster(UUID)
TO authenticated;

COMMIT;
