-- Decisions51/54/62: independent folder grants and revocable effective access.
BEGIN;
-- Freeze source grants until the initial derived snapshot and its triggers exist.
LOCK TABLE y_sheets_private.shares IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE y_sheets_private.folder_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 folder_id uuid NOT NULL REFERENCES public.y_sheets_folders(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 permission text NOT NULL CHECK(permission IN ('view','edit','none')),
 revision bigint NOT NULL CHECK(revision>0), UNIQUE(folder_id,recipient_id)
);
CREATE INDEX sheets_folder_shares_recipient ON y_sheets_private.folder_shares(recipient_id,folder_id);
-- Derived authorization state, never a source grant. Tombstones prevent old-session resurrection.
CREATE TABLE y_sheets_private.effective_shares (
 workbook_id uuid NOT NULL REFERENCES public.y_sheets_workbooks(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 permission text NOT NULL CHECK(permission IN ('view','edit','none')),
 revision bigint NOT NULL CHECK(revision>0), sources jsonb NOT NULL,
 PRIMARY KEY(workbook_id,recipient_id)
);
CREATE INDEX sheets_effective_recipient ON y_sheets_private.effective_shares(recipient_id,workbook_id);
ALTER TABLE y_sheets_private.folder_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.folder_shares FORCE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.effective_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.effective_shares FORCE ROW LEVEL SECURITY;
REVOKE ALL ON y_sheets_private.folder_shares,y_sheets_private.effective_shares FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON y_sheets_private.folder_shares FOR EACH ROW
 EXECUTE FUNCTION yhub_audit_private.capture('id,folder_id,recipient_id,permission,revision','id,folder_id,recipient_id,permission,revision','reserved');
-- Existing direct grants retain their current session revision; no new access is granted.
INSERT INTO y_sheets_private.effective_shares
 SELECT workbook_id,recipient_id,permission,revision,
 CASE WHEN permission='none' THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('kind','workbook','id',workbook_id,'permission',permission,'revision',revision)) END
 FROM y_sheets_private.shares;

CREATE FUNCTION y_sheets_private.refresh_inheritance(p_owner uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,430));
 -- RPC callers already hold this tree lock before any per-file lock. The derived state
 -- changes atomically with the source grant/move and its mandatory audit event.
 WITH RECURSIVE ancestors AS (
  SELECT l.id workbook_id,f.id,f.parent_id FROM y_sheets_private.locations l
   JOIN public.y_sheets_folders f ON f.id=l.parent_id AND f.owner_id=p_owner WHERE l.owner_id=p_owner
  UNION ALL SELECT a.workbook_id,f.id,f.parent_id FROM ancestors a
   JOIN public.y_sheets_folders f ON f.id=a.parent_id AND f.owner_id=p_owner
 ), grants AS (
  SELECT s.workbook_id,s.recipient_id,s.permission,'workbook'::text kind,s.workbook_id source_id,s.revision
   FROM y_sheets_private.shares s JOIN public.y_sheets_workbooks w ON w.id=s.workbook_id
   WHERE w.owner_id=p_owner AND s.permission<>'none'
  UNION ALL
  SELECT a.workbook_id,s.recipient_id,s.permission,'folder',s.folder_id,s.revision
   FROM ancestors a JOIN y_sheets_private.folder_shares s ON s.folder_id=a.id WHERE s.permission<>'none'
 ), desired AS (
  SELECT workbook_id,recipient_id,CASE WHEN bool_or(permission='edit') THEN 'edit' ELSE 'view' END permission,
   jsonb_agg(jsonb_build_object('kind',kind,'id',source_id,'permission',permission,'revision',revision) ORDER BY kind,source_id) sources
   FROM grants GROUP BY workbook_id,recipient_id
 ), states AS (
  SELECT * FROM desired
  UNION ALL SELECT e.workbook_id,e.recipient_id,'none','[]'::jsonb FROM y_sheets_private.effective_shares e
   JOIN public.y_sheets_workbooks w ON w.id=e.workbook_id
   WHERE w.owner_id=p_owner AND NOT EXISTS(SELECT 1 FROM desired d WHERE (d.workbook_id,d.recipient_id)=(e.workbook_id,e.recipient_id))
 ) INSERT INTO y_sheets_private.effective_shares(workbook_id,recipient_id,permission,revision,sources)
 SELECT workbook_id,recipient_id,permission,1,sources FROM states ORDER BY workbook_id,recipient_id
 ON CONFLICT(workbook_id,recipient_id) DO UPDATE SET permission=EXCLUDED.permission,sources=EXCLUDED.sources,revision=effective_shares.revision+1
 WHERE (effective_shares.permission,effective_shares.sources) IS DISTINCT FROM (EXCLUDED.permission,EXCLUDED.sources);
