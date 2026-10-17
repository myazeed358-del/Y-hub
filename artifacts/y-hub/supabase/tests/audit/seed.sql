-- Local synthetic identities only; seeded before audit installation.
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT ('00000000-0000-0000-0000-00000000000'||n)::uuid,
 'local'||n||'@example.invalid',jsonb_build_object('full_name','Audit Tester '||n,'major','mathematics')
FROM generate_series(1,6) n;
UPDATE public.users SET role=CASE right(id::text,1) WHEN '1' THEN 'instructor' WHEN '2' THEN 'admin' WHEN '3' THEN 'super_admin' WHEN '5' THEN 'instructor' WHEN '6' THEN 'super_admin' ELSE 'student' END;
