-- Allow authenticated users to query public.users.
-- Row-level security remains responsible for limiting each user
-- to the rows permitted by the existing SELECT policies.

GRANT SELECT ON TABLE public.users TO authenticated;
