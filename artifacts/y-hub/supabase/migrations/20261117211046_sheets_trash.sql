-- Decisions47/55/63: owner-private 30-day trash, restore at root without live grants.
BEGIN;
CREATE TABLE y_sheets_private.trash_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 root_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('workbook','folder')), root_revision bigint NOT NULL,
 name text, state text NOT NULL DEFAULT 'trashed' CHECK(state IN ('trashed','restored','purged')),
 deleted_at timestamptz NOT NULL DEFAULT statement_timestamp(), expires_at timestamptz NOT NULL DEFAULT statement_timestamp()+interval '30 days',
 file_count integer NOT NULL, folder_count integer NOT NULL, payload jsonb
);
CREATE INDEX sheets_trash_owner ON y_sheets_private.trash_entries(owner_id,deleted_at DESC,id) WHERE state='trashed';
CREATE UNIQUE INDEX sheets_trash_root ON y_sheets_private.trash_entries(owner_id,kind,root_id,root_revision) WHERE state='trashed';
CREATE INDEX sheets_trash_expiry ON y_sheets_private.trash_entries(expires_at,id) WHERE state='trashed';
-- Permanent identity/revision fences contain no workbook content or names.
CREATE TABLE y_sheets_private.lifecycle (
 kind text NOT NULL CHECK(kind IN ('workbook','folder')), id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 entry_id uuid NOT NULL REFERENCES y_sheets_private.trash_entries(id) ON DELETE CASCADE,
 state text NOT NULL CHECK(state IN ('trashed','restored','purged')), revision_floor bigint NOT NULL,
 PRIMARY KEY(kind,id)
);
CREATE INDEX sheets_lifecycle_entry ON y_sheets_private.lifecycle(entry_id);
CREATE INDEX sheets_lifecycle_owner ON y_sheets_private.lifecycle(owner_id);
ALTER TABLE y_sheets_private.trash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.trash_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.lifecycle FORCE ROW LEVEL SECURITY;
REVOKE ALL ON y_sheets_private.trash_entries,y_sheets_private.lifecycle FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE ON y_sheets_private.trash_entries FOR EACH ROW
 EXECUTE FUNCTION yhub_audit_private.capture('id,owner_id,root_id,kind,root_revision,state,deleted_at,expires_at,file_count,folder_count','id,owner_id,root_id,kind,root_revision,state,deleted_at,expires_at,file_count,folder_count','reserved');
CREATE FUNCTION y_sheets_private.lock_trash_owner(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.users WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,430));
END $$;
CREATE FUNCTION public.trash_y_sheets(p_actor uuid,p_kind text,p_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE folders uuid[]:='{}'; files uuid[]:='{}'; file_id uuid; revision bigint; title text; entry uuid; snapshot jsonb;
BEGIN
 PERFORM y_sheets_private.lock_trash_owner(p_actor);
 IF p_kind IS NULL OR p_kind NOT IN ('workbook','folder') OR p_id IS NULL OR p_revision IS NULL OR p_revision<1
 THEN RAISE EXCEPTION 'Invalid trash request' USING ERRCODE='22023'; END IF;
 SELECT e.id INTO entry FROM y_sheets_private.trash_entries e WHERE e.owner_id=p_actor AND e.root_id=p_id AND e.kind=p_kind AND e.root_revision=p_revision AND e.state='trashed';
 IF FOUND THEN RETURN entry; END IF;
 IF p_kind='folder' THEN
  SELECT name,f.revision INTO title,revision FROM public.y_sheets_folders f WHERE id=p_id AND owner_id=p_actor;
  WITH RECURSIVE tree AS (
   SELECT id FROM public.y_sheets_folders WHERE id=p_id AND owner_id=p_actor
   UNION ALL SELECT f.id FROM public.y_sheets_folders f JOIN tree t ON f.parent_id=t.id WHERE f.owner_id=p_actor
  ) SELECT coalesce(array_agg(id),'{}') INTO folders FROM tree;
  SELECT coalesce(array_agg(id),'{}') INTO files FROM y_sheets_private.locations WHERE owner_id=p_actor AND parent_id=ANY(folders);
 ELSE files:=ARRAY[p_id]; END IF;
 -- Existing saves take this file lock. Snapshot only after every save has settled.
 FOR file_id IN SELECT unnest(files) ORDER BY 1 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(file_id::text,0));
 END LOOP;
 IF p_kind='workbook' THEN SELECT name,w.revision INTO title,revision FROM public.y_sheets_workbooks w WHERE id=p_id AND owner_id=p_actor; END IF;
 IF revision IS NULL OR revision<>p_revision THEN RAISE EXCEPTION 'Item changed or unavailable' USING ERRCODE='PT409'; END IF;
 SELECT jsonb_build_object(
  'files',coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM public.y_sheets_workbooks w WHERE id=ANY(files) AND owner_id=p_actor),'[]'),
  'folders',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM public.y_sheets_folders f WHERE id=ANY(folders) AND owner_id=p_actor),'[]'),
  'locations',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM y_sheets_private.locations l WHERE id=ANY(files)),'[]'),
  'shares',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM y_sheets_private.shares g WHERE workbook_id=ANY(files)),'[]'),
  'folder_shares',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM y_sheets_private.folder_shares g WHERE folder_id=ANY(folders)),'[]'),
  'effective',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM y_sheets_private.effective_shares g WHERE workbook_id=ANY(files)),'[]')
 ) INTO snapshot;
 INSERT INTO y_sheets_private.trash_entries(owner_id,root_id,kind,root_revision,name,file_count,folder_count,payload)
 VALUES(p_actor,p_id,p_kind,revision,title,cardinality(files),cardinality(folders),snapshot) RETURNING id INTO entry;
 INSERT INTO y_sheets_private.lifecycle(kind,id,owner_id,entry_id,state,revision_floor)
 SELECT 'workbook',id,p_actor,entry,'trashed',w.revision+1 FROM public.y_sheets_workbooks w WHERE id=ANY(files)
 UNION ALL SELECT 'folder',id,p_actor,entry,'trashed',f.revision+1 FROM public.y_sheets_folders f WHERE id=ANY(folders)
 ON CONFLICT(kind,id) DO UPDATE SET entry_id=EXCLUDED.entry_id,state='trashed',revision_floor=EXCLUDED.revision_floor;
 DELETE FROM public.y_sheets_workbooks WHERE id=ANY(files) AND owner_id=p_actor;
 DELETE FROM public.y_sheets_folders WHERE id=ANY(folders) AND owner_id=p_actor;
 RETURN entry;
