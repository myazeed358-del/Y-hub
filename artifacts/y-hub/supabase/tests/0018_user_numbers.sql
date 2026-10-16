-- Optional staging/local smoke test AFTER migration 0018.
-- Every change in this test is rolled back, including counter allocations.
-- Run with psql -v ON_ERROR_STOP=1 -f supabase/tests/0018_user_numbers.sql
BEGIN;

DO $$
DECLARE
  v_a UUID := pg_catalog.gen_random_uuid();
  v_b UUID := pg_catalog.gen_random_uuid();
  v_a1 TEXT;
  v_a_repeat TEXT;
  v_b1 TEXT;
  v_a_next_month TEXT;
  v_profile UUID;
  v_error_message TEXT;
BEGIN
  v_a1 := yhub_internal.allocate_user_number(
    v_a, '2026-10-31 20:59:59+00'::TIMESTAMPTZ
  );
  v_a_repeat := yhub_internal.allocate_user_number(
    v_a, '2026-10-31 20:59:59+00'::TIMESTAMPTZ
  );
  v_b1 := yhub_internal.allocate_user_number(
    v_b, '2026-10-31 20:59:59+00'::TIMESTAMPTZ
  );
  v_a_next_month := yhub_internal.allocate_user_number(
    v_a, '2026-10-31 21:00:00+00'::TIMESTAMPTZ
  );

  IF v_a1 !~ '^2610[0-9]{5}$'
     OR v_b1 !~ '^2610[0-9]{5}$'
     OR v_a_next_month !~ '^2611[0-9]{5}$'
     OR v_a_repeat IS DISTINCT FROM v_a1
     OR v_a1 = v_b1
     OR RIGHT(v_b1, 5)::INTEGER <> RIGHT(v_a1, 5)::INTEGER + 1
  THEN
    RAISE EXCEPTION 'Allocation uniqueness, date, or idempotence test failed';
  END IF;

  IF (SELECT COUNT(*) FROM public.users WHERE user_number IS NULL) <> 0
     OR (SELECT COUNT(DISTINCT user_number) FROM public.users)
        <> (SELECT COUNT(*) FROM public.users)
  THEN
    RAISE EXCEPTION 'Existing profile backfill test failed';
  END IF;

  -- If there is an existing profile, its number must be immutable.
  SELECT id INTO v_profile FROM public.users LIMIT 1;
  IF v_profile IS NOT NULL THEN
    BEGIN
      UPDATE public.users SET user_number = '000000000'
      WHERE id = v_profile;
      RAISE EXCEPTION 'Immutability trigger did not reject mutation';
    EXCEPTION WHEN SQLSTATE '23514' THEN
      GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
      IF v_error_message <> 'Y-Hub user number is immutable' THEN
        RAISE EXCEPTION 'Wrong constraint caught in immutability test';
      END IF;
    END;
  END IF;
END;
$$;

ROLLBACK;
