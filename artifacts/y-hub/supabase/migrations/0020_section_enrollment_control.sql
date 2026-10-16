-- Y-Hub Migration 0020
-- Enrollment availability for current teaching instances.
-- Later move this setting to the dedicated course_sections model.

BEGIN;

-- Existing courses currently represent individual teaching instances.
ALTER TABLE public.courses
ADD COLUMN enrollment_open BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve existing enrollment behavior for already-published courses.
UPDATE public.courses
SET enrollment_open = TRUE
WHERE is_published IS TRUE;

COMMENT ON COLUMN public.courses.enrollment_open IS
'Whether new student enrollment is open for this teaching instance. Existing enrollment access is unaffected.';

-- Security prerequisites.
DO $$
BEGIN
  IF NOT (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.course_enrollments'::regclass
  ) THEN
    RAISE EXCEPTION 'Enrollment RLS must remain enabled';
  END IF;

  IF NOT has_table_privilege(
    'authenticated',
    'public.course_enrollments',
    'INSERT'
  ) THEN
    RAISE EXCEPTION 'Authenticated enrollment INSERT grant is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_enrollments'
      AND cmd IN ('INSERT', 'ALL')
      AND policyname <> 'Students can enroll themselves'
  ) THEN
    RAISE EXCEPTION 'Unexpected enrollment write policy requires review';
  END IF;
END;
$$;

-- Replace the existing policy with an enrollment-open check.
DROP POLICY IF EXISTS "Students can enroll themselves"
ON public.course_enrollments;

CREATE POLICY "Students can enroll themselves"
ON public.course_enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = (SELECT auth.uid())

  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = 'student'
  )

  AND EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_enrollments.course_id
      AND c.is_published IS TRUE
      AND c.enrollment_open IS TRUE
  )
);

COMMIT;