END $$;
CREATE FUNCTION y_sheets_private.refresh_inheritance_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE owner uuid;
BEGIN
 IF TG_TABLE_NAME='shares' THEN
  SELECT owner_id INTO owner FROM public.y_sheets_workbooks WHERE id=coalesce(NEW.workbook_id,OLD.workbook_id);
 ELSIF TG_TABLE_NAME='folder_shares' THEN
  SELECT owner_id INTO owner FROM public.y_sheets_folders WHERE id=coalesce(NEW.folder_id,OLD.folder_id);
 ELSE owner:=coalesce(NEW.owner_id,OLD.owner_id); END IF;
 IF owner IS NOT NULL THEN PERFORM y_sheets_private.refresh_inheritance(owner); END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER refresh_inheritance AFTER INSERT OR UPDATE OR DELETE ON y_sheets_private.shares FOR EACH ROW EXECUTE FUNCTION y_sheets_private.refresh_inheritance_trigger();
CREATE TRIGGER refresh_inheritance AFTER INSERT OR UPDATE OR DELETE ON y_sheets_private.folder_shares FOR EACH ROW EXECUTE FUNCTION y_sheets_private.refresh_inheritance_trigger();
CREATE TRIGGER refresh_inheritance AFTER INSERT OR UPDATE OF parent_id ON y_sheets_private.locations FOR EACH ROW EXECUTE FUNCTION y_sheets_private.refresh_inheritance_trigger();
CREATE TRIGGER refresh_inheritance AFTER UPDATE OF parent_id ON public.y_sheets_folders FOR EACH ROW EXECUTE FUNCTION y_sheets_private.refresh_inheritance_trigger();

CREATE OR REPLACE FUNCTION y_sheets_private.lock_owner(p_actor uuid,p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.users WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,430));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 PERFORM id FROM public.y_sheets_workbooks WHERE id=p_id AND owner_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION y_sheets_private.lock_folder_owner(p_actor uuid,p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.users WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,430));
 PERFORM id FROM public.y_sheets_folders WHERE id=p_id AND owner_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Folder unavailable' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.preview_y_sheets_folder_recipient(p_actor uuid,p_id uuid,p_number text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM y_sheets_private.lock_folder_owner(p_actor,p_id);
 IF p_number IS NULL OR p_number !~ '^[0-9]{9}$' THEN RAISE EXCEPTION 'Exact Y-Hub number required' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',u.id,'number',u.user_number,'name',u.full_name,'revision',coalesce(s.revision,0))
 INTO result FROM public.users u LEFT JOIN y_sheets_private.folder_shares s ON s.recipient_id=u.id AND s.folder_id=p_id WHERE u.user_number=p_number AND u.id<>p_actor;
 RETURN result;
