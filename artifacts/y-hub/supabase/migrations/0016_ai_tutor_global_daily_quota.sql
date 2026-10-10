-- Y-Hub: Global daily AI Tutor quota.
-- Limits: 10 requests/user/hour and 100 requests/platform/day.
BEGIN;

CREATE TABLE public.ai_tutor_daily_usage (
  usage_day DATE PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0
    CHECK (request_count BETWEEN 0 AND 100)
);

ALTER TABLE public.ai_tutor_daily_usage
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_tutor_daily_usage
FROM PUBLIC, anon, authenticated;

-- The Edge Function's service role manages quota counters.
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.ai_tutor_hourly_usage,
  public.ai_tutor_daily_usage
TO service_role;

CREATE FUNCTION public.consume_ai_tutor_quota_for_user(
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := p_user_id;
  current_hour TIMESTAMPTZ := date_trunc('hour', now());
  current_day DATE := (now() AT TIME ZONE 'UTC')::date;
  user_count INTEGER;
  daily_count INTEGER;
BEGIN
  IF actor_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Create daily counter if necessary.
  INSERT INTO public.ai_tutor_daily_usage (
    usage_day, request_count
  )
  VALUES (current_day, 0)
  ON CONFLICT (usage_day) DO NOTHING;

  -- Lock daily row to serialize simultaneous requests.
  SELECT request_count
  INTO daily_count
  FROM public.ai_tutor_daily_usage
  WHERE usage_day = current_day
  FOR UPDATE;

  IF daily_count >= 100 THEN
    RETURN FALSE;
  END IF;

  -- Check individual hourly usage under the daily lock.
  SELECT request_count
  INTO user_count
  FROM public.ai_tutor_hourly_usage
  WHERE user_id = actor_id
    AND window_start = current_hour
  FOR UPDATE;

  IF COALESCE(user_count, 0) >= 10 THEN
    RETURN FALSE;
  END IF;

  IF user_count IS NULL THEN
    INSERT INTO public.ai_tutor_hourly_usage (
      user_id, window_start, request_count
    )
    VALUES (actor_id, current_hour, 1);
  ELSE
    UPDATE public.ai_tutor_hourly_usage
    SET request_count = user_count + 1
    WHERE user_id = actor_id
      AND window_start = current_hour;
  END IF;

  UPDATE public.ai_tutor_daily_usage
  SET request_count = daily_count + 1
  WHERE usage_day = current_day;

  RETURN TRUE;
END;
$$;

-- Remove the client-accessible function created in 0015.
DROP FUNCTION public.consume_ai_tutor_quota();

-- Only the server-side service role may consume quota.
REVOKE ALL ON FUNCTION
  public.consume_ai_tutor_quota_for_user(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.consume_ai_tutor_quota_for_user(UUID)
TO service_role;

COMMIT;
