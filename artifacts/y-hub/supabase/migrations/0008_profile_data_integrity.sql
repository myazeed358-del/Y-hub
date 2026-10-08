-- ====================================================================
-- 0008_profile_data_integrity.sql
-- Complete profile persistence and secure self-service profile updates
-- ====================================================================

-- --------------------------------------------------------------------
-- A. Add age as a first-class profile field
-- --------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS age INTEGER;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_age_check
    CHECK (age IS NULL OR age BETWEEN 13 AND 120);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;


-- --------------------------------------------------------------------
-- B. Persist all supported signup metadata into public.users
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_age INTEGER;
BEGIN
  -- Parse age defensively. Invalid metadata must never break signup.
  BEGIN
    v_age := NULLIF(TRIM(new.raw_user_meta_data->>'age'), '')::INTEGER;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      v_age := NULL;
  END;

  IF v_age IS NOT NULL AND (v_age < 13 OR v_age > 120) THEN
    v_age := NULL;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    full_name,
    age,
    major,
    study_year,
    phone,
    role
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(
      NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
      'Student'
    ),
    v_age,
    NULLIF(TRIM(new.raw_user_meta_data->>'major'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'study_year'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'phone'), ''),
    'student'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.users.email),
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
    age = COALESCE(public.users.age, EXCLUDED.age),
    major = COALESCE(public.users.major, EXCLUDED.major),
    study_year = COALESCE(public.users.study_year, EXCLUDED.study_year),
    phone = COALESCE(public.users.phone, EXCLUDED.phone);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;


-- --------------------------------------------------------------------
-- C. Backfill existing profiles from auth signup metadata
--    Only missing values are filled; existing profile data is preserved.
-- --------------------------------------------------------------------
UPDATE public.users AS u
SET
  age = COALESCE(
    u.age,
    CASE
      WHEN TRIM(a.raw_user_meta_data->>'age') ~ '^[0-9]{1,3}$'
      THEN
        CASE
          WHEN (TRIM(a.raw_user_meta_data->>'age'))::INTEGER BETWEEN 13 AND 120
          THEN (TRIM(a.raw_user_meta_data->>'age'))::INTEGER
          ELSE NULL
        END
      ELSE NULL
    END
  ),
  major = COALESCE(
    NULLIF(TRIM(u.major), ''),
    NULLIF(TRIM(a.raw_user_meta_data->>'major'), '')
  ),
  study_year = COALESCE(
    NULLIF(TRIM(u.study_year), ''),
    NULLIF(TRIM(a.raw_user_meta_data->>'study_year'), '')
  ),
  phone = COALESCE(
    NULLIF(TRIM(u.phone), ''),
    NULLIF(TRIM(a.raw_user_meta_data->>'phone'), '')
  )
FROM auth.users AS a
WHERE u.id = a.id;


-- --------------------------------------------------------------------
-- D. Secure profile update RPC
--
-- Students may update:
--   age
--   study_year
--   phone
--
-- major is intentionally NOT self-editable because engine access is
-- determined by the verified academic major.
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_own_profile(JSONB);

CREATE OR REPLACE FUNCTION public.update_own_profile(p_updates JSONB)
RETURNS void AS $$
DECLARE
  v_key TEXT;
  v_val_type TEXT;
  v_val_text TEXT;
  v_age NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_updates IS NULL THEN
    RAISE EXCEPTION 'Updates payload cannot be null';
  END IF;

  IF pg_catalog.jsonb_typeof(p_updates) != 'object' THEN
    RAISE EXCEPTION 'Updates must be a JSON object';
  END IF;

  FOR v_key IN SELECT pg_catalog.jsonb_object_keys(p_updates)
  LOOP
    IF v_key NOT IN ('age', 'study_year', 'phone') THEN
      RAISE EXCEPTION 'Invalid profile field: %', v_key;
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

        IF v_key = 'phone' AND pg_catalog.length(v_val_text) > 50 THEN
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
      WHEN p_updates ? 'study_year'
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
