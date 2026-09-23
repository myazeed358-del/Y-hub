-- ============================================================
-- 0006_enrollment.sql
-- STUDENT ENROLLMENT SYSTEM
-- ============================================================
-- This migration:
--   1. Creates the course_enrollments table.
--   2. Adds RLS policies for enrollment.
--   3. Tightens course_materials student access to require enrollment.
--   4. Tightens exams student access to require enrollment.
--   5. Updates get_exam_questions RPC to verify enrollment.
--   6. Updates submit_exam RPC to verify enrollment.
-- ============================================================

-- ============================================================
-- 1. CREATE course_enrollments TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT course_enrollments_course_student_unique UNIQUE (course_id, student_id)
);

-- Index for fast per-student lookups
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id ON public.course_enrollments(student_id);
-- Index for fast per-course lookups (instructor roster views)
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON public.course_enrollments(course_id);

-- Enable RLS
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. RLS POLICIES FOR course_enrollments
-- ============================================================

-- Students can view their OWN enrollments only
CREATE POLICY "Students can view own enrollments"
  ON public.course_enrollments
  FOR SELECT
  USING (auth.uid() = student_id);

-- Students can enroll themselves (INSERT) in published courses.
-- The unique constraint on (course_id, student_id) enforces no duplicates at DB level.
CREATE POLICY "Students can enroll themselves"
  ON public.course_enrollments
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_enrollments.course_id
        AND courses.is_published = true
    )
  );

-- Students cannot UPDATE or DELETE their own enrollments through the client
-- (dropping a course will require an RPC in a future phase).

-- Instructors can view enrollments for their own courses (roster)
CREATE POLICY "Instructors can view enrollments for own courses"
  ON public.course_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_enrollments.course_id
        AND courses.instructor_id = auth.uid()
    )
  );

-- Admins/super_admins can read all enrollments
CREATE POLICY "Admins can read all enrollments"
  ON public.course_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin')
    )
  );


-- ============================================================
-- 3. TIGHTEN course_materials STUDENT ACCESS
--    Replace the open "published course" policy with one that
--    requires enrollment for students.
--    Instructors retain full access via their own policy.
-- ============================================================
DROP POLICY IF EXISTS "Students can view materials of published courses" ON public.course_materials;

CREATE POLICY "Enrolled students can view course materials"
  ON public.course_materials
  FOR SELECT
  USING (
    -- Instructors/admins/super_admins pass through via auth_can_manage_content
    (SELECT public.auth_can_manage_content())
    OR
    -- Enrolled students
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = course_materials.course_id
        AND ce.student_id = auth.uid()
        AND ce.status = 'active'
    )
  );


-- ============================================================
-- 4. TIGHTEN exams STUDENT ACCESS
--    Replace "Students can view published exams" with an
--    enrollment-aware policy.
-- ============================================================
DROP POLICY IF EXISTS "Students can view published exams" ON public.exams;

CREATE POLICY "Enrolled students can view published exams"
  ON public.exams
  FOR SELECT
  USING (
    -- Instructors/admins/super_admins still see all exams for their courses
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = exams.course_id
        AND courses.instructor_id = auth.uid()
    )
    OR
    -- Enrolled active students see published exams
    (
      exams.is_published = true
      AND EXISTS (
        SELECT 1 FROM public.course_enrollments ce
        WHERE ce.course_id = exams.course_id
          AND ce.student_id = auth.uid()
          AND ce.status = 'active'
      )
    )
  );


