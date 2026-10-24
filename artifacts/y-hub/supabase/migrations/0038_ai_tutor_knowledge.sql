-- Phase 1: server-authored, section-scoped evidence. No historical SQL changes.
BEGIN;
CREATE SCHEMA tutor_private;
REVOKE ALL ON SCHEMA tutor_private FROM PUBLIC,anon,authenticated;
CREATE FUNCTION tutor_private.access(p_actor uuid,p_course uuid,p_manage boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.courses c JOIN public.users u ON u.id=p_actor
 WHERE c.id=p_course AND (
 (c.instructor_id=u.id AND u.role IN ('instructor','admin','super_admin')) OR
 (NOT p_manage AND u.role='student' AND c.is_published AND EXISTS(
 SELECT 1 FROM public.course_enrollments e WHERE e.course_id=c.id AND e.student_id=u.id AND e.status='active'))));
$$;
CREATE FUNCTION public.ai_tutor_access(p_course uuid,p_manage boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT tutor_private.access(auth.uid(),p_course,p_manage);
$$;
REVOKE ALL ON FUNCTION public.ai_tutor_access(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_tutor_access(uuid,boolean) TO authenticated;

CREATE TABLE public.ai_tutor_sources(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid NOT NULL REFERENCES public.courses ON DELETE CASCADE,
 material_id uuid UNIQUE REFERENCES public.course_materials ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('pdf','syllabus')), title text NOT NULL,
 revision uuid NOT NULL DEFAULT gen_random_uuid(), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','unreadable')),
 indexed_at timestamptz, embedding_model text, object_path text,
 CHECK((kind='pdf')=(material_id IS NOT NULL)));
CREATE UNIQUE INDEX ai_tutor_one_syllabus ON public.ai_tutor_sources(course_id) WHERE kind='syllabus';
CREATE INDEX ai_tutor_sources_course ON public.ai_tutor_sources(course_id);
CREATE TABLE public.ai_tutor_chunks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES public.ai_tutor_sources ON DELETE CASCADE,
 revision uuid NOT NULL, ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 255),
 page integer CHECK(page BETWEEN 1 AND 300), unit_id uuid REFERENCES public.syllabus_units ON DELETE CASCADE,
 text text NOT NULL CHECK(length(text) BETWEEN 1 AND 1800), embedding real[],
 search tsvector GENERATED ALWAYS AS(to_tsvector('simple',text)) STORED,
 CHECK(embedding IS NULL OR cardinality(embedding) BETWEEN 1 AND 1536), UNIQUE(source_id,ordinal));
CREATE INDEX ai_tutor_chunk_search ON public.ai_tutor_chunks USING gin(search);
ALTER TABLE public.ai_tutor_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_tutor_sources,public.ai_tutor_chunks FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ai_tutor_sources,public.ai_tutor_chunks TO authenticated;
GRANT ALL ON public.ai_tutor_sources,public.ai_tutor_chunks TO service_role;
CREATE POLICY tutor_source_read ON public.ai_tutor_sources FOR SELECT TO authenticated USING(
 public.ai_tutor_access(course_id) AND (kind='syllabus' OR EXISTS(SELECT 1 FROM public.course_materials m WHERE m.id=material_id AND m.course_id=ai_tutor_sources.course_id)));
CREATE POLICY tutor_chunk_read ON public.ai_tutor_chunks FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.ai_tutor_sources s WHERE s.id=source_id AND s.revision=ai_tutor_chunks.revision AND s.status='ready'));

