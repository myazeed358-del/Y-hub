-- 1. Create exams table
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time_limit_minutes INT DEFAULT 30,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create questions table (Question Bank linked to exams)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'tf', 'math')),
  content TEXT NOT NULL,
  options JSONB, -- Array of strings for MCQ
  correct_answer TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  points INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create student_results table
CREATE TABLE student_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  score INT NOT NULL,
  total_score INT NOT NULL,
  answers JSONB, -- Student's submitted answers
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_results ENABLE ROW LEVEL SECURITY;

-- 5. Policies for exams
CREATE POLICY "Instructors manage their course exams" ON exams
  FOR ALL USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = exams.course_id AND courses.instructor_id = auth.uid()));

CREATE POLICY "Students can view published exams" ON exams
  FOR SELECT USING (is_published = true OR EXISTS (SELECT 1 FROM courses WHERE courses.id = exams.course_id AND courses.instructor_id = auth.uid()));

-- 6. Policies for questions
CREATE POLICY "Instructors manage their course questions" ON questions
  FOR ALL USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = questions.course_id AND courses.instructor_id = auth.uid()));

CREATE POLICY "Students view questions of published exams" ON questions
  FOR SELECT USING (EXISTS (SELECT 1 FROM exams WHERE exams.id = questions.exam_id AND exams.is_published = true));

-- 7. Policies for student_results
CREATE POLICY "Students insert their own results" ON student_results
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students view their own results" ON student_results
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Instructors view results for their courses" ON student_results
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM exams 
    JOIN courses ON courses.id = exams.course_id 
    WHERE exams.id = student_results.exam_id AND courses.instructor_id = auth.uid()
  ));