END $$;
CREATE OR REPLACE FUNCTION public.delete_y_sheets_workbook(p_id uuid,p_expected_revision bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.trash_y_sheets(auth.uid(),'workbook',p_id,p_expected_revision);
 RETURN p_id;
END $$;
-- Purging removes archived names, cell content and grant snapshots. Only lifecycle metadata remains.
CREATE FUNCTION y_sheets_private.purge_trash_entry(p_entry uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE y_sheets_private.trash_entries SET state='purged',name=NULL,payload=NULL WHERE id=p_entry AND state='trashed';
 IF FOUND THEN UPDATE y_sheets_private.lifecycle SET state='purged' WHERE entry_id=p_entry AND state='trashed'; END IF;
END $$;
CREATE FUNCTION public.list_y_sheets_trash(p_actor uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item uuid; result jsonb;
BEGIN
 PERFORM y_sheets_private.lock_trash_owner(p_actor);
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT id FROM y_sheets_private.trash_entries WHERE owner_id=p_actor AND state='trashed' AND expires_at<=clock_timestamp() FOR UPDATE LOOP
  PERFORM y_sheets_private.purge_trash_entry(item);
 END LOOP;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO result FROM (
  SELECT id,root_id "rootId",kind,name,deleted_at "deletedAt",expires_at "expiresAt",file_count "fileCount",folder_count "folderCount"
  FROM y_sheets_private.trash_entries WHERE owner_id=p_actor AND state='trashed' AND expires_at>clock_timestamp()
  ORDER BY deleted_at DESC,id OFFSET p_offset LIMIT 51
 ) r;
 RETURN result;
END $$;
CREATE FUNCTION public.restore_y_sheets_trash(p_actor uuid,p_entry uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e y_sheets_private.trash_entries; file_id uuid;
BEGIN
 PERFORM y_sheets_private.lock_trash_owner(p_actor);
 SELECT * INTO e FROM y_sheets_private.trash_entries WHERE id=p_entry AND owner_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trash unavailable' USING ERRCODE='42501'; END IF;
 IF e.state='restored' THEN RETURN e.root_id; END IF;
 IF e.state<>'trashed' OR e.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Restore expired or purged' USING ERRCODE='PT409'; END IF;
 FOR file_id IN SELECT (v->>'id')::uuid FROM jsonb_array_elements(e.payload->'files') v ORDER BY 1 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(file_id::text,0));
 END LOOP;
 IF e.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Restore expired' USING ERRCODE='PT409'; END IF;
 -- Root always detached from its old (possibly shared/deleted) parent. Internal tree preserved.
 INSERT INTO public.y_sheets_folders(id,owner_id,parent_id,name,favorite,pinned,revision,updated_at)
 SELECT f.id,p_actor,CASE WHEN f.id=e.root_id THEN NULL ELSE f.parent_id END,f.name,f.favorite,f.pinned,f.revision+1,clock_timestamp()
 FROM jsonb_populate_recordset(NULL::public.y_sheets_folders,e.payload->'folders') f;
 INSERT INTO public.y_sheets_workbooks(id,owner_id,name,content,revision,created_at,updated_at)
 SELECT w.id,p_actor,w.name,w.content,w.revision+1,w.created_at,clock_timestamp()
 FROM jsonb_populate_recordset(NULL::public.y_sheets_workbooks,e.payload->'files') w;
 INSERT INTO y_sheets_private.locations(id,owner_id,parent_id,favorite,pinned,revision)
 SELECT w.id,p_actor,CASE WHEN e.kind='folder' THEN l.parent_id END,coalesce(l.favorite,false),coalesce(l.pinned,false),coalesce(l.revision,0)+1
 FROM jsonb_populate_recordset(NULL::public.y_sheets_workbooks,e.payload->'files') w
 LEFT JOIN jsonb_populate_recordset(NULL::y_sheets_private.locations,e.payload->'locations') l ON l.id=w.id;
 -- Preserve grant history for manual review, but never restore active permissions.
 INSERT INTO y_sheets_private.shares(id,workbook_id,recipient_id,permission,revision)
 SELECT g.id,g.workbook_id,g.recipient_id,'none',g.revision+1 FROM jsonb_populate_recordset(NULL::y_sheets_private.shares,e.payload->'shares') g
 JOIN public.users u ON u.id=g.recipient_id;
 INSERT INTO y_sheets_private.folder_shares(id,folder_id,recipient_id,permission,revision)
 SELECT g.id,g.folder_id,g.recipient_id,'none',g.revision+1 FROM jsonb_populate_recordset(NULL::y_sheets_private.folder_shares,e.payload->'folder_shares') g
 JOIN public.users u ON u.id=g.recipient_id;
 INSERT INTO y_sheets_private.effective_shares(workbook_id,recipient_id,permission,revision,sources)
 SELECT g.workbook_id,g.recipient_id,'none',g.revision+1,'[]'::jsonb FROM jsonb_populate_recordset(NULL::y_sheets_private.effective_shares,e.payload->'effective') g
 JOIN public.users u ON u.id=g.recipient_id;
 UPDATE y_sheets_private.lifecycle SET state='restored' WHERE entry_id=p_entry;
 UPDATE y_sheets_private.trash_entries SET state='restored',name=NULL,payload=NULL WHERE id=p_entry;
 RETURN e.root_id;
END $$;
CREATE FUNCTION public.purge_y_sheets_trash(p_actor uuid,p_entry uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e y_sheets_private.trash_entries;
BEGIN
 PERFORM y_sheets_private.lock_trash_owner(p_actor);
 SELECT * INTO e FROM y_sheets_private.trash_entries WHERE id=p_entry AND owner_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trash unavailable' USING ERRCODE='42501'; END IF;
 IF e.state='restored' THEN RAISE EXCEPTION 'Already restored' USING ERRCODE='PT409'; END IF;
 PERFORM y_sheets_private.purge_trash_entry(p_entry);
END $$;
-- Bounded, concurrency-safe maintenance for pg_cron or a trusted service scheduler.
CREATE FUNCTION public.purge_expired_y_sheets_trash() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item uuid; removed integer:=0;
BEGIN
 FOR item IN SELECT id FROM y_sheets_private.trash_entries WHERE state='trashed' AND expires_at<=clock_timestamp()
 ORDER BY expires_at,id LIMIT 200 FOR UPDATE SKIP LOCKED LOOP
  PERFORM y_sheets_private.purge_trash_entry(item);removed:=removed+1;
 END LOOP;
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION y_sheets_private.lock_trash_owner(uuid),y_sheets_private.purge_trash_entry(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.trash_y_sheets(uuid,text,uuid,bigint),public.list_y_sheets_trash(uuid,integer),public.restore_y_sheets_trash(uuid,uuid),public.purge_y_sheets_trash(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.trash_y_sheets(uuid,text,uuid,bigint),public.list_y_sheets_trash(uuid,integer),public.restore_y_sheets_trash(uuid,uuid),public.purge_y_sheets_trash(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_y_sheets_trash() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_y_sheets_trash() TO service_role;
CREATE OR REPLACE FUNCTION public.save_y_sheets_workbook(p_id uuid, p_request_id uuid, p_expected_revision bigint, p_content jsonb, p_expected_owner_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_row public.y_sheets_workbooks; v_receipt y_sheets_private.save_receipts;
  v_hash bytea; v_revision bigint;
BEGIN
  -- The owner hint is a session-race precondition, never an identity source.
  IF v_actor IS NULL OR v_actor IS DISTINCT FROM p_expected_owner_id THEN
    RAISE EXCEPTION 'Session changed or not authenticated' USING ERRCODE='42501';
  END IF;
  IF p_id IS NULL OR p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0
    OR p_content IS NULL OR jsonb_typeof(p_content) IS DISTINCT FROM 'object'
    OR p_content->>'id' IS DISTINCT FROM p_id::text
    OR jsonb_typeof(p_content->'name') IS DISTINCT FROM 'string'
    OR length(trim(p_content->>'name')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_content->'sheets') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_content->'activeSheetId') IS DISTINCT FROM 'string'
    OR octet_length(p_content::text) > 5242880 THEN
    RAISE EXCEPTION 'Invalid workbook' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_content->'sheets') NOT BETWEEN 1 AND 32
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_content->'sheets') s WHERE s->>'id'=p_content->>'activeSheetId') THEN
    RAISE EXCEPTION 'Invalid sheets' USING ERRCODE='22023';
  END IF;
  -- Serialize even creation and deletion for this ID. Hash collision only adds waiting.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  IF EXISTS(SELECT 1 FROM y_sheets_private.lifecycle WHERE kind='workbook' AND id=p_id
    AND (state<>'restored' OR owner_id<>v_actor OR p_expected_revision<revision_floor))
  THEN RAISE EXCEPTION 'Workbook deleted or restored; reload' USING ERRCODE='PT409'; END IF;
  SELECT * INTO v_row FROM public.y_sheets_workbooks WHERE id=p_id FOR UPDATE;
  IF FOUND AND v_row.owner_id <> v_actor THEN
    RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501';
  END IF;
  v_hash := sha256(convert_to(p_content::text,'UTF8'));
  SELECT * INTO v_receipt FROM y_sheets_private.save_receipts
    WHERE owner_id=v_actor AND workbook_id=p_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'Workbook deleted' USING ERRCODE='PT409'; END IF;
    IF v_receipt.expected_revision <> p_expected_revision OR v_receipt.payload_hash <> v_hash THEN
      RAISE EXCEPTION 'Request ID reused for different content' USING ERRCODE='22023';
    END IF;
    RETURN v_receipt.result_revision;
  END IF;
  IF p_expected_revision = 0 AND v_row.id IS NULL AND NOT EXISTS(
    SELECT 1 FROM y_sheets_private.save_receipts WHERE workbook_id=p_id
  ) THEN
    INSERT INTO public.y_sheets_workbooks(id,owner_id,name,content)
      VALUES(p_id,v_actor,p_content->>'name',p_content) RETURNING revision INTO v_revision;
  ELSE
    IF v_row.id IS NULL OR v_row.revision <> p_expected_revision THEN
      RAISE EXCEPTION 'Workbook conflict' USING ERRCODE='PT409';
    END IF;
    UPDATE public.y_sheets_workbooks SET name=p_content->>'name',content=p_content,revision=revision+1
      WHERE id=p_id RETURNING revision INTO v_revision;
  END IF;
  INSERT INTO y_sheets_private.save_receipts VALUES(v_actor,p_id,p_request_id,p_expected_revision,v_hash,v_revision);
  RETURN v_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.save_y_sheets_workbook(uuid,uuid,bigint,jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_y_sheets_workbook(uuid,uuid,bigint,jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.organize_y_sheets(p_owner uuid,p_kind text,p_id uuid,p_revision bigint,
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
 IF EXISTS(SELECT 1 FROM y_sheets_private.lifecycle WHERE kind=p_kind AND id=p_id
   AND (state<>'restored' OR owner_id<>actor OR (p_kind='folder' AND p_revision<revision_floor)))
 THEN RAISE EXCEPTION 'Item deleted or restored; refresh' USING ERRCODE='PT409'; END IF;
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

-- Installation is optional locally; launch must provide pg_cron or the service scheduler.
DO $$ BEGIN
 IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
  PERFORM cron.schedule('yhub-sheets-trash-expiry','*/5 * * * *','SELECT public.purge_expired_y_sheets_trash()');
 ELSE RAISE NOTICE 'Trash expiry is enforced on restore/list; configure scheduled purge before launch'; END IF;
END $$;
COMMIT;
