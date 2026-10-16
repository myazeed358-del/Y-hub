-- Y-Hub nine-digit public account numbers: YYMM + five-digit monthly sequence.
-- Uses authoritative auth.users.created_at in Asia/Amman, NOT client input.
-- UUIDs remain the database's internal user identifiers.
BEGIN;

CREATE SCHEMA IF NOT EXISTS yhub_internal;
REVOKE ALL ON SCHEMA yhub_internal FROM PUBLIC, anon, authenticated;

-- The monthly counter is locked atomically by INSERT ... ON CONFLICT UPDATE.
CREATE TABLE yhub_internal.user_number_counters (
  period TEXT PRIMARY KEY CHECK (period ~ '^[0-9]{2}(0[1-9]|1[0-2])$'),
  last_sequence INTEGER NOT NULL CHECK (last_sequence BETWEEN 1 AND 99999)
);

-- This is a permanent issuance ledger. NO FK / ON DELETE CASCADE to auth.users.
-- It keeps numbers reserved even after the authentication account is deleted.
CREATE TABLE yhub_internal.user_number_issues (
  auth_user_id UUID NOT NULL,
  auth_created_at TIMESTAMPTZ NOT NULL,
  user_number TEXT NOT NULL UNIQUE CHECK (user_number ~ '^[0-9]{9}$'),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_user_id, auth_created_at)
);

REVOKE ALL ON ALL TABLES IN SCHEMA yhub_internal FROM PUBLIC, anon, authenticated;

-- Hidden implementation: never expose a client-callable allocator RPC.
CREATE FUNCTION yhub_internal.allocate_user_number(
  p_auth_user_id UUID,
  p_auth_created_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing TEXT;
  v_period TEXT;
  v_next INTEGER;
  v_number TEXT;
BEGIN
  IF p_auth_user_id IS NULL OR p_auth_created_at IS NULL THEN
    RAISE EXCEPTION 'An authenticated user and signup timestamp are required';
  END IF;

  SELECT i.user_number INTO v_existing
  FROM yhub_internal.user_number_issues AS i
  WHERE i.auth_user_id = p_auth_user_id
    AND i.auth_created_at = p_auth_created_at;
  IF FOUND THEN
    RETURN v_existing; -- Recreating the same profile is not a new registration.
  END IF;

  v_period := pg_catalog.to_char(
    p_auth_created_at AT TIME ZONE 'Asia/Amman', 'YYMM'
  );

  INSERT INTO yhub_internal.user_number_counters AS c (period, last_sequence)
  VALUES (v_period, 1)
  ON CONFLICT (period) DO UPDATE
    SET last_sequence = c.last_sequence + 1
    WHERE c.last_sequence < 99999
  RETURNING last_sequence INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Monthly Y-Hub account number capacity exceeded for %', v_period
      USING ERRCODE = '22003';
  END IF;

  v_number := v_period || pg_catalog.lpad(v_next::TEXT, 5, '0');
  INSERT INTO yhub_internal.user_number_issues
    (auth_user_id, auth_created_at, user_number)
  VALUES (p_auth_user_id, p_auth_created_at, v_number);

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION yhub_internal.allocate_user_number(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

-- Add the public, immutable number without changing existing UUID references.
ALTER TABLE public.users ADD COLUMN user_number TEXT;

-- Historical accounts receive numbers by actual signup month, in stable order.
-- Never overwrite roles, names, majors, or other profile data.
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT u.id, a.created_at AS registered_at
    FROM public.users AS u
    JOIN auth.users AS a ON a.id = u.id
    ORDER BY a.created_at, u.id
  LOOP
    UPDATE public.users
    SET user_number = yhub_internal.allocate_user_number(
      v_user.id, v_user.registered_at
    )
    WHERE id = v_user.id;
  END LOOP;
END;
$$;

ALTER TABLE public.users ALTER COLUMN user_number SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_user_number_format
  CHECK (user_number ~ '^[0-9]{9}$');
ALTER TABLE public.users ADD CONSTRAINT users_user_number_unique
  UNIQUE (user_number);

CREATE FUNCTION yhub_internal.assign_user_number_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_signup_time TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only server-owned auth.users.created_at is authoritative.
    SELECT a.created_at INTO v_signup_time
    FROM auth.users AS a
    WHERE a.id = NEW.id;

    IF v_signup_time IS NULL THEN
      RAISE EXCEPTION 'Authentication signup timestamp missing for profile';
    END IF;

    -- Ignore any client-supplied or service-supplied number.
    NEW.user_number := yhub_internal.allocate_user_number(
      NEW.id, v_signup_time
    );
  ELSIF NEW.user_number IS DISTINCT FROM OLD.user_number THEN
    RAISE EXCEPTION 'Y-Hub user number is immutable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION yhub_internal.assign_user_number_on_profile()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER assign_yhub_user_number
  BEFORE INSERT OR UPDATE OF user_number
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION yhub_internal.assign_user_number_on_profile();

COMMENT ON COLUMN public.users.user_number IS
  'Immutable nine-digit YYMMNNNNN public number; UUID remains primary key.';

COMMIT;
