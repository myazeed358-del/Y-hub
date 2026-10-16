-- Y-Hub Migration 0019
-- Restore student course enrollment INSERT permission.
-- RLS continues to enforce which enrollments are allowed.

BEGIN;

-- Never grant access if RLS protection is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'public.course_enrollments'::regclass
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION
      'Enrollment RLS must be enabled before granting INSERT';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_enrollments'
      AND policyname = 'Students can enroll themselves'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION
      'Required enrollment INSERT policy is missing';
  END IF;
END;
$$;

-- The application needs INSERT to register students.
-- RLS still checks the authenticated user and published course.
GRANT INSERT ON TABLE public.course_enrollments
TO authenticated;

COMMIT;