CREATE FUNCTION tutor_private.sync_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='course_materials' THEN
  IF TG_OP='UPDATE' AND (NEW.course_id,NEW.title,NEW.type,NEW.url) IS NOT DISTINCT FROM (OLD.course_id,OLD.title,OLD.type,OLD.url) THEN RETURN NEW; END IF;
  DELETE FROM public.ai_tutor_sources WHERE material_id=NEW.id;
  IF NEW.type='pdf' THEN INSERT INTO public.ai_tutor_sources(course_id,material_id,kind,title) VALUES(NEW.course_id,NEW.id,'pdf',NEW.title); END IF;
 ELSE
  IF TG_OP='UPDATE' AND NEW.syllabus_revision=OLD.syllabus_revision THEN RETURN NEW; END IF;
  INSERT INTO public.ai_tutor_sources(course_id,kind,title) VALUES(NEW.id,'syllabus','Syllabus')
  ON CONFLICT(course_id) WHERE kind='syllabus' DO UPDATE SET revision=gen_random_uuid(),status='pending',indexed_at=NULL;
  DELETE FROM public.ai_tutor_chunks WHERE source_id IN(SELECT id FROM public.ai_tutor_sources WHERE course_id=NEW.id AND kind='syllabus');
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER tutor_material AFTER INSERT OR UPDATE ON public.course_materials FOR EACH ROW EXECUTE FUNCTION tutor_private.sync_source();
CREATE TRIGGER tutor_syllabus AFTER INSERT OR UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION tutor_private.sync_source();
INSERT INTO public.ai_tutor_sources(course_id,material_id,kind,title) SELECT course_id,id,'pdf',title FROM public.course_materials WHERE type='pdf';
INSERT INTO public.ai_tutor_sources(course_id,kind,title) SELECT id,'syllabus','Syllabus' FROM public.courses;
-- Storage bytes are outside a PostgreSQL transaction. Invalidate the matching
-- normalized object path, including rename/replacement. Sources whose first
-- index has not established a path are conservatively invalidated in flight.
CREATE FUNCTION tutor_private.storage_invalidated() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(to_jsonb(NEW)->>'bucket_id',to_jsonb(OLD)->>'bucket_id')='materials' OR to_jsonb(OLD)->>'bucket_id'='materials' THEN
  UPDATE public.ai_tutor_sources SET revision=gen_random_uuid(),status='pending',indexed_at=NULL WHERE kind='pdf' AND (object_path IS NULL OR object_path=to_jsonb(OLD)->>'name' OR object_path=to_jsonb(NEW)->>'name');
  DELETE FROM public.ai_tutor_chunks c USING public.ai_tutor_sources s WHERE c.source_id=s.id AND c.revision<>s.revision;
 END IF;
 RETURN NULL;
END; $$;
CREATE TRIGGER tutor_storage AFTER INSERT OR UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION tutor_private.storage_invalidated();

