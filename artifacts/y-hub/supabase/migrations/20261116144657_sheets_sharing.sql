-- Decision50: explicit direct sharing. No inherited folder grants or history rewrite.
BEGIN;
CREATE TABLE y_sheets_private.shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workbook_id uuid NOT NULL REFERENCES public.y_sheets_workbooks(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 permission text NOT NULL CHECK(permission IN ('view','edit','none')),
 revision bigint NOT NULL CHECK(revision>0),
 UNIQUE(workbook_id,recipient_id)
);
CREATE INDEX sheets_shares_recipient ON y_sheets_private.shares(recipient_id,workbook_id);
CREATE TABLE y_sheets_private.shared_receipts (
 workbook_id uuid NOT NULL REFERENCES public.y_sheets_workbooks(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, grant_revision bigint NOT NULL, expected_revision bigint NOT NULL,
 payload_hash bytea NOT NULL, result_revision bigint NOT NULL,
 PRIMARY KEY(workbook_id,actor_id,request_id)
);
CREATE INDEX sheets_shared_receipts_actor ON y_sheets_private.shared_receipts(actor_id);
ALTER TABLE y_sheets_private.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.shares FORCE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.shared_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE y_sheets_private.shared_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON y_sheets_private.shares,y_sheets_private.shared_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER audit_capture AFTER INSERT OR UPDATE OR DELETE ON y_sheets_private.shares FOR EACH ROW
 EXECUTE FUNCTION yhub_audit_private.capture('id,workbook_id,recipient_id,permission,revision','id,workbook_id,recipient_id,permission,revision','reserved');

CREATE FUNCTION y_sheets_private.lock_owner(p_actor uuid,p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.users WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 PERFORM id FROM public.y_sheets_workbooks WHERE id=p_id AND owner_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.preview_y_sheets_recipient(p_actor uuid,p_id uuid,p_number text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM y_sheets_private.lock_owner(p_actor,p_id);
 IF p_number IS NULL OR p_number !~ '^[0-9]{9}$' THEN RAISE EXCEPTION 'Exact Y-Hub number required' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',u.id,'number',u.user_number,'name',u.full_name,'revision',coalesce(s.revision,0))
 INTO result FROM public.users u LEFT JOIN y_sheets_private.shares s ON s.recipient_id=u.id AND s.workbook_id=p_id WHERE u.user_number=p_number AND u.id<>p_actor;
 RETURN result;
END $$;
CREATE FUNCTION public.list_y_sheets_shares(p_actor uuid,p_id uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM y_sheets_private.lock_owner(p_actor,p_id);
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO result FROM (
 SELECT s.recipient_id id,u.user_number number,u.full_name name,s.permission,s.revision
 FROM y_sheets_private.shares s JOIN public.users u ON u.id=s.recipient_id WHERE s.workbook_id=p_id
 ORDER BY u.user_number,s.recipient_id OFFSET p_offset LIMIT 51) r;
 RETURN result;
END $$;
CREATE FUNCTION public.set_y_sheets_share(p_actor uuid,p_id uuid,p_recipient uuid,p_permission text,p_revision bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s y_sheets_private.shares; result bigint;
BEGIN
 PERFORM y_sheets_private.lock_owner(p_actor,p_id);
 IF p_permission IS NULL OR p_permission NOT IN ('view','edit','none') OR p_recipient IS NULL OR p_recipient=p_actor OR p_revision IS NULL OR p_revision<0
 THEN RAISE EXCEPTION 'Invalid share' USING ERRCODE='22023'; END IF;
 PERFORM id FROM public.users WHERE id=p_recipient FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipient unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM y_sheets_private.shares WHERE workbook_id=p_id AND recipient_id=p_recipient;
 IF s.id IS NOT NULL AND s.permission=p_permission THEN RETURN s.revision; END IF;
 IF coalesce(s.revision,0)<>p_revision THEN RAISE EXCEPTION 'Share changed; refresh' USING ERRCODE='PT409'; END IF;
 IF s.id IS NULL AND p_permission='none' THEN RETURN 0; END IF;
 INSERT INTO y_sheets_private.shares(workbook_id,recipient_id,permission,revision) VALUES(p_id,p_recipient,p_permission,1)
 ON CONFLICT(workbook_id,recipient_id) DO UPDATE SET permission=EXCLUDED.permission,revision=shares.revision+1 RETURNING revision INTO result;
 RETURN result;
END $$;
CREATE FUNCTION y_sheets_private.shared_access(p_actor uuid,p_id uuid,p_grant bigint)
RETURNS y_sheets_private.shares LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s y_sheets_private.shares;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.users WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 -- Same lock/order as owner saves, delete and share mutation: revocation cannot
 -- commit before an in-flight authorized write and then be bypassed by that write.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 PERFORM id FROM public.y_sheets_workbooks WHERE id=p_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workbook unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM y_sheets_private.shares WHERE workbook_id=p_id AND recipient_id=p_actor FOR SHARE;
 IF NOT FOUND OR s.permission='none' OR (p_grant IS NOT NULL AND p_grant<>s.revision)
 THEN RAISE EXCEPTION 'Shared access changed' USING ERRCODE='42501'; END IF;
 RETURN s;
END $$;
CREATE FUNCTION public.read_shared_y_sheets(p_actor uuid,p_id uuid,p_grant bigint DEFAULT NULL,p_content boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s y_sheets_private.shares; w public.y_sheets_workbooks;
BEGIN
 s:=y_sheets_private.shared_access(p_actor,p_id,p_grant);
 SELECT * INTO w FROM public.y_sheets_workbooks WHERE id=p_id;
 RETURN jsonb_build_object('permission',s.permission,'grantRevision',s.revision,'revision',w.revision,
 'workbook',CASE WHEN p_content THEN w.content||jsonb_build_object('id',w.id,'name',w.name) END);
END $$;
CREATE FUNCTION public.list_shared_y_sheets(p_actor uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor) THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO result FROM (
  SELECT w.id,w.name,u.full_name "ownerName",s.permission FROM y_sheets_private.shares s
  JOIN public.y_sheets_workbooks w ON w.id=s.workbook_id JOIN public.users u ON u.id=w.owner_id
  WHERE s.recipient_id=p_actor AND s.permission<>'none' ORDER BY w.updated_at DESC,w.id OFFSET p_offset LIMIT 51
 ) r;
 RETURN result;
END $$;
CREATE FUNCTION public.save_shared_y_sheets(p_actor uuid,p_id uuid,p_grant bigint,p_request uuid,p_revision bigint,p_content jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s y_sheets_private.shares; w public.y_sheets_workbooks; r y_sheets_private.shared_receipts; h bytea; result bigint;
BEGIN
 IF p_grant IS NULL OR p_grant<1 OR p_request IS NULL OR p_revision IS NULL OR p_revision<1 THEN RAISE EXCEPTION 'Invalid version' USING ERRCODE='22023'; END IF;
 s:=y_sheets_private.shared_access(p_actor,p_id,p_grant);
 IF s.permission<>'edit' THEN RAISE EXCEPTION 'Editing denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM public.y_sheets_workbooks WHERE id=p_id FOR UPDATE;
 IF p_content IS NULL OR jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR p_content->>'id' IS DISTINCT FROM p_id::text
 OR jsonb_typeof(p_content->'name') IS DISTINCT FROM 'string' OR p_content->>'name' IS DISTINCT FROM w.name
 OR jsonb_typeof(p_content->'sheets') IS DISTINCT FROM 'array' OR jsonb_typeof(p_content->'activeSheetId') IS DISTINCT FROM 'string'
 OR octet_length(p_content::text)>5242880 THEN RAISE EXCEPTION 'Invalid workbook' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_content->'sheets') NOT BETWEEN 1 AND 32 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_content->'sheets') a WHERE a->>'id'=p_content->>'activeSheetId')
 THEN RAISE EXCEPTION 'Invalid sheets' USING ERRCODE='22023'; END IF;
 h:=sha256(convert_to(p_content::text,'UTF8'));
 SELECT * INTO r FROM y_sheets_private.shared_receipts WHERE workbook_id=p_id AND actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF (r.grant_revision,r.expected_revision,r.payload_hash) IS DISTINCT FROM (p_grant,p_revision,h) THEN RAISE EXCEPTION 'Request reused' USING ERRCODE='22023'; END IF;
  RETURN r.result_revision;
 END IF;
 IF w.revision<>p_revision THEN RAISE EXCEPTION 'Workbook conflict' USING ERRCODE='PT409'; END IF;
 UPDATE public.y_sheets_workbooks SET content=p_content,revision=revision+1 WHERE id=p_id RETURNING revision INTO result;
 INSERT INTO y_sheets_private.shared_receipts VALUES(p_id,p_actor,p_request,p_grant,p_revision,h,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION y_sheets_private.lock_owner(uuid,uuid),y_sheets_private.shared_access(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.preview_y_sheets_recipient(uuid,uuid,text),public.list_y_sheets_shares(uuid,uuid,integer),
 public.set_y_sheets_share(uuid,uuid,uuid,text,bigint),public.read_shared_y_sheets(uuid,uuid,bigint,boolean),public.list_shared_y_sheets(uuid,integer),
 public.save_shared_y_sheets(uuid,uuid,bigint,uuid,bigint,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.preview_y_sheets_recipient(uuid,uuid,text),public.list_y_sheets_shares(uuid,uuid,integer),
 public.set_y_sheets_share(uuid,uuid,uuid,text,bigint),public.read_shared_y_sheets(uuid,uuid,bigint,boolean),public.list_shared_y_sheets(uuid,integer),
 public.save_shared_y_sheets(uuid,uuid,bigint,uuid,bigint,jsonb) TO authenticated;

-- New share events identify the recipient as affected; historical events remain unchanged.
CREATE OR REPLACE FUNCTION yhub_audit_private.record_people(p_event uuid,p_old jsonb,p_new jsonb,p_recorded boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.audit_events%ROWTYPE; r record; u public.users%ROWTYPE; v_row jsonb; v_number text; v_name text;
BEGIN
 SELECT * INTO STRICT e FROM public.audit_events WHERE id=p_event;
 FOR r IN
  SELECT DISTINCT relation,person_id FROM (
   SELECT 'actor'::text relation,e.actor_id person_id WHERE e.actor_id IS NOT NULL
   UNION ALL
   SELECT 'affected', x.id::uuid FROM (
    SELECT e.entity_id::text id WHERE e.entity_type='users'
    UNION ALL SELECT row_data->>key FROM (VALUES(p_old),(p_new)) rows(row_data)
      CROSS JOIN (VALUES('student_id'),('instructor_id'),('recipient_id')) keys(key)
   ) x WHERE x.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  ) people
 LOOP
  SELECT * INTO u FROM public.users WHERE id=r.person_id;
  v_row:=CASE WHEN e.entity_type='users' AND e.entity_id=r.person_id
    THEN CASE WHEN e.operation='DELETE' THEN p_old ELSE p_new END ELSE '{}'::jsonb END;
  v_number:=coalesce(u.user_number,v_row->>'user_number');
  IF v_number IS NULL THEN
   -- The immutable number ledger survives account deletion. Do not guess if ambiguous.
   SELECT CASE WHEN count(DISTINCT user_number)=1 THEN min(user_number) END INTO v_number
   FROM yhub_internal.user_number_issues WHERE auth_user_id=r.person_id;
  END IF;
  v_name:=CASE WHEN r.relation='actor' THEN e.actor_name
    ELSE coalesce(u.full_name,NULLIF(v_row->>'full_name','[REDACTED]'),'') END;
  INSERT INTO public.audit_event_people(event_id,relation,person_id,full_name,full_name_ar,full_name_en,user_number,recorded)
  VALUES(e.id,r.relation,r.person_id,left(v_name,150),
   CASE WHEN p_recorded THEN left(coalesce(u.full_name_ar,v_row->>'full_name_ar'),120) END,
   CASE WHEN p_recorded THEN left(coalesce(u.full_name_en,v_row->>'full_name_en'),120) END,
   v_number,p_recorded);
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION yhub_audit_private.record_people(uuid,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
