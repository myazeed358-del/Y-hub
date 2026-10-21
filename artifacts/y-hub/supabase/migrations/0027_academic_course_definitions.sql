-- Additive catalog/section model. Never match historical sections by title/code.
BEGIN;
CREATE SCHEMA yhub_academic_private;
REVOKE ALL ON SCHEMA yhub_academic_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE public.course_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  title text NOT NULL,
  description text,
  department text CHECK (department IS NULL OR length(btrim(department)) BETWEEN 1 AND 200),
  academic_major text CHECK (academic_major IS NULL OR length(btrim(academic_major)) BETWEEN 1 AND 100),
  -- Provenance, not a live FK. Survives deletion; never used for name/code matching.
  legacy_course_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_definitions_major ON public.course_definitions(academic_major, id);
ALTER TABLE public.course_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_definitions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_definitions TO authenticated;
CREATE POLICY definition_read ON public.course_definitions FOR SELECT TO authenticated USING (
  public.audit_reader_role() IN ('instructor','admin','super_admin')
  OR (public.audit_reader_role() = 'student' AND (academic_major IS NULL OR academic_major =
      (SELECT u.major FROM public.users u WHERE u.id = auth.uid())))
);
CREATE POLICY definition_admin_write ON public.course_definitions FOR ALL TO authenticated
USING (public.audit_reader_role() IN ('admin','super_admin'))
WITH CHECK (public.audit_reader_role() IN ('admin','super_admin'));

CREATE TRIGGER audit_lock_actor BEFORE INSERT OR UPDATE OR DELETE ON public.course_definitions
FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.lock_actor();
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.course_definitions
FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture(
 'id,code,title,description,department,academic_major,legacy_course_id,created_at',
 'id,legacy_course_id,created_at','reserved');
CREATE TRIGGER audit_block_truncate BEFORE TRUNCATE ON public.course_definitions
FOR EACH STATEMENT EXECUTE FUNCTION yhub_audit_private.reject_truncate();

ALTER TABLE public.courses
 ADD COLUMN course_definition_id uuid REFERENCES public.course_definitions(id) ON DELETE RESTRICT,
 ADD COLUMN section_label text CHECK(section_label IS NULL OR length(btrim(section_label)) BETWEEN 1 AND 100),
 ADD COLUMN academic_term text CHECK(academic_term IS NULL OR length(btrim(academic_term)) BETWEEN 1 AND 100);
CREATE INDEX courses_definition ON public.courses(course_definition_id);
-- Extend capture before backfill. Old IDs, children and historical audit rows stay intact.
DROP TRIGGER audit_capture ON public.courses;
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON public.courses
FOR EACH ROW EXECUTE FUNCTION yhub_audit_private.capture(
 'id,instructor_id,title,description,course_code,is_published,enrollment_open,syllabus_source,created_at,course_definition_id,section_label,academic_term',
 'id,instructor_id,is_published,enrollment_open,syllabus_source,created_at,course_definition_id','ordinary');
INSERT INTO public.course_definitions(id,code,title,description,legacy_course_id,created_at)
SELECT id,course_code,title,description,id,coalesce(created_at,now()) FROM public.courses;
UPDATE public.courses SET course_definition_id=id;
ALTER TABLE public.courses ALTER COLUMN course_definition_id SET NOT NULL;

CREATE FUNCTION yhub_academic_private.section_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.course_definition_id IS DISTINCT FROM OLD.course_definition_id THEN
      RAISE EXCEPTION 'Section identity and definition are immutable; create an independent section' USING ERRCODE='22023';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.course_definition_id IS NULL THEN
    -- Compatibility for old clients. RLS still authorizes the actual course INSERT.
    IF auth.uid() IS NULL THEN
      IF current_setting('role') NOT IN ('none','postgres','service_role') THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
      END IF;
    ELSE
      SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
      IF coalesce(v_role,'') NOT IN ('instructor','admin','super_admin') THEN
        RAISE EXCEPTION 'Content manager required' USING ERRCODE='42501';
      END IF;
    END IF;
    INSERT INTO public.course_definitions(code,title,description,legacy_course_id)
    VALUES(NEW.course_code,NEW.title,NEW.description,NEW.id) RETURNING id INTO NEW.course_definition_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION yhub_academic_private.section_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER section_identity BEFORE INSERT OR UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION yhub_academic_private.section_identity();

-- Explicit compatibility boundary: the existing physical table IS the section store.
-- Invoker security keeps the caller's grants/RLS; no privileged view owner bypass.
CREATE VIEW public.course_sections WITH (security_invoker=true) AS
SELECT id,course_definition_id,instructor_id,section_label,academic_term,
 title,description,course_code,is_published,enrollment_open,syllabus_source,created_at
FROM public.courses;
REVOKE ALL ON public.course_sections FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_sections TO authenticated;
COMMENT ON TABLE public.courses IS 'Compatibility section store. id is the stable section ID; all existing course_id FKs remain unchanged.';
COMMENT ON VIEW public.course_sections IS 'Invoker-secured academic naming interface over courses; not a copied or re-keyed table.';
COMMENT ON COLUMN public.course_definitions.academic_major IS 'NULL is an explicitly unclassified legacy/shared definition. Never inferred from title, code, or instructor major.';
COMMIT;
