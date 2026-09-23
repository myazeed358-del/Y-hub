-- 0005_security_hardening_phase5a.sql
-- SECURITY HARDENING - PHASE 5A (v8 - FINAL)

-- ==========================================
-- A. DROP VULNERABLE TRIGGERS & POLICIES
-- ==========================================
DROP TRIGGER IF EXISTS protect_user_role_trigger ON public.users;
DROP FUNCTION IF EXISTS public.protect_user_role();

DROP POLICY IF EXISTS "Anyone can read profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- ==========================================
-- B. DEPENDENCY-AWARE DROP (POLICIES BEFORE FUNCTIONS)
-- ==========================================
-- Storage Policies
DROP POLICY IF EXISTS "Anyone can download materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Users can update/delete their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can select materials" ON storage.objects;
DROP POLICY IF EXISTS "Managers can upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Managers can update own materials" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete own materials" ON storage.objects;

-- Course Policies
DROP POLICY IF EXISTS "Instructors can manage their own courses" ON public.courses;
DROP POLICY IF EXISTS "Managers can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Managers can update courses" ON public.courses;
DROP POLICY IF EXISTS "Managers can delete courses" ON public.courses;

-- Safely drop the helper function WITHOUT CASCADE
DROP FUNCTION IF EXISTS public.auth_can_manage_content();

-- ==========================================
-- C. USERS TABLE: STRICT READ & DIRECT MUTATION SECURITY
-- ==========================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- Defense in depth: Completely block direct table mutations.
-- Users MUST use the provided RPCs for any profile or role changes.
REVOKE INSERT, UPDATE, DELETE ON public.users FROM PUBLIC, authenticated;

-- ==========================================
-- D. SECURE PROFILE UPDATE RPC (STRICT JSONB VALIDATION)
-- ==========================================
DROP FUNCTION IF EXISTS public.update_own_profile(JSONB);

