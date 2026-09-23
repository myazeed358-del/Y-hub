-- ==========================================
-- SECURITY & STABILITY MIGRATION (FINAL v6)
-- ==========================================

-- 1. UNIFY ROLES & AUTO-PROFILE CREATION
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin', 'super_admin'));
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- Drop user_roles without CASCADE (checked manually: no dependencies).
DROP TABLE IF EXISTS public.user_roles;

-- Auto-profile trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''), 'Student'), 
    'student'
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = COALESCE(EXCLUDED.email, public.users.email),
    -- Update full_name if provided, strictly PRESERVE existing role
    full_name = COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''), public.users.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. SCHEMA SAFEY & POINTS VALIDATION
-- Ensure 'difficulty' column exists so get_exam_questions doesn't fail.
ALTER TABLE IF EXISTS public.questions ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_points_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_points_check CHECK (points IS NULL OR points > 0);


-- 3. DEDUPLICATE RESULTS & ENFORCE UNIQUE CONSTRAINT
-- We block the migration if duplicates exist. Deduplication must be manual via ctid.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.student_results GROUP BY exam_id, student_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration halted: Duplicates found in public.student_results. Please run manual deduplication using ctid first.';
  END IF;
END $$;

ALTER TABLE public.student_results DROP CONSTRAINT IF EXISTS student_results_exam_student_unique;
ALTER TABLE public.student_results ADD CONSTRAINT student_results_exam_student_unique UNIQUE (exam_id, student_id);


-- 4. FIX QUIZ ANSWERS LEAK
DROP POLICY IF EXISTS "Students view questions of published exams" ON public.questions;
DROP POLICY IF EXISTS "Students insert their own results" ON public.student_results;

-- Secure RPC for fetching questions safely (omits correct_answer)
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_exam_id UUID)
RETURNS TABLE (
  id UUID,
  course_id UUID,
  exam_id UUID,
  type TEXT,
  content TEXT,
  options JSONB,
  difficulty TEXT,
  points INT
) AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User profile/role not found';
  END IF;

  -- NOTE: Currently there is no `course_enrollments` table. 
  -- Therefore, ANY student can access the questions of ANY published exam.
  IF NOT EXISTS (
    SELECT 1 FROM public.exams e
    LEFT JOIN public.courses c ON c.id = e.course_id
    WHERE e.id = p_exam_id AND (e.is_published = true OR c.instructor_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Exam not accessible';
  END IF;

  RETURN QUERY
  SELECT q.id, q.course_id, q.exam_id, q.type, q.content, q.options, q.difficulty, q.points
  FROM public.questions q
  WHERE q.exam_id = p_exam_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_exam_questions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(UUID) TO authenticated;


-- 5. SECURE GRADING RPC
CREATE OR REPLACE FUNCTION public.submit_exam(p_exam_id UUID, p_answers JSONB)
RETURNS JSONB AS $$
DECLARE
  v_student_id UUID;
  v_role TEXT;
  v_score INT := 0;
  v_total INT := 0;
  v_q RECORD;
  v_student_ans TEXT;
  v_result_id UUID;
  v_exam_course_id UUID;
  v_is_published BOOLEAN;
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
    SELECT 1
    FROM public.student_results
    WHERE exam_id = p_exam_id
      AND student_id = v_student_id
  ) THEN
    RAISE EXCEPTION 'You have already submitted this exam';
  END IF;

  -- Validation: Verify exam exists
  SELECT course_id, is_published INTO v_exam_course_id, v_is_published FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  IF v_exam_course_id IS NULL THEN
    RAISE EXCEPTION 'Invalid Exam: course_id is NULL';
  END IF;

  -- Check if exam is published, rejecting NULLs safely
  IF COALESCE(v_is_published, false) = false THEN
    RAISE EXCEPTION 'Exam is not active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE exam_id = p_exam_id) THEN
    RAISE EXCEPTION 'Exam has no questions';
  END IF;

  IF EXISTS (SELECT 1 FROM public.questions WHERE exam_id = p_exam_id AND course_id IS DISTINCT FROM v_exam_course_id) THEN
    RAISE EXCEPTION 'Data integrity error: Exam questions course mismatch';
  END IF;

  -- Grade questions strictly within the server
  FOR v_q IN SELECT q.id, q.type, q.correct_answer, q.points FROM public.questions q WHERE q.exam_id = p_exam_id LOOP
    v_total := v_total + COALESCE(v_q.points, 1);
    v_student_ans := TRIM(p_answers->>v_q.id::text);
    
    -- NOTE ON GRADING LOGIC:
    -- 'mcq' and 'tf' rely on identical string matches.
    -- 'math' grading currently uses EXACT STRING MATCHING (LOWER + TRIM).
    -- It does NOT perform symbolic equivalence (e.g., 'x+1' is NOT equal to '1+x' here).
    IF v_student_ans IS NOT NULL AND LOWER(v_student_ans) = LOWER(v_q.correct_answer) THEN
      v_score := v_score + COALESCE(v_q.points, 1);
    END IF;
  END LOOP;

  -- Insert result (relying on UNIQUE constraint added earlier as a secondary defense layer)
  INSERT INTO public.student_results (exam_id, student_id, score, total_score, answers)
  VALUES (p_exam_id, v_student_id, v_score, v_total, p_answers)
  RETURNING id INTO v_result_id;

  RETURN jsonb_build_object(
    'id', v_result_id,
    'score', v_score,
    'total_score', v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.submit_exam(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_exam(UUID, JSONB) TO authenticated;
