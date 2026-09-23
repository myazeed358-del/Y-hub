-- ====================================================================
-- 0004_users_security.sql
-- SECURE USERS TABLE AND PREVENT ROLE TAMPERING
-- ====================================================================

-- 1. Ensure the users table exists (in case it was created ad-hoc)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin', 'super_admin')),
  major TEXT,
  study_year TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Drop any potentially insecure policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;

-- 4. Create safe policies
-- Everyone can read profiles (needed for showing instructor names, etc.)
CREATE POLICY "Anyone can read profiles" 
  ON public.users 
  FOR SELECT 
  USING (true);

-- Users can update their own profile, BUT we will protect the 'role' column via a trigger
CREATE POLICY "Users can update own profile" 
  ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id);

-- 5. Trigger to prevent users from escalating their own role
CREATE OR REPLACE FUNCTION public.protect_user_role()
RETURNS trigger AS $$
BEGIN
  -- If the role is being changed
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Check if the current user is a super_admin or admin
    -- We also allow changes if auth.uid() IS NULL (meaning the query is run directly from Supabase Dashboard / service_role)
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    ) THEN
      -- Revert the role change silently
      NEW.role := OLD.role;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS protect_user_role_trigger ON public.users;
CREATE TRIGGER protect_user_role_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_user_role();
