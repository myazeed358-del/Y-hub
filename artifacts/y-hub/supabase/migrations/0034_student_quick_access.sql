-- Personalize the existing Quick Access card, not a second dashboard system.
BEGIN;
CREATE TABLE public.student_quick_access(
 id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 paths text[] NOT NULL DEFAULT '{}' CHECK(cardinality(paths)<=3),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.student_quick_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_quick_access FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.student_quick_access TO authenticated;
CREATE POLICY own_quick_access ON public.student_quick_access FOR SELECT TO authenticated
 USING(id=auth.uid() AND EXISTS(SELECT 1 FROM public.users WHERE users.id=auth.uid() AND role='student'));
CREATE FUNCTION public.read_quick_access() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_paths text[];v_revision bigint;v_available jsonb;v_role text;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid();
 IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student access required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(r.value||jsonb_build_object('moduleId',m.id) ORDER BY m.id,r.value->>'path'),'[]') INTO v_available
 FROM public.module_policies m CROSS JOIN LATERAL jsonb_array_elements(m.routes) r
 WHERE yhub_access_private.allowed(auth.uid(),m.id);
 SELECT paths,revision INTO v_paths,v_revision FROM public.student_quick_access WHERE id=auth.uid();
 IF NOT FOUND THEN
  SELECT coalesce(array_agg(path),'{}') INTO v_paths FROM (
   SELECT item->>'path' AS path FROM jsonb_array_elements(v_available) item
   WHERE item->>'dashboardOrder' IS NOT NULL ORDER BY (item->>'dashboardOrder')::integer,item->>'path' LIMIT 3
  ) defaults;
  v_revision:=0;
 END IF;
 -- Filter every read using current DB access; hidden preferences never grant access.
 SELECT coalesce(array_agg(p.path ORDER BY p.position),'{}') INTO v_paths
 FROM unnest(v_paths) WITH ORDINALITY p(path,position)
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(v_available) a WHERE a->>'path'=p.path);
 RETURN jsonb_build_object('revision',v_revision,'paths',v_paths,'available',v_available);
END $$;
CREATE FUNCTION public.save_quick_access(p_revision bigint,p_paths text[]) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;v_revision bigint;v_path text;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid() FOR SHARE;
 IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student access required' USING ERRCODE='42501'; END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_paths IS NULL OR cardinality(p_paths)>3 OR coalesce(array_ndims(p_paths),1)<>1 OR array_position(p_paths,NULL) IS NOT NULL
 OR (SELECT count(DISTINCT x) FROM unnest(p_paths) x)<>cardinality(p_paths) THEN RAISE EXCEPTION 'Select zero to three unique tools' USING ERRCODE='22023'; END IF;
 FOREACH v_path IN ARRAY p_paths LOOP
  IF NOT EXISTS(SELECT 1 FROM public.module_policies m CROSS JOIN LATERAL jsonb_array_elements(m.routes) r
   WHERE r->>'path'=v_path AND yhub_access_private.allowed(auth.uid(),m.id)) THEN RAISE EXCEPTION 'Tool unavailable' USING ERRCODE='42501'; END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('quick-access:'||auth.uid()::text,0));
 SELECT revision INTO v_revision FROM public.student_quick_access WHERE id=auth.uid() FOR UPDATE;
 IF coalesce(v_revision,0)<>p_revision THEN RAISE EXCEPTION 'Preferences changed on another device; retain selection and reload' USING ERRCODE='PT409'; END IF;
 v_revision:=coalesce(v_revision,0)+1;
 INSERT INTO public.student_quick_access(id,paths,revision) VALUES(auth.uid(),p_paths,v_revision)
 ON CONFLICT(id) DO UPDATE SET paths=EXCLUDED.paths,revision=EXCLUDED.revision,updated_at=clock_timestamp();
 RETURN v_revision;
END $$;
REVOKE ALL ON FUNCTION public.read_quick_access(),public.save_quick_access(bigint,text[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.read_quick_access(),public.save_quick_access(bigint,text[]) TO authenticated;
COMMIT;
