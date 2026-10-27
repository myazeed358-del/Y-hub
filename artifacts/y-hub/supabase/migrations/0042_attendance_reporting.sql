-- Filtered reporting for approved decisions 7/33. Existing write/audit paths remain unchanged.
BEGIN;
CREATE FUNCTION public.attendance_report_v2(
 p_course uuid,p_offset integer DEFAULT 0,p_limit integer DEFAULT 100,
 p_student uuid DEFAULT NULL,p_lecture uuid DEFAULT NULL,
 p_from timestamptz DEFAULT NULL,p_to timestamptz DEFAULT NULL,
 p_status text DEFAULT NULL,p_state text DEFAULT NULL,p_search text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;v_manager boolean;v_result jsonb;
BEGIN
 SELECT role INTO v_role FROM public.users WHERE id=auth.uid();
 v_manager:=yhub_attendance_private.manages(p_course);
 IF NOT v_manager AND v_role IS DISTINCT FROM 'student' THEN
  RAISE EXCEPTION 'Read denied' USING ERRCODE='42501';
 END IF;
 -- Students retain only their own historical attendance after withdrawal.
 IF NOT v_manager AND p_student IS NOT NULL AND p_student IS DISTINCT FROM auth.uid() THEN
  RAISE EXCEPTION 'Student scope denied' USING ERRCODE='42501';
 END IF;
 IF p_course IS NULL OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200
  OR length(coalesce(p_search,''))>100
  OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>=p_to)
  OR (p_status IS NOT NULL AND p_status NOT IN ('present','absent','excused'))
  OR (p_state IS NOT NULL AND p_state NOT IN ('open','closed','cancelled')) THEN
  RAISE EXCEPTION 'Invalid report filters' USING ERRCODE='22023';
 END IF;
 WITH scoped AS MATERIALIZED (
  -- Explicit projection: never export reasons, actor identifiers or QR secrets.
  SELECT r.id,r.session_id,r.student_id,u.full_name,u.user_number,l.title,s.opened_at AS starts_at,
   r.status,r.method,
   CASE WHEN l.cancelled OR s.state='cancelled' THEN 'cancelled'
    WHEN s.state='open' AND s.expires_at<=statement_timestamp() THEN 'closed' ELSE s.state END AS state
  FROM public.attendance_records r JOIN public.users u ON u.id=r.student_id
  JOIN public.attendance_sessions s ON s.id=r.session_id JOIN public.academic_lectures l ON l.id=s.lecture_id
  WHERE r.course_id=p_course AND (v_manager OR r.student_id=auth.uid())
   AND (p_student IS NULL OR r.student_id=p_student)
   AND (p_lecture IS NULL OR l.id=p_lecture)
   AND (p_from IS NULL OR s.opened_at>=p_from) AND (p_to IS NULL OR s.opened_at<p_to)
   AND (p_status IS NULL OR r.status=p_status)
   AND (coalesce(btrim(p_search),'')='' OR strpos(lower(coalesce(u.full_name,'')),lower(btrim(p_search)))>0 OR strpos(u.user_number,btrim(p_search))>0)
 ), filtered AS MATERIALIZED (SELECT * FROM scoped WHERE p_state IS NULL OR state=p_state),
 final AS (SELECT * FROM filtered WHERE state='closed'),
 trend AS (
  SELECT (starts_at AT TIME ZONE 'UTC')::date AS day,count(*) AS eligible,
   count(*) FILTER(WHERE status='present') AS present,count(*) FILTER(WHERE status='absent') AS absent,
   count(*) FILTER(WHERE status='excused') AS excused
  FROM final GROUP BY 1 ORDER BY 1 DESC LIMIT 30
 )
 SELECT jsonb_build_object(
  'rows',(SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.starts_at DESC,page.id),'[]'::jsonb)
   FROM (SELECT * FROM filtered ORDER BY starts_at DESC,id LIMIT p_limit OFFSET p_offset) page),
  'total',(SELECT count(*) FROM filtered),
  'stats',(SELECT jsonb_build_object('eligible',count(*),'present',count(*) FILTER(WHERE status='present'),
   'absent',count(*) FILTER(WHERE status='absent'),'excused',count(*) FILTER(WHERE status='excused')) FROM final),
  'trend',(SELECT coalesce(jsonb_agg(to_jsonb(trend) ORDER BY day),'[]'::jsonb) FROM trend),
  -- Consistency checksum only, never an authorization token. Detect changes between export pages.
  'revision',(SELECT md5(coalesce(string_agg(md5(to_jsonb(f)::text),'' ORDER BY id),'')) FROM filtered f)
 ) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.attendance_report_v2(uuid,integer,integer,uuid,uuid,timestamptz,timestamptz,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.attendance_report_v2(uuid,integer,integer,uuid,uuid,timestamptz,timestamptz,text,text,text) TO authenticated;
COMMENT ON FUNCTION public.attendance_report_v2(uuid,integer,integer,uuid,uuid,timestamptz,timestamptz,text,text,text)
 IS 'Current-role scoped attendance, half-open date range, closed non-cancelled statistics, latest 30 UTC activity dates. Revision is export consistency only.';
COMMIT;
