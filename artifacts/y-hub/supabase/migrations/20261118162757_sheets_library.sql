-- Decision30: owner-only categories and bounded real saved-cell previews.
BEGIN;
CREATE TABLE y_sheets_private.categories (
 kind text NOT NULL CHECK(kind IN ('workbook','folder')), id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 category text CHECK(category IS NULL OR (length(category) BETWEEN 1 AND 40 AND category=btrim(category) AND category !~ '[[:cntrl:]]')),
 revision bigint NOT NULL CHECK(revision>0), PRIMARY KEY(kind,id)
);
-- No item FK: classification follows an item through private trash/restore.
-- Every RPC requires an active owned item; purge removes the private label.
CREATE INDEX sheets_categories_owner ON y_sheets_private.categories(owner_id,lower(category),kind,id);
ALTER TABLE y_sheets_private.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.categories FORCE ROW LEVEL SECURITY;
REVOKE ALL ON y_sheets_private.categories FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON y_sheets_private.categories FOR EACH ROW
 EXECUTE FUNCTION yhub_audit_private.capture('kind,id,owner_id,category,revision','kind,id,owner_id,revision','reserved');
CREATE FUNCTION public.classify_y_sheets(p_owner uuid,p_kind text,p_id uuid,p_revision bigint,p_category text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c y_sheets_private.categories; result bigint; label text:=nullif(btrim(p_category),'');
BEGIN
 PERFORM y_sheets_private.lock_trash_owner(p_owner);
 IF p_kind IS NULL OR p_kind NOT IN ('workbook','folder') OR p_id IS NULL OR p_revision IS NULL OR p_revision<0
 OR (label IS NOT NULL AND (length(label)>40 OR label ~ '[[:cntrl:]]')) THEN RAISE EXCEPTION 'Invalid category' USING ERRCODE='22023'; END IF;
 IF p_kind='folder' THEN
  PERFORM id FROM public.y_sheets_folders WHERE id=p_id AND owner_id=p_owner FOR SHARE;
 ELSE PERFORM id FROM public.y_sheets_workbooks WHERE id=p_id AND owner_id=p_owner FOR SHARE; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Item unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM y_sheets_private.categories WHERE kind=p_kind AND id=p_id;
 IF c.id IS NOT NULL AND c.owner_id<>p_owner THEN RAISE EXCEPTION 'Item unavailable' USING ERRCODE='42501'; END IF;
 IF c.id IS NOT NULL AND c.category IS NOT DISTINCT FROM label THEN RETURN c.revision; END IF;
 IF coalesce(c.revision,0)<>p_revision THEN RAISE EXCEPTION 'Category changed; refresh' USING ERRCODE='PT409'; END IF;
 IF c.id IS NULL AND label IS NULL THEN RETURN 0; END IF;
 INSERT INTO y_sheets_private.categories(kind,id,owner_id,category,revision) VALUES(p_kind,p_id,p_owner,label,1)
 ON CONFLICT(kind,id) DO UPDATE SET category=EXCLUDED.category,revision=categories.revision+1 RETURNING revision INTO result;
 RETURN result;
END $$;
CREATE FUNCTION y_sheets_private.category_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.state IS DISTINCT FROM OLD.state AND NEW.state='purged' THEN
  DELETE FROM y_sheets_private.categories c USING y_sheets_private.lifecycle l
   WHERE l.entry_id=NEW.id AND (c.kind,c.id,c.owner_id)=(l.kind,l.id,l.owner_id);
 ELSIF NEW.state IS DISTINCT FROM OLD.state AND NEW.state='restored' THEN
  UPDATE y_sheets_private.categories c SET revision=c.revision+1 FROM y_sheets_private.lifecycle l
   WHERE l.entry_id=NEW.id AND (c.kind,c.id,c.owner_id)=(l.kind,l.id,l.owner_id);
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER category_lifecycle AFTER UPDATE OF state ON y_sheets_private.trash_entries FOR EACH ROW EXECUTE FUNCTION y_sheets_private.category_lifecycle();
CREATE FUNCTION public.browse_y_sheets_library(p_owner uuid,p_parent uuid DEFAULT NULL,p_view text DEFAULT 'folder',
 p_search text DEFAULT '',p_sort text DEFAULT 'name',p_offset integer DEFAULT 0,p_folders_only boolean DEFAULT false,p_category text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); items jsonb; trail jsonb;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_owner OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor) THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 IF p_view IS NULL OR p_view NOT IN ('folder','all','favorite','pinned') OR p_sort IS NULL OR p_sort NOT IN ('name','updated')
 OR (p_category IS NOT NULL AND (length(btrim(p_category))>40 OR p_category ~ '[[:cntrl:]]'))
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
 ), classified AS (
  SELECT e.*,c.category,coalesce(c.revision,0) category_revision FROM entries e
  LEFT JOIN y_sheets_private.categories c ON c.kind=e.kind AND c.id=e.id AND c.owner_id=actor
 ), page AS (
  SELECT * FROM classified WHERE (btrim(p_search)<>'' OR p_view<>'folder' OR parent_id IS NOT DISTINCT FROM p_parent)
   AND (p_category IS NULL OR (btrim(p_category)='' AND category IS NULL) OR lower(category)=lower(btrim(p_category)))
   AND (p_view<>'favorite' OR favorite) AND (p_view<>'pinned' OR pinned)
   AND (btrim(p_search)='' OR strpos(lower(name),lower(btrim(p_search)))>0)
  ORDER BY pinned DESC,CASE WHEN p_sort='updated' THEN updated_at END DESC,lower(name),kind,id OFFSET p_offset LIMIT 51
 ) SELECT coalesce(jsonb_agg(to_jsonb(page)),'[]') INTO items FROM page;
 RETURN jsonb_build_object('items',items,'trail',trail);
