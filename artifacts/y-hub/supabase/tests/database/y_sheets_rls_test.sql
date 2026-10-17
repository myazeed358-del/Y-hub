BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

SELECT has_table(
  'public', 'y_sheets_workbooks',
  'Y-Sheets table exists'
);

SELECT ok(
  (SELECT relrowsecurity
   FROM pg_class
   WHERE oid = 'public.y_sheets_workbooks'::regclass),
  'RLS is enabled'
);

-- Test identities exist only inside this transaction.
INSERT INTO auth.users (id, email, aud, role) VALUES
(
  '11111111-1111-4111-8111-111111111111',
  'ysheets-a@example.invalid',
  'authenticated',
  'authenticated'
),
(
  '22222222-2222-4222-8222-222222222222',
  'ysheets-b@example.invalid',
  'authenticated',
  'authenticated'
);

INSERT INTO public.y_sheets_workbooks
  (id, owner_id, name, content)
VALUES
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Alice Workbook',
  '{"sheets":[],"activeSheetId":"sheet-1"}'::jsonb
),
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'Bob Workbook',
  '{"sheets":[],"activeSheetId":"sheet-1"}'::jsonb
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

SELECT is(
  (SELECT count(*) FROM public.y_sheets_workbooks),
  1::bigint,
  'Alice sees only her workbook'
);

SELECT is(
  (SELECT count(*) FROM public.y_sheets_workbooks
   WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0::bigint,
  'Alice cannot read Bob workbook'
);

SELECT lives_ok(
  $$UPDATE public.y_sheets_workbooks
    SET name = 'Alice Updated', revision = 2
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'Alice can edit her workbook'
);

SELECT is(
  (SELECT revision FROM public.y_sheets_workbooks
   WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  2::bigint,
  'Revision advances'
);

SELECT is(
  (WITH attempted AS (
    UPDATE public.y_sheets_workbooks
    SET name = 'Stale Edit', revision = 3
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND revision = 1
    RETURNING id
  )
  SELECT count(*) FROM attempted),
  0::bigint,
  'Stale revision cannot overwrite current revision'
);

SELECT throws_ok(
  $$UPDATE public.y_sheets_workbooks
    SET revision = 99
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$
);

SELECT throws_ok(
  $$UPDATE public.y_sheets_workbooks
    SET owner_id = '22222222-2222-4222-8222-222222222222',
        revision = 3
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$
);

SELECT is(
  (WITH attempted AS (
    UPDATE public.y_sheets_workbooks
    SET name = 'Unauthorized', revision = 2
    WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    RETURNING id
  )
  SELECT count(*) FROM attempted),
  0::bigint,
  'Alice cannot edit Bob workbook'
);

SELECT is(
  (WITH attempted AS (
    DELETE FROM public.y_sheets_workbooks
    WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    RETURNING id
  )
  SELECT count(*) FROM attempted),
  0::bigint,
  'Alice cannot delete Bob workbook'
);

SELECT throws_ok(
  $$INSERT INTO public.y_sheets_workbooks
    (owner_id, name, content)
    VALUES (
      '22222222-2222-4222-8222-222222222222',
      'Unauthorized',
      '{"sheets":[],"activeSheetId":"sheet-1"}'::jsonb
    )$$
);

SELECT set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

SELECT is(
  (SELECT count(*) FROM public.y_sheets_workbooks),
  1::bigint,
  'Bob sees his own workbook'
);

SELECT is(
  (SELECT count(*) FROM public.y_sheets_workbooks
   WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'Bob cannot read Alice workbook'
);

SELECT * FROM finish();

ROLLBACK;