CREATE FUNCTION public.publish_ai_tutor_source(p_actor uuid,p_source uuid,p_revision uuid,p_chunks jsonb,p_model text DEFAULT NULL,p_path text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ai_tutor_sources; item jsonb; n integer:=0; v real[];
BEGIN
 SELECT * INTO s FROM public.ai_tutor_sources WHERE id=p_source FOR UPDATE;
 IF NOT FOUND OR NOT tutor_private.access(p_actor,s.course_id,true) THEN RAISE EXCEPTION 'Source denied' USING ERRCODE='42501'; END IF;
 IF s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Source changed' USING ERRCODE='PT409'; END IF;
 IF jsonb_typeof(p_chunks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_chunks)>256 OR octet_length(p_chunks::text)>8000000 THEN RAISE EXCEPTION 'Invalid index' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.ai_tutor_sources WHERE course_id=s.course_id)>100 THEN RAISE EXCEPTION 'Source limit' USING ERRCODE='54000'; END IF;
 DELETE FROM public.ai_tutor_chunks WHERE source_id=s.id;
 FOR item IN SELECT value FROM jsonb_array_elements(p_chunks) LOOP
  IF jsonb_typeof(item->'text') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid text'; END IF;
  IF item->>'unitId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.syllabus_units WHERE id=(item->>'unitId')::uuid AND course_id=s.course_id) THEN RAISE EXCEPTION 'Invalid unit'; END IF;
  v:=NULL;
  IF item->'embedding' IS NOT NULL AND item->'embedding'<>'null'::jsonb THEN
   SELECT array_agg(value::real) INTO v FROM jsonb_array_elements_text(item->'embedding');
   IF p_model IS NULL OR EXISTS(SELECT 1 FROM unnest(v) x WHERE x::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid embedding'; END IF;
  END IF;
  INSERT INTO public.ai_tutor_chunks(source_id,revision,ordinal,page,unit_id,text,embedding)
   VALUES(s.id,s.revision,n,(item->>'page')::int,(item->>'unitId')::uuid,item->>'text',v);
  n:=n+1;
 END LOOP;
 UPDATE public.ai_tutor_sources SET status=CASE WHEN n=0 THEN 'unreadable' ELSE 'ready' END,indexed_at=now(),embedding_model=p_model,object_path=p_path WHERE id=s.id;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.publish_ai_tutor_source(uuid,uuid,uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_ai_tutor_source(uuid,uuid,uuid,jsonb,text,text) TO service_role;

CREATE FUNCTION public.ai_tutor_cosine(a real[],b real[]) RETURNS double precision LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN cardinality(a)=cardinality(b) THEN sum(x::double precision*y)/nullif(sqrt(sum(x::double precision*x)*sum(y::double precision*y)),0) ELSE 0 END FROM unnest(a,b) t(x,y);
$$;
REVOKE ALL ON FUNCTION public.ai_tutor_cosine(real[],real[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_tutor_cosine(real[],real[]) TO authenticated;
CREATE FUNCTION public.search_ai_tutor(p_course uuid,p_query text,p_source uuid DEFAULT NULL,p_embedding real[] DEFAULT NULL,p_model text DEFAULT NULL)
RETURNS TABLE(id uuid,source_id uuid,revision uuid,title text,page integer,unit_id uuid,text text,score double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH ranked AS(
 SELECT c.id,c.source_id,c.revision,s.title,c.page,c.unit_id,c.text,
 ts_rank_cd(c.search,websearch_to_tsquery('simple',left(p_query,1500)))::double precision+
 CASE WHEN s.embedding_model=p_model AND cardinality(p_embedding)<=1536 THEN greatest(0,public.ai_tutor_cosine(c.embedding,p_embedding)-0.25) ELSE 0 END AS score
 FROM public.ai_tutor_chunks c JOIN public.ai_tutor_sources s ON s.id=c.source_id
 WHERE s.course_id=p_course AND (p_source IS NULL OR s.id=p_source) AND s.status='ready' AND s.revision=c.revision)
 SELECT * FROM ranked WHERE score>0 ORDER BY score DESC,id LIMIT 6;
$$;
REVOKE ALL ON FUNCTION public.search_ai_tutor(uuid,text,uuid,real[],text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.search_ai_tutor(uuid,text,uuid,real[],text) TO authenticated;

CREATE TABLE tutor_private.leases(actor uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,token uuid NOT NULL,expires_at timestamptz NOT NULL);
CREATE FUNCTION public.begin_ai_tutor_request(p_actor uuid,p_course uuid,p_index boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid;
BEGIN
 IF NOT tutor_private.access(p_actor,p_course,p_index) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ai-tutor-platform-concurrency',0));
 IF (SELECT count(*) FROM tutor_private.leases WHERE expires_at>now())>=4 THEN RAISE EXCEPTION 'Platform concurrency reached' USING ERRCODE='PT429'; END IF;
 INSERT INTO tutor_private.leases AS l VALUES(p_actor,gen_random_uuid(),now()+interval '90 seconds') ON CONFLICT(actor) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE l.expires_at<now() RETURNING token INTO t;
 IF t IS NULL THEN RAISE EXCEPTION 'Request in progress' USING ERRCODE='PT429'; END IF;
 IF NOT public.consume_ai_tutor_quota_for_user(p_actor) THEN RAISE EXCEPTION 'Quota reached' USING ERRCODE='PT429'; END IF;
 RETURN t;
END; $$;
CREATE FUNCTION public.end_ai_tutor_request(p_actor uuid,p_token uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ DELETE FROM tutor_private.leases WHERE actor=p_actor AND token=p_token; $$;
REVOKE ALL ON FUNCTION public.begin_ai_tutor_request(uuid,uuid,boolean),public.end_ai_tutor_request(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_ai_tutor_request(uuid,uuid,boolean),public.end_ai_tutor_request(uuid,uuid) TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tutor_private FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