CREATE OR REPLACE FUNCTION public.update_own_profile(p_updates JSONB)
RETURNS void AS $$
DECLARE
  v_key TEXT;
  v_val_type TEXT;
  v_val_text TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_updates IS NULL THEN RAISE EXCEPTION 'Updates payload cannot be null'; END IF;
  IF pg_catalog.jsonb_typeof(p_updates) != 'object' THEN RAISE EXCEPTION 'Updates must be a JSON object'; END IF;

  FOR v_key IN SELECT pg_catalog.jsonb_object_keys(p_updates) LOOP
    -- 1. Strictly Allowed Keys
    IF v_key NOT IN ('major', 'study_year', 'phone') THEN
      RAISE EXCEPTION 'Invalid profile field: %', v_key;
    END IF;

    -- 2. Strictly Allowed Types (Reject Arrays, Objects, Booleans, Numbers)
    v_val_type := pg_catalog.jsonb_typeof(p_updates->v_key);
    IF v_val_type NOT IN ('null', 'string') THEN
      RAISE EXCEPTION 'Invalid value type for field %: expected string or null, got %', v_key, v_val_type;
    END IF;

    -- 3. Length Boundaries
    -- NOTE: public.users schema defines these columns as unbounded TEXT.
    -- The length limits below (50 and 255) are intentional application-level 
    -- constraints applied here to prevent malicious oversized payloads.
    IF v_val_type = 'string' THEN
      v_val_text := p_updates->>v_key;
      IF v_key = 'phone' AND pg_catalog.length(v_val_text) > 50 THEN
        RAISE EXCEPTION 'Value for phone exceeds application maximum length of 50 characters';
      ELSIF pg_catalog.length(v_val_text) > 255 THEN
        RAISE EXCEPTION 'Value for % exceeds application maximum length of 255 characters', v_key;
      END IF;
    END IF;
  END LOOP;

  -- 4. Apply Updates
  -- SEMANTICS:
  -- Omitted Key   = Preserve existing value (via ELSE existing_column).
  -- Explicit NULL = Intentionally clear the value (JSON null converts to SQL NULL).
  UPDATE public.users 
  SET 
    major = CASE WHEN p_updates ? 'major' THEN (p_updates->>'major')::TEXT ELSE major END,
    study_year = CASE WHEN p_updates ? 'study_year' THEN (p_updates->>'study_year')::TEXT ELSE study_year END,
    phone = CASE WHEN p_updates ? 'phone' THEN (p_updates->>'phone')::TEXT ELSE phone END
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.update_own_profile(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_profile(JSONB) TO authenticated;

-- ==========================================
-- E. SECURE ROLE MANAGEMENT RPC (WITH CONCURRENCY LOCK)
-- ==========================================
DROP FUNCTION IF EXISTS public.admin_set_user_role(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id UUID, p_new_role TEXT)
RETURNS void AS $$
DECLARE
  v_admin_role TEXT;
  v_target_role TEXT;
  v_super_admin_count INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role INTO v_admin_role FROM public.users WHERE id = auth.uid();
  IF v_admin_role NOT IN ('admin', 'super_admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT role INTO v_target_role FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target user not found'; END IF;

  IF p_new_role NOT IN ('student', 'instructor', 'admin', 'super_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  
  -- Hierarchy Rules
  IF v_target_role = 'super_admin' AND v_admin_role != 'super_admin' THEN RAISE EXCEPTION 'Cannot modify a super_admin'; END IF;
  IF p_new_role = 'super_admin' AND v_admin_role != 'super_admin' THEN RAISE EXCEPTION 'Only super_admin can grant super_admin'; END IF;
  IF v_target_role = 'admin' AND v_admin_role = 'admin' THEN RAISE EXCEPTION 'Admin cannot modify another admin'; END IF;
  
  -- Strict block: Admin cannot promote ANYONE to an administrative role
  IF v_admin_role = 'admin' AND p_new_role IN ('admin', 'super_admin') THEN 
    RAISE EXCEPTION 'Admin cannot grant administrative roles'; 
  END IF;

  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot modify own role via this function'; END IF;

  -- Transaction-level Advisory Lock
  IF v_target_role = 'super_admin' AND p_new_role != 'super_admin' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('super_admin_role_lock'));
    SELECT COUNT(*) INTO v_super_admin_count FROM public.users WHERE role = 'super_admin';
    IF v_super_admin_count <= 1 THEN RAISE EXCEPTION 'Cannot remove the last super_admin'; END IF;
  END IF;

  UPDATE public.users SET role = p_new_role WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;

-- ==========================================
-- F. AUTHORIZATION HELPER
-- ==========================================
CREATE OR REPLACE FUNCTION public.auth_can_manage_content() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('instructor', 'admin', 'super_admin'));
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.auth_can_manage_content() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can_manage_content() TO authenticated;

-- ==========================================
-- G. STORAGE POLICIES (MATERIALS BUCKET)
-- ==========================================
-- ! IMPORTANT STORAGE PRIVACY WARNING !
-- The 'materials' bucket is INTENTIONALLY PUBLIC.
-- Anyone possessing a valid file URL may retrieve that file.
-- The bucket MUST contain only non-sensitive educational materials.
-- Exam answer keys, private instructor files, administrative files, 
-- and other sensitive assets MUST NEVER be stored in this bucket.
-- Converting to private is explicitly out of scope for Phase 5A and 
-- would require frontend changes to authenticated downloads or signed URLs.

CREATE POLICY "Authenticated users can select materials" ON storage.objects FOR SELECT USING (bucket_id = 'materials' AND auth.role() = 'authenticated');

CREATE POLICY "Managers can upload materials" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'materials' 
    AND (select public.auth_can_manage_content()) 
    AND owner_id = (select auth.uid()::text)
  );

CREATE POLICY "Managers can update own materials" ON storage.objects 
  FOR UPDATE USING (
    bucket_id = 'materials' 
    AND (select public.auth_can_manage_content()) 
    AND owner_id = (select auth.uid()::text)
  );

CREATE POLICY "Managers can delete own materials" ON storage.objects 
  FOR DELETE USING (
    bucket_id = 'materials' 
    AND (select public.auth_can_manage_content()) 
    AND owner_id = (select auth.uid()::text)
  );

-- ==========================================
-- H. COURSES TABLE OWNERSHIP HARDENING
-- ==========================================
CREATE POLICY "Managers can insert courses" ON public.courses 
  FOR INSERT WITH CHECK (
    instructor_id = auth.uid() 
    AND (select public.auth_can_manage_content())
  );

CREATE POLICY "Managers can update courses" ON public.courses 
  FOR UPDATE USING (
    instructor_id = auth.uid() 
    AND (select public.auth_can_manage_content())
  ) WITH CHECK (
    instructor_id = auth.uid() 
    AND (select public.auth_can_manage_content())
  );

CREATE POLICY "Managers can delete courses" ON public.courses 
  FOR DELETE USING (
    instructor_id = auth.uid() 
    AND (select public.auth_can_manage_content())
  );
