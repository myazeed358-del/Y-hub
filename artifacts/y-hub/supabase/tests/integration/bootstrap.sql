-- Real auth.users/auth.uid/auth.role are supplied by GoTrue migrations.
-- Only Storage schema is a stand-in: Storage service integration is not claimed.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA storage;


GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
-- Supabase's platform default grants, subsequently tightened by the real migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;

CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- Historical 0003 assumes this preexisting profile schema (0004 formalizes it).
CREATE TABLE public.users(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text,full_name text,role text DEFAULT 'student',major text,study_year text,phone text,created_at timestamptz DEFAULT now());

CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon,authenticated TO authenticator;
