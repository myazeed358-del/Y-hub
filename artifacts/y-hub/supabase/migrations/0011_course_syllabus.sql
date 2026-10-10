-- ============================================================
-- Y HUB — COURSE SYLLABUS SYSTEM
-- Migration 0011
-- Supports Manual Entry and AI Parser
-- Stores syllabus structure only — no AI-generated lessons
-- ============================================================

-- 1. Course syllabus source
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS syllabus_source TEXT
NOT NULL DEFAULT 'manual'
CHECK (syllabus_source IN ('manual', 'ai'));
-- 2. Syllabus Units
CREATE TABLE public.syllabus_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    course_id UUID NOT NULL
        REFERENCES public.courses(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),

    sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 3. Syllabus Sections
CREATE TABLE public.syllabus_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    unit_id UUID NOT NULL
        REFERENCES public.syllabus_units(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),

    sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 4. Indexes
CREATE INDEX idx_syllabus_units_course
ON public.syllabus_units(course_id, sort_order);
CREATE INDEX idx_syllabus_sections_unit
ON public.syllabus_sections(unit_id, sort_order);
-- 5. Enable RLS
ALTER TABLE public.syllabus_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_sections ENABLE ROW LEVEL SECURITY;
-- 6. Instructor manages own units
CREATE POLICY "Instructor manages syllabus units"
ON public.syllabus_units
FOR ALL TO authenticated
USING (
    public.auth_can_manage_content()
    AND EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = syllabus_units.course_id
        AND c.instructor_id = auth.uid()
    )
)
WITH CHECK (
    public.auth_can_manage_content()
    AND EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = syllabus_units.course_id
        AND c.instructor_id = auth.uid()
    )
);
-- 7. Students read enrolled course units
CREATE POLICY "Students read syllabus units"
ON public.syllabus_units
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.courses c
        JOIN public.course_enrollments ce
            ON ce.course_id = c.id
        WHERE c.id = syllabus_units.course_id
        AND c.is_published = true
        AND ce.student_id = auth.uid()
        AND ce.status = 'active'
    )
);
-- 8. Instructor manages own sections
CREATE POLICY "Instructor manages syllabus sections"
ON public.syllabus_sections
FOR ALL TO authenticated
USING (
    public.auth_can_manage_content()
    AND EXISTS (
        SELECT 1
        FROM public.syllabus_units u
        JOIN public.courses c ON c.id = u.course_id
        WHERE u.id = syllabus_sections.unit_id
        AND c.instructor_id = auth.uid()
    )
)
WITH CHECK (
    public.auth_can_manage_content()
    AND EXISTS (
        SELECT 1
        FROM public.syllabus_units u
        JOIN public.courses c ON c.id = u.course_id
        WHERE u.id = syllabus_sections.unit_id
        AND c.instructor_id = auth.uid()
    )
);
-- 9. Students read enrolled course sections
CREATE POLICY "Students read syllabus sections"
ON public.syllabus_sections
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.syllabus_units u
        JOIN public.courses c ON c.id = u.course_id
        JOIN public.course_enrollments ce
            ON ce.course_id = c.id
        WHERE u.id = syllabus_sections.unit_id
        AND c.is_published = true
        AND ce.student_id = auth.uid()
        AND ce.status = 'active'
    )
);
-- 10. Database permissions
REVOKE ALL ON public.syllabus_units FROM PUBLIC, anon;
REVOKE ALL ON public.syllabus_sections FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.syllabus_units, public.syllabus_sections
TO authenticated;
-- ============================================================
-- END OF MIGRATION 0011
-- ============================================================;
