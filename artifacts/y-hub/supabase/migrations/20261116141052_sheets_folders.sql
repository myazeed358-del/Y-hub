-- Decisions43/30: private folder organization, independent of workbook content CAS.
BEGIN;
CREATE TABLE public.y_sheets_folders (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 parent_id uuid, name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
 favorite boolean NOT NULL DEFAULT false, pinned boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,owner_id),
 FOREIGN KEY(parent_id,owner_id) REFERENCES public.y_sheets_folders(id,owner_id),
 CHECK(parent_id IS DISTINCT FROM id)
);
CREATE INDEX sheets_folder_parent ON public.y_sheets_folders(owner_id,parent_id,id);
CREATE TABLE y_sheets_private.locations (
 id uuid PRIMARY KEY REFERENCES public.y_sheets_workbooks(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 parent_id uuid, favorite boolean NOT NULL DEFAULT false, pinned boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL CHECK(revision>0),
 FOREIGN KEY(parent_id,owner_id) REFERENCES public.y_sheets_folders(id,owner_id)
);
CREATE INDEX sheets_location_parent ON y_sheets_private.locations(owner_id,parent_id,id);
ALTER TABLE public.y_sheets_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.y_sheets_folders FORCE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.locations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.y_sheets_folders,y_sheets_private.locations FROM PUBLIC,anon,authenticated,service_role;
-- All operations pass through owner-scoped RPCs. No direct table mutation grants.
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE ON public.y_sheets_folders FOR EACH ROW
 EXECUTE FUNCTION yhub_audit_private.capture('id,owner_id,parent_id,name,favorite,pinned,revision','id,owner_id,parent_id,favorite,pinned,revision','reserved');
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON y_sheets_private.locations FOR EACH ROW
 EXECUTE FUNCTION yhub_audit_private.capture('id,owner_id,parent_id,favorite,pinned,revision','id,owner_id,parent_id,favorite,pinned,revision','reserved');

CREATE FUNCTION public.organize_y_sheets(p_owner uuid,p_kind text,p_id uuid,p_revision bigint,
 p_parent uuid,p_name text,p_favorite boolean,p_pinned boolean) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); f public.y_sheets_folders; l y_sheets_private.locations; current_revision bigint;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_owner THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.users WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('folder','workbook') OR p_id IS NULL OR p_revision IS NULL OR p_revision<0
 OR p_favorite IS NULL OR p_pinned IS NULL OR (p_kind='folder' AND (p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 200))
 OR (p_kind='workbook' AND p_name IS NOT NULL) THEN RAISE EXCEPTION 'Invalid organization request' USING ERRCODE='22023'; END IF;
 -- Serialize the owner's tree, including opposite simultaneous moves. No depth cap.
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,430));
 IF p_parent IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.y_sheets_folders WHERE id=p_parent AND owner_id=actor)
 THEN RAISE EXCEPTION 'Destination unavailable' USING ERRCODE='42501'; END IF;
 IF p_kind='folder' THEN
  SELECT * INTO f FROM public.y_sheets_folders WHERE id=p_id;
  IF FOUND AND f.owner_id<>actor THEN RAISE EXCEPTION 'Folder unavailable' USING ERRCODE='42501'; END IF;
  IF EXISTS(WITH RECURSIVE ancestors AS (
    SELECT id,parent_id FROM public.y_sheets_folders WHERE id=p_parent AND owner_id=actor
    UNION SELECT p.id,p.parent_id FROM public.y_sheets_folders p JOIN ancestors a ON p.id=a.parent_id WHERE p.owner_id=actor
   ) SELECT 1 FROM ancestors WHERE id=p_id) OR p_parent=p_id
  THEN RAISE EXCEPTION 'Folder cycle' USING ERRCODE='22023'; END IF;
  IF f.id IS NOT NULL AND (f.parent_id,f.name,f.favorite,f.pinned) IS NOT DISTINCT FROM (p_parent,btrim(p_name),p_favorite,p_pinned) THEN RETURN f.revision; END IF;
  IF coalesce(f.revision,0)<>p_revision THEN RAISE EXCEPTION 'Folder changed; refresh' USING ERRCODE='PT409'; END IF;
  IF f.id IS NULL THEN
   INSERT INTO public.y_sheets_folders(id,owner_id,parent_id,name,favorite,pinned) VALUES(p_id,actor,p_parent,btrim(p_name),p_favorite,p_pinned) RETURNING revision INTO current_revision;
  ELSE
   UPDATE public.y_sheets_folders SET parent_id=p_parent,name=btrim(p_name),favorite=p_favorite,pinned=p_pinned,revision=revision+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING revision INTO current_revision;
  END IF;
 ELSE
  -- Lock the existing file against deletion. Content revisions/receipts remain untouched.
  PERFORM id FROM public.y_sheets_workbooks WHERE id=p_id AND owner_id=actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO l FROM y_sheets_private.locations WHERE id=p_id;
  IF l.id IS NOT NULL AND (l.parent_id,l.favorite,l.pinned) IS NOT DISTINCT FROM (p_parent,p_favorite,p_pinned) THEN RETURN l.revision; END IF;
  IF coalesce(l.revision,0)<>p_revision THEN RAISE EXCEPTION 'Location changed; refresh' USING ERRCODE='PT409'; END IF;
  INSERT INTO y_sheets_private.locations(id,owner_id,parent_id,favorite,pinned,revision) VALUES(p_id,actor,p_parent,p_favorite,p_pinned,1)
  ON CONFLICT(id) DO UPDATE SET parent_id=EXCLUDED.parent_id,favorite=EXCLUDED.favorite,pinned=EXCLUDED.pinned,revision=locations.revision+1 RETURNING revision INTO current_revision;
 END IF;
 RETURN current_revision;
