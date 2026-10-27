-- Approved decision25. Existing identities/numbers and legacy full_name are preserved.
BEGIN;
ALTER TABLE public.users ADD COLUMN full_name_ar text, ADD COLUMN full_name_en text;

CREATE FUNCTION public.valid_profile_name(p_name text, p_language text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT coalesce(char_length(p_name) BETWEEN 2 AND 120 AND p_name=btrim(p_name) AND
 CASE p_language
 WHEN 'ar' THEN p_name ~ '^[ء-يً-ٰٟ ''.’\-]+$' AND p_name ~ '[ء-غف-ي]'
 WHEN 'en' THEN p_name ~ '^[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ̀-ͯ ''.’\-]+$' AND p_name ~ '[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]'
 ELSE false END, false)
$$;
REVOKE ALL ON FUNCTION public.valid_profile_name(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.valid_profile_name(text,text) TO authenticated,service_role;
ALTER TABLE public.users
 ADD CONSTRAINT users_arabic_name_valid CHECK(full_name_ar IS NULL OR public.valid_profile_name(full_name_ar,'ar')),
 ADD CONSTRAINT users_english_name_valid CHECK(full_name_en IS NULL OR public.valid_profile_name(full_name_en,'en'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_age INTEGER;
  v_ar text := btrim(NEW.raw_user_meta_data->>'full_name_ar');
  v_en text := btrim(NEW.raw_user_meta_data->>'full_name_en');
BEGIN
  IF jsonb_typeof(NEW.raw_user_meta_data->'full_name_ar') IS DISTINCT FROM 'string'
     OR jsonb_typeof(NEW.raw_user_meta_data->'full_name_en') IS DISTINCT FROM 'string'
     OR NOT public.valid_profile_name(v_ar,'ar') OR NOT public.valid_profile_name(v_en,'en') THEN
    RAISE EXCEPTION 'Valid Arabic and English names are required' USING ERRCODE='22023';
  END IF;
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
    full_name_ar,
    full_name_en,
    age,
    major,
    study_year,
    phone,
    role
  )
  VALUES (
    new.id,
    new.email,
    v_ar,
    v_ar,
    v_en,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon,authenticated;

-- Completion only: actor is auth.uid(), no target ID or role input. Retrying identical
-- values is idempotent. Row locks make simultaneous completion first-writer-wins.
CREATE FUNCTION public.complete_own_profile_names(p_ar text DEFAULT NULL,p_en text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user public.users%ROWTYPE; v_ar text:=btrim(p_ar); v_en text:=btrim(p_en);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_user FROM public.users WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found' USING ERRCODE='42501'; END IF;
 IF (p_ar IS NOT NULL AND NOT public.valid_profile_name(v_ar,'ar'))
 OR (p_en IS NOT NULL AND NOT public.valid_profile_name(v_en,'en')) THEN
  RAISE EXCEPTION 'Invalid profile name' USING ERRCODE='22023';
 END IF;
 IF (v_user.full_name_ar IS NOT NULL AND p_ar IS NOT NULL AND v_user.full_name_ar<>v_ar)
 OR (v_user.full_name_en IS NOT NULL AND p_en IS NOT NULL AND v_user.full_name_en<>v_en) THEN
  -- Application conflict, not SQL serialization: do not trigger PostgREST retries.
  RAISE EXCEPTION 'A saved name cannot be replaced through profile completion' USING ERRCODE='PT409';
 END IF;
 IF coalesce(v_user.full_name_ar,v_ar) IS NULL OR coalesce(v_user.full_name_en,v_en) IS NULL THEN
  RAISE EXCEPTION 'Both names must be completed' USING ERRCODE='22023';
 END IF;
 UPDATE public.users SET full_name_ar=coalesce(full_name_ar,v_ar),full_name_en=coalesce(full_name_en,v_en)
 WHERE id=v_user.id AND (full_name_ar IS NULL OR full_name_en IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_own_profile_names(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_own_profile_names(text,text) TO authenticated;
-- Preserve existing self-profile RPC and every table RLS/write privilege. Metadata
-- edits in Auth never synchronize names back into public.users after signup.
COMMIT;