END $$;
CREATE FUNCTION public.preview_y_sheets_library(p_owner uuid,p_id uuid,p_revision bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.y_sheets_workbooks; sheet jsonb; cells jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_owner OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_owner)
 THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_revision IS NULL OR p_revision<1 THEN RAISE EXCEPTION 'Invalid preview' USING ERRCODE='22023'; END IF;
 SELECT * INTO w FROM public.y_sheets_workbooks WHERE id=p_id AND owner_id=p_owner;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501'; END IF;
 IF w.revision<>p_revision THEN RAISE EXCEPTION 'Workbook changed; refresh' USING ERRCODE='PT409'; END IF;
 SELECT s INTO sheet FROM jsonb_array_elements(w.content->'sheets') s WHERE s->>'id'=w.content->>'activeSheetId' LIMIT 1;
 IF sheet IS NULL THEN RAISE EXCEPTION 'Preview unavailable' USING ERRCODE='22023'; END IF;
 -- 24 cells only. Return saved raw input, never evaluate formulas, links or markup.
 SELECT jsonb_agg(jsonb_build_object('row',r,'col',c,'text',left(raw,160),'truncated',length(raw)>160) ORDER BY r,c) INTO cells FROM (
  SELECT r,c,CASE WHEN jsonb_typeof(sheet->'cells'->(r::text||','||c::text)->'raw')='string'
   THEN sheet->'cells'->(r::text||','||c::text)->>'raw' ELSE '' END raw
  FROM generate_series(0,5) r CROSS JOIN generate_series(0,3) c
 ) area;
 RETURN jsonb_build_object('revision',w.revision,'sheetName',left(sheet->>'name',120),'sheetCount',jsonb_array_length(w.content->'sheets'),'cells',cells);
END $$;
REVOKE ALL ON FUNCTION y_sheets_private.category_lifecycle() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.classify_y_sheets(uuid,text,uuid,bigint,text),public.browse_y_sheets_library(uuid,uuid,text,text,text,integer,boolean,text),public.preview_y_sheets_library(uuid,uuid,bigint) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.classify_y_sheets(uuid,text,uuid,bigint,text),public.browse_y_sheets_library(uuid,uuid,text,text,text,integer,boolean,text),public.preview_y_sheets_library(uuid,uuid,bigint) TO authenticated;
COMMIT;