END $$;

CREATE FUNCTION public.browse_y_sheets(p_owner uuid,p_parent uuid DEFAULT NULL,p_view text DEFAULT 'folder',
 p_search text DEFAULT '',p_sort text DEFAULT 'name',p_offset integer DEFAULT 0,p_folders_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); items jsonb; trail jsonb;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_owner OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor) THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 IF p_view IS NULL OR p_view NOT IN ('folder','all','favorite','pinned') OR p_sort IS NULL OR p_sort NOT IN ('name','updated')
 OR p_search IS NULL OR length(p_search)>200 OR p_offset IS NULL OR p_offset<0 OR p_folders_only IS NULL THEN RAISE EXCEPTION 'Invalid directory request' USING ERRCODE='22023'; END IF;
 IF p_parent IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.y_sheets_folders WHERE id=p_parent AND owner_id=actor)
 THEN RAISE EXCEPTION 'Folder unavailable' USING ERRCODE='42501'; END IF;
 WITH RECURSIVE ancestors AS (
  SELECT id,parent_id,name,1 depth FROM public.y_sheets_folders WHERE id=p_parent AND owner_id=actor
  UNION ALL SELECT p.id,p.parent_id,p.name,a.depth+1 FROM public.y_sheets_folders p JOIN ancestors a ON a.parent_id=p.id WHERE p.owner_id=actor
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY depth DESC),'[]') INTO trail FROM ancestors;
 WITH entries AS (
  SELECT 'folder'::text kind,f.id,f.name,f.parent_id,f.favorite,f.pinned,f.revision organization_revision,NULL::bigint revision,f.updated_at
   FROM public.y_sheets_folders f WHERE owner_id=actor
  UNION ALL
  SELECT 'workbook',w.id,w.name,l.parent_id,coalesce(l.favorite,false),coalesce(l.pinned,false),coalesce(l.revision,0),w.revision,w.updated_at
   FROM public.y_sheets_workbooks w LEFT JOIN y_sheets_private.locations l ON l.id=w.id AND l.owner_id=actor WHERE w.owner_id=actor AND NOT p_folders_only
 ), page AS (
  SELECT * FROM entries WHERE (btrim(p_search)<>'' OR p_view<>'folder' OR parent_id IS NOT DISTINCT FROM p_parent)
   AND (p_view<>'favorite' OR favorite) AND (p_view<>'pinned' OR pinned)
   AND (btrim(p_search)='' OR strpos(lower(name),lower(btrim(p_search)))>0)
  ORDER BY pinned DESC,CASE WHEN p_sort='updated' THEN updated_at END DESC,lower(name),kind,id OFFSET p_offset LIMIT 51
 ) SELECT coalesce(jsonb_agg(to_jsonb(page)),'[]') INTO items FROM page;
 RETURN jsonb_build_object('items',items,'trail',trail);
END $$;
REVOKE ALL ON FUNCTION public.organize_y_sheets(uuid,text,uuid,bigint,uuid,text,boolean,boolean),
 public.browse_y_sheets(uuid,uuid,text,text,text,integer,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.organize_y_sheets(uuid,text,uuid,bigint,uuid,text,boolean,boolean),
 public.browse_y_sheets(uuid,uuid,text,text,text,integer,boolean) TO authenticated;
COMMIT;
