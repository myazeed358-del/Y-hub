-- Y-Hub Migration 0015
-- AI Tutor usage quota and missing course material grants.
BEGIN;

-- Preserve RLS protection before granting access.
DO $$
BEGIN
  IF NOT (
    SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.course_materials'::regclass
  ) OR NOT (
    SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.course_enrollments'::regclass
  ) THEN
    RAISE EXCEPTION 'Required RLS protection is disabled';
  END IF;
END;
$$;

-- Document permissions previously fixed in Supabase.
GRANT SELECT, INSERT ON TABLE public.course_materials
TO authenticated;

GRANT SELECT ON TABLE public.course_enrollments
TO authenticated;

-- Private quota data: no direct client access.
CREATE TABLE public.ai_tutor_hourly_usage (
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1
    CHECK (request_count BETWEEN 1 AND 10),
  PRIMARY KEY (user_id, window_start)
);

ALTER TABLE public.ai_tutor_hourly_usage
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_tutor_hourly_usage
FROM PUBLIC, anon, authenticated;

-- Atomic usage counter.
-- No user ID is accepted from the client.
CREATE FUNCTION public.consume_ai_tutor_quota()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  new_count INTEGER;
BEGIN
  IF actor_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_tutor_hourly_usage AS usage (
    user_id,
    window_start,
    request_count
  )
  VALUES (
    actor_id,
    date_trunc('hour', now()),
    1
  )
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET
    request_count = usage.request_count + 1
  WHERE usage.request_count < 10
  RETURNING request_count INTO new_count;

  RETURN new_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_tutor_quota()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.consume_ai_tutor_quota()
TO authenticated;

COMMIT;