-- ============================================================
-- 5. UPDATE get_exam_questions RPC — ENROLLMENT CHECK
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_exam_id UUID)
RETURNS TABLE (
  id         UUID,
  course_id  UUID,
  exam_id    UUID,
  type       TEXT,
  content    TEXT,
  options    JSONB,
  difficulty TEXT,
  points     INT
) AS $$
DECLARE
  v_user_id       UUID;
  v_role          TEXT;
  v_exam_course   UUID;
  v_is_published  BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User profile/role not found';
  END IF;

  -- Fetch exam metadata
  SELECT course_id, is_published
    INTO v_exam_course, v_is_published
    FROM public.exams
   WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  -- Instructors/admins/super_admins pass through without enrollment check
  IF v_role IN ('instructor', 'admin', 'super_admin') THEN
    RETURN QUERY
    SELECT q.id, q.course_id, q.exam_id, q.type, q.content, q.options, q.difficulty, q.points
      FROM public.questions q
     WHERE q.exam_id = p_exam_id;
    RETURN;
  END IF;

  -- Students: exam must be published
  IF COALESCE(v_is_published, false) = false THEN
    RAISE EXCEPTION 'Exam is not accessible';
  END IF;

  -- Students: must be actively enrolled in the exam's course
  IF NOT EXISTS (
    SELECT 1 FROM public.course_enrollments ce
     WHERE ce.course_id = v_exam_course
       AND ce.student_id = v_user_id
       AND ce.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Enrollment required to access this exam';
  END IF;

  RETURN QUERY
  SELECT q.id, q.course_id, q.exam_id, q.type, q.content, q.options, q.difficulty, q.points
    FROM public.questions q
   WHERE q.exam_id = p_exam_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_exam_questions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(UUID) TO authenticated;


-- ============================================================
-- 6. UPDATE submit_exam RPC — ENROLLMENT CHECK
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_exam(p_exam_id UUID, p_answers JSONB)
RETURNS JSONB AS $$
DECLARE
  v_student_id    UUID;
  v_role          TEXT;
  v_score         INT := 0;
  v_total         INT := 0;
  v_q             RECORD;
  v_student_ans   TEXT;
  v_result_id     UUID;
  v_exam_course   UUID;
  v_is_published  BOOLEAN;
BEGIN
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) != 'object' THEN
    RAISE EXCEPTION 'Invalid answers format';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_student_id;
  IF v_role != 'student' THEN
    RAISE EXCEPTION 'Only students can submit exams';
  END IF;

  -- Check duplicate submission BEFORE anything else
  IF EXISTS (
    SELECT 1 FROM public.student_results
     WHERE exam_id = p_exam_id
       AND student_id = v_student_id
  ) THEN
    RAISE EXCEPTION 'You have already submitted this exam';
  END IF;

  -- Fetch exam metadata
  SELECT course_id, is_published
    INTO v_exam_course, v_is_published
    FROM public.exams
   WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  IF v_exam_course IS NULL THEN
    RAISE EXCEPTION 'Invalid Exam: course_id is NULL';
  END IF;

  IF COALESCE(v_is_published, false) = false THEN
    RAISE EXCEPTION 'Exam is not active';
  END IF;

  -- Enrollment check: student must be actively enrolled
  IF NOT EXISTS (
    SELECT 1 FROM public.course_enrollments ce
     WHERE ce.course_id = v_exam_course
       AND ce.student_id = v_student_id
       AND ce.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Enrollment required to submit this exam';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE exam_id = p_exam_id) THEN
    RAISE EXCEPTION 'Exam has no questions';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
     WHERE exam_id = p_exam_id
       AND course_id IS DISTINCT FROM v_exam_course
  ) THEN
    RAISE EXCEPTION 'Data integrity error: Exam questions course mismatch';
  END IF;

  -- Grade questions server-side only
  FOR v_q IN
    SELECT q.id, q.type, q.correct_answer, q.points
      FROM public.questions q
     WHERE q.exam_id = p_exam_id
  LOOP
    v_total := v_total + COALESCE(v_q.points, 1);
    v_student_ans := TRIM(p_answers->>v_q.id::text);

    -- NOTE: 'math' grading uses exact string matching (case-insensitive).
    -- Symbolic equivalence (e.g., 'x+1' == '1+x') is NOT evaluated here.
    IF v_student_ans IS NOT NULL AND LOWER(v_student_ans) = LOWER(v_q.correct_answer) THEN
      v_score := v_score + COALESCE(v_q.points, 1);
    END IF;
  END LOOP;

  INSERT INTO public.student_results (exam_id, student_id, score, total_score, answers)
  VALUES (p_exam_id, v_student_id, v_score, v_total, p_answers)
  RETURNING id INTO v_result_id;

  RETURN jsonb_build_object(
    'id',          v_result_id,
    'score',       v_score,
    'total_score', v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.submit_exam(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_exam(UUID, JSONB) TO authenticated;
