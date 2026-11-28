-- Decision69: bounded Owner export. Evidence records issuance, not a disk receipt.
BEGIN;
CREATE FUNCTION public.export_audit_page(p_event_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_events jsonb; v_export uuid:=gen_random_uuid(); v_time timestamptz:=clock_timestamp(); v_name text;
BEGIN
 -- Holds the current profile against concurrent role withdrawal until commit.
 PERFORM yhub_audit_private.require_retention_owner();
 IF p_event_ids IS NULL OR cardinality(p_event_ids) NOT BETWEEN 1 AND 25
 OR array_ndims(p_event_ids)<>1 OR array_position(p_event_ids,NULL) IS NOT NULL
 OR (SELECT count(DISTINCT id) FROM unnest(p_event_ids) ids(id))<>cardinality(p_event_ids) THEN
  RAISE EXCEPTION 'Invalid export selection' USING ERRCODE='22023';
 END IF;
 -- Same ordering as the browser page; missing/deleted selections fail atomically.
 SELECT coalesce(jsonb_agg(to_jsonb(e)-'search_document'-'transaction_id'||jsonb_build_object('people',coalesce((
  SELECT jsonb_agg(to_jsonb(p)-'event_id' ORDER BY relation,person_id)
  FROM public.audit_event_people p WHERE p.event_id=e.id
 ),'[]'::jsonb)) ORDER BY e.occurred_at DESC,e.id DESC),'[]'::jsonb)
 INTO v_events FROM public.audit_events e WHERE e.id=ANY(p_event_ids);
 IF jsonb_array_length(v_events)<>cardinality(p_event_ids) THEN
  RAISE EXCEPTION 'Export selection changed; reload' USING ERRCODE='PT409';
 END IF;
 SELECT full_name INTO v_name FROM public.users WHERE id=auth.uid();
 INSERT INTO public.audit_events(id,occurred_at,actor_id,actor_role,actor_name,operation,actions,
  entity_type,entity_id,sensitivity,super_admin_only,old_values,new_values,context,search_document)
 VALUES(v_export,v_time,auth.uid(),'super_admin',left(coalesce(v_name,''),150),'INSERT',ARRAY['audit_export_issued'],
  'audit_exports',v_export,'critical',true,'{}',jsonb_build_object('count',cardinality(p_event_ids),'event_ids',p_event_ids),
  jsonb_build_object('format','json','scope','selected_page','delivery','issued'),to_tsvector('simple','audit_export_issued'));
 PERFORM yhub_audit_private.record_people(v_export,'{}','{}',true);
 -- Response and evidence share the transaction. Failure never returns unaudited data.
 RETURN jsonb_build_object('format_version',1,'export_id',v_export,'issued_at',v_time,'scope','selected_page','events',v_events);
END;
$$;
REVOKE ALL ON FUNCTION public.export_audit_page(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.export_audit_page(uuid[]) TO authenticated;
COMMIT;
