-- ====================================================================
-- 0007_storage_security.sql
-- ENROLLMENT-AWARE STORAGE POLICIES
-- ====================================================================

-- Drop the overly permissive SELECT policy from Phase 5A
DROP POLICY IF EXISTS "Authenticated users can select materials" ON storage.objects;

-- Create enrollment-aware read policy
CREATE POLICY "Enrollment-aware select materials" ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'materials' 
  AND auth.role() = 'authenticated'
  AND (
    -- 1. User is the uploader/owner of the file
    owner_id = (select auth.uid()::text)
    
    OR
    
    -- 2. User is an admin or super_admin
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
    
    OR
    
    -- 3. User is an actively enrolled student in the course that contains this material.
    -- We map the storage object's name (filename) to the end of the URL stored in course_materials.
    EXISTS (
      SELECT 1 
      FROM public.course_materials cm
      JOIN public.course_enrollments ce ON cm.course_id = ce.course_id
      WHERE ce.student_id = auth.uid()
      AND ce.status = 'active'
      AND length(storage.objects.name) > 0
      AND right(cm.url, length(storage.objects.name)) = storage.objects.name
    )
  )
);
