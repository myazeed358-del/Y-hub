-- Study year belongs to student accounts only.
-- Instructor, admin and super_admin accounts must never retain study_year.

-- Clean existing non-student profiles.
UPDATE public.users
SET study_year = NULL
WHERE role IS DISTINCT FROM 'student'
  AND study_year IS NOT NULL;

-- Keep the invariant true for future role/profile changes.
CREATE OR REPLACE FUNCTION public.enforce_student_only_study_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM 'student' THEN
    NEW.study_year := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_only_study_year
ON public.users;

CREATE TRIGGER enforce_student_only_study_year
BEFORE INSERT OR UPDATE
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_student_only_study_year();

-- Replace profile update RPC with role-aware study_year protection.
DROP FUNCTION IF EXISTS public.update_own_profile(JSONB);

CREATE OR REPLACE FUNCTION public.update_own_profile(p_updates JSONB)
RETURNS void AS $$
DECLARE
  v_key TEXT;
  v_val_type TEXT;
  v_val_text TEXT;
  v_age NUMERIC;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role
  INTO v_role
  FROM public.users
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_updates IS NULL THEN
    RAISE EXCEPTION 'Updates payload cannot be null';
  END IF;

  IF pg_catalog.jsonb_typeof(p_updates) != 'object' THEN
    RAISE EXCEPTION 'Updates must be a JSON object';
  END IF;

  FOR v_key IN
    SELECT pg_catalog.jsonb_object_keys(p_updates)
  LOOP
    IF v_key NOT IN ('age', 'study_year', 'phone') THEN
      RAISE EXCEPTION 'Invalid profile field: %', v_key;
    END IF;

    IF v_key = 'study_year'
       AND v_role IS DISTINCT FROM 'student' THEN
      RAISE EXCEPTION
        'Study year is only available for student accounts';
    END IF;

    v_val_type := pg_catalog.jsonb_typeof(p_updates->v_key);

    IF v_key = 'age' THEN
      IF v_val_type NOT IN ('null', 'number') THEN
        RAISE EXCEPTION
          'Invalid value type for age: expected number or null, got %',
          v_val_type;
      END IF;

      IF v_val_type = 'number' THEN
        v_age := (p_updates->>v_key)::NUMERIC;

        IF v_age <> pg_catalog.trunc(v_age) THEN
          RAISE EXCEPTION 'Age must be an integer';
        END IF;

        IF v_age < 13 OR v_age > 120 THEN
          RAISE EXCEPTION 'Age must be between 13 and 120';
        END IF;
      END IF;
    ELSE
      IF v_val_type NOT IN ('null', 'string') THEN
        RAISE EXCEPTION
          'Invalid value type for field %: expected string or null, got %',
          v_key,
          v_val_type;
      END IF;

      IF v_val_type = 'string' THEN
        v_val_text := p_updates->>v_key;

        IF v_key = 'phone'
           AND pg_catalog.length(v_val_text) > 50 THEN
          RAISE EXCEPTION
            'Value for phone exceeds application maximum length of 50 characters';
        ELSIF pg_catalog.length(v_val_text) > 255 THEN
          RAISE EXCEPTION
            'Value for % exceeds application maximum length of 255 characters',
            v_key;
        END IF;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.users
  SET
    age = CASE
      WHEN p_updates ? 'age'
      THEN (p_updates->>'age')::INTEGER
      ELSE age
    END,
    study_year = CASE
      WHEN v_role = 'student'
       AND p_updates ? 'study_year'
      THEN NULLIF(TRIM(p_updates->>'study_year'), '')
      ELSE study_year
    END,
    phone = CASE
      WHEN p_updates ? 'phone'
      THEN NULLIF(TRIM(p_updates->>'phone'), '')
      ELSE phone
    END
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.update_own_profile(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_profile(JSONB) TO authenticated;
