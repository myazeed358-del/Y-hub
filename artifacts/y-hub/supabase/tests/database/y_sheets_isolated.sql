BEGIN;

-- Create two isolated test accounts.
INSERT INTO auth.users (id) VALUES
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222');

INSERT INTO public.y_sheets_workbooks
  (id, owner_id, name, content)
VALUES
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Alice Workbook',
  '{"sheets":[],"activeSheetId":"s1"}'
),
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'Bob Workbook',
  '{"sheets":[],"activeSheetId":"s1"}'
);

SELECT test.expect(
  to_regclass('public.y_sheets_workbooks') IS NOT NULL,
  '01 - Workbook table exists'
);

SELECT test.expect(
  (SELECT relrowsecurity
   FROM pg_class
   WHERE oid = 'public.y_sheets_workbooks'::regclass),
  '02 - RLS enabled'
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

SELECT test.expect(
  (SELECT count(*) FROM public.y_sheets_workbooks) = 1,
  '03 - Alice sees only her workbook'
);

SELECT test.expect(
  (SELECT count(*) FROM public.y_sheets_workbooks
   WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 0,
  '04 - Alice cannot read Bob workbook'
);

WITH changed AS (
  UPDATE public.y_sheets_workbooks
  SET name = 'Alice Updated', revision = 2
  WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  RETURNING id
)
SELECT test.expect(
  (SELECT count(*) FROM changed) = 1,
  '05 - Alice can update her workbook'
);

SELECT test.expect(
  (SELECT revision FROM public.y_sheets_workbooks
   WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 2,
  '06 - Revision increments'
);

WITH changed AS (
  UPDATE public.y_sheets_workbooks
  SET revision = 3
  WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND revision = 1
  RETURNING id
)
SELECT test.expect(
  (SELECT count(*) FROM changed) = 0,
  '07 - Stale revision cannot overwrite'
);

DO $$
BEGIN
  BEGIN
    UPDATE public.y_sheets_workbooks
    SET revision = 99
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    RAISE EXCEPTION 'FAIL 08 - Invalid revision accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 08 - Invalid revision rejected';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.y_sheets_workbooks
    SET owner_id = '22222222-2222-4222-8222-222222222222',
        revision = 3
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    RAISE EXCEPTION 'FAIL 09 - Ownership changed';
  EXCEPTION
    WHEN check_violation OR insufficient_privilege THEN
      RAISE NOTICE 'PASS 09 - Ownership change rejected';
  END;
END;
$$;

WITH changed AS (
  UPDATE public.y_sheets_workbooks
  SET name = 'Unauthorized', revision = 2
  WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  RETURNING id
)
SELECT test.expect(
  (SELECT count(*) FROM changed) = 0,
  '10 - Alice cannot update Bob workbook'
);

WITH deleted AS (
  DELETE FROM public.y_sheets_workbooks
  WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  RETURNING id
)
SELECT test.expect(
  (SELECT count(*) FROM deleted) = 0,
  '11 - Alice cannot delete Bob workbook'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.y_sheets_workbooks
      (owner_id, name, content)
    VALUES (
      '22222222-2222-4222-8222-222222222222',
      'Unauthorized',
      '{"sheets":[],"activeSheetId":"s1"}'
    );

    RAISE EXCEPTION 'FAIL 12 - Foreign ownership insert accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 12 - Foreign ownership insert rejected';
  END;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

SELECT test.expect(
  (SELECT count(*) FROM public.y_sheets_workbooks) = 1,
  '13 - Bob sees his workbook'
);

SELECT test.expect(
  (SELECT count(*) FROM public.y_sheets_workbooks
   WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0,
  '14 - Bob cannot read Alice workbook'
);

ROLLBACK;