END $$;
CREATE FUNCTION public.list_y_sheets_folder_shares(p_actor uuid,p_id uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM y_sheets_private.lock_folder_owner(p_actor,p_id);
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO result FROM (
 SELECT s.recipient_id id,u.user_number number,u.full_name name,s.permission,s.revision
 FROM y_sheets_private.folder_shares s JOIN public.users u ON u.id=s.recipient_id WHERE s.folder_id=p_id
 ORDER BY u.user_number,s.recipient_id OFFSET p_offset LIMIT 51) r;
 RETURN result;
END $$;
CREATE FUNCTION public.set_y_sheets_folder_share(p_actor uuid,p_id uuid,p_recipient uuid,p_permission text,p_revision bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s y_sheets_private.folder_shares; result bigint;
BEGIN
 PERFORM y_sheets_private.lock_folder_owner(p_actor,p_id);
 IF p_permission IS NULL OR p_permission NOT IN ('view','edit','none') OR p_recipient IS NULL OR p_recipient=p_actor OR p_revision IS NULL OR p_revision<0
 THEN RAISE EXCEPTION 'Invalid share' USING ERRCODE='22023'; END IF;
 PERFORM id FROM public.users WHERE id=p_recipient FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipient unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM y_sheets_private.folder_shares WHERE folder_id=p_id AND recipient_id=p_recipient;
 IF s.id IS NOT NULL AND s.permission=p_permission THEN RETURN s.revision; END IF;
 IF coalesce(s.revision,0)<>p_revision THEN RAISE EXCEPTION 'Share changed; refresh' USING ERRCODE='PT409'; END IF;
 IF s.id IS NULL AND p_permission='none' THEN RETURN 0; END IF;
 INSERT INTO y_sheets_private.folder_shares(folder_id,recipient_id,permission,revision) VALUES(p_id,p_recipient,p_permission,1)
 ON CONFLICT(folder_id,recipient_id) DO UPDATE SET permission=EXCLUDED.permission,revision=folder_shares.revision+1 RETURNING revision INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION y_sheets_private.shared_access(p_actor uuid,p_id uuid,p_grant bigint)
RETURNS y_sheets_private.shares LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s y_sheets_private.shares; e y_sheets_private.effective_shares; owner uuid;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.users WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 SELECT owner_id INTO owner FROM public.y_sheets_workbooks WHERE id=p_id;
 IF owner IS NULL THEN RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(owner::text,430));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 PERFORM id FROM public.y_sheets_workbooks WHERE id=p_id AND owner_id=owner FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM y_sheets_private.effective_shares WHERE workbook_id=p_id AND recipient_id=p_actor FOR SHARE;
 IF NOT FOUND OR e.permission='none' OR (p_grant IS NOT NULL AND p_grant<>e.revision)
 THEN RAISE EXCEPTION 'Shared access changed' USING ERRCODE='42501'; END IF;
 -- Preserve the private helper return type and existing read/save RPC contracts.
 s.workbook_id:=p_id;s.recipient_id:=p_actor;s.permission:=e.permission;s.revision:=e.revision;
 RETURN s;
END $$;
CREATE OR REPLACE FUNCTION public.list_shared_y_sheets(p_actor uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor) THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO result FROM (
  SELECT w.id,w.name,u.full_name "ownerName",s.permission FROM y_sheets_private.effective_shares s
  JOIN public.y_sheets_workbooks w ON w.id=s.workbook_id JOIN public.users u ON u.id=w.owner_id
  WHERE s.recipient_id=p_actor AND s.permission<>'none' ORDER BY w.updated_at DESC,w.id OFFSET p_offset LIMIT 51
 ) r;
 RETURN result;
END $$;
-- Owner-only explanation of inherited grants; direct management stays independent.
CREATE FUNCTION public.list_y_sheets_inherited(p_actor uuid,p_id uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM y_sheets_private.lock_owner(p_actor,p_id);
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO result FROM (
  SELECT e.recipient_id id,u.user_number number,u.full_name name,src->>'permission' permission,
   f.id "folderId",f.name "folderName"
  FROM y_sheets_private.effective_shares e JOIN public.users u ON u.id=e.recipient_id
   CROSS JOIN LATERAL jsonb_array_elements(e.sources) src
   JOIN public.y_sheets_folders f ON f.id=(src->>'id')::uuid AND f.owner_id=p_actor
  WHERE e.workbook_id=p_id AND src->>'kind'='folder'
  ORDER BY u.user_number,e.recipient_id,f.id OFFSET p_offset LIMIT 51
 ) r;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION y_sheets_private.refresh_inheritance(uuid),y_sheets_private.refresh_inheritance_trigger(),y_sheets_private.lock_folder_owner(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.preview_y_sheets_folder_recipient(uuid,uuid,text),public.list_y_sheets_folder_shares(uuid,uuid,integer),public.set_y_sheets_folder_share(uuid,uuid,uuid,text,bigint),public.list_y_sheets_inherited(uuid,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.preview_y_sheets_folder_recipient(uuid,uuid,text),public.list_y_sheets_folder_shares(uuid,uuid,integer),public.set_y_sheets_folder_share(uuid,uuid,uuid,text,bigint),public.list_y_sheets_inherited(uuid,uuid,integer) TO authenticated;
COMMIT;
