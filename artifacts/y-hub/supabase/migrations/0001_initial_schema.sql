-- 1. Create the courses table
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  course_code TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the course_materials table
CREATE TABLE course_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'video', 'link')),
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_materials ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for courses
-- Instructors can perform all actions on their own courses
CREATE POLICY "Instructors can manage their own courses"
  ON courses
  FOR ALL
  USING (auth.uid() = instructor_id);

-- Students can only view published courses
CREATE POLICY "Anyone can view published courses"
  ON courses
  FOR SELECT
  USING (is_published = true OR auth.uid() = instructor_id);

-- 5. RLS Policies for course_materials
-- Instructors can manage materials for their own courses
CREATE POLICY "Instructors can manage materials for their courses"
  ON course_materials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = course_materials.course_id 
      AND courses.instructor_id = auth.uid()
    )
  );

-- Students can view materials of published courses
CREATE POLICY "Students can view materials of published courses"
  ON course_materials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = course_materials.course_id 
      AND (courses.is_published = true OR courses.instructor_id = auth.uid())
    )
  );

-- 6. Storage Bucket for PDF files
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for materials bucket
CREATE POLICY "Anyone can download materials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'materials');

CREATE POLICY "Authenticated users can upload materials"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'materials' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update/delete their own uploads"
  ON storage.objects FOR ALL
  USING (bucket_id = 'materials' AND auth.uid() = owner);
