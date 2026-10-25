"""Approved decisions 2-6,8-10,35-37; disposable PostgreSQL, no production target."""
import json, unittest
from concurrent.futures import ThreadPoolExecutor
from support import run, value, I, A, S, O
from test_attendance import setup_session, token, checkin, lecture
from test_engine_grants import student

class AttendanceLifecycle(unittest.TestCase):
 def test_configurable_qr_and_independent_duration(self):
  c,l=lecture(); s=value(f"SELECT public.open_attendance_v2('{l}',5,30)",I)
  row=json.loads(value(f"SELECT public.get_attendance_session('{l}')",I))
  self.assertEqual(row['qr_interval_seconds'],30)
  self.assertEqual(value(f"SELECT extract(epoch FROM expires_at-opened_at)::int FROM public.attendance_sessions WHERE id='{s}'"),'300')
  qr=json.loads(value(f"SELECT public.attendance_qr('{s}')",I)); self.assertEqual(qr['intervalSeconds'],30)
  self.assertEqual(value(f"SELECT public.open_attendance_v2('{l}',10,60)",I),s)
 def test_configuration_bounds_and_privileges(self):
  for duration,interval in [(0,10),(121,10),(10,9),(10,121),(None,10),(10,None)]:
   c,l=lecture(); d='NULL' if duration is None else str(duration); q='NULL' if interval is None else str(interval)
   with self.assertRaises(AssertionError):value(f"SELECT public.open_attendance_v2('{l}',{d},{q})",I)
  c,l=lecture()
  for actor in [O,student()]:
   with self.assertRaises(AssertionError):value(f"SELECT public.open_attendance_v2('{l}',10,10)",actor)
 def test_optional_reason_binary_status_and_past_correction(self):
  c,l,u,s=setup_session(); value(f"SELECT public.close_attendance('{s}')",I)
  run(f"UPDATE public.attendance_sessions SET opened_at=opened_at-interval '30 days', closed_at=closed_at-interval '30 days' WHERE id='{s}'")
  r=value(f"SELECT public.correct_attendance('{s}','{u}','present')",I)
  event=json.loads(value(f"SELECT new_values FROM public.audit_events WHERE entity_id='{r}' ORDER BY occurred_at DESC LIMIT 1",A))
  self.assertEqual(event['status'],'present')
  with self.assertRaises(AssertionError):value(f"SELECT public.correct_attendance('{s}','{u}','excused')",I)
 def test_late_enrollment_cannot_change_frozen_eligibility(self):
  c,l,u,s=setup_session(); late=student();run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{late}')")
  with self.assertRaises(AssertionError):checkin(s,late)
  with self.assertRaises(AssertionError):value(f"SELECT public.correct_attendance('{s}','{late}','present')",I)
  self.assertNotIn(late,value(f"SELECT * FROM public.attendance_session_roster_v2('{s}')",I))
 def test_expiry_closes_without_browser_or_scheduler_and_counts_absence(self):
  c,l,u,s=setup_session();run(f"UPDATE public.attendance_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{s}'")
  self.assertEqual(json.loads(value(f"SELECT public.get_attendance_session('{l}')",u))['state'],'closed')
  self.assertEqual(json.loads(value(f"SELECT public.attendance_report('{c}')",u))['stats']['absent'],1)
  with self.assertRaises(AssertionError):token(s)
  with self.assertRaises(AssertionError):value(f"SELECT public.extend_attendance('{s}',5)",I)
 def test_extension_and_early_close_are_audited_and_bounded(self):
  c,l,u,s=setup_session();old=value(f"SELECT expires_at FROM public.attendance_sessions WHERE id='{s}'")
  value(f"SELECT public.extend_attendance('{s}',5)",I)
  self.assertNotEqual(value(f"SELECT expires_at FROM public.attendance_sessions WHERE id='{s}'"),old)
  self.assertIn('expires_at',value(f"SELECT new_values FROM public.audit_events WHERE entity_id='{s}' ORDER BY occurred_at DESC LIMIT 1",A))
  for actor in [u,O]:
   with self.assertRaises(AssertionError):value(f"SELECT public.extend_attendance('{s}',5)",actor)
  with self.assertRaises(AssertionError):value(f"SELECT public.extend_attendance('{s}',120)",I)
  value(f"SELECT public.close_attendance('{s}')",I)
  with self.assertRaises(AssertionError):value(f"SELECT public.extend_attendance('{s}',5)",I)
 def test_cancel_attendance_preserves_lecture_history_and_excludes_stats(self):
  c,l,u,s=setup_session();value(f"SELECT public.cancel_attendance('{s}')",I)
  self.assertEqual(value(f"SELECT cancelled FROM public.academic_lectures WHERE id='{l}'"),'f')
  self.assertEqual(json.loads(value(f"SELECT public.attendance_report('{c}')",u))['stats']['eligible'],0)
  self.assertEqual(value(f"SELECT count(*) FROM public.attendance_records WHERE session_id='{s}'"),'1')
  with self.assertRaises(AssertionError):value(f"SELECT public.correct_attendance('{s}','{u}','present')",I)
  self.assertEqual(value(f"SELECT public.open_attendance('{l}')",I),s)
 def test_withdrawal_keeps_history_and_number_but_no_other_students(self):
  c,l,u,s=setup_session();run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}' AND student_id='{u}'")
  value(f"SELECT public.close_attendance('{s}')",I)
  report=json.loads(value(f"SELECT public.attendance_report('{c}')",u));self.assertEqual(report['stats']['eligible'],1)
  self.assertRegex(report['rows'][0]['user_number'],r'^\d{9}$')
  self.assertEqual(json.loads(value(f"SELECT public.attendance_report('{c}')",student()))['rows'],[])
  self.assertEqual(value(f"SELECT public.get_attendance_session('{l}')",O),'')
 def test_concurrent_close_and_extension_never_reopens(self):
  c,l,u,s=setup_session()
  with ThreadPoolExecutor(2) as pool:
   jobs=[pool.submit(run,f"SELECT public.{fn}('{s}'{args})",I,False) for fn,args in [('close_attendance',''),('extend_attendance',',5')]]
   results=[job.result() for job in jobs]
  self.assertEqual(results[0].returncode,0)
  self.assertEqual(json.loads(value(f"SELECT public.get_attendance_session('{l}')",I))['state'],'closed')
 def test_cancel_and_extend_fail_closed_when_audit_unavailable(self):
  c,l,u,s=setup_session()
  try:
   run("CREATE FUNCTION public.fail_session_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='attendance_sessions' THEN RAISE EXCEPTION 'audit unavailable'; END IF;RETURN NEW;END $$;CREATE TRIGGER fail_session_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_session_audit()")
   for fn,args in [('cancel_attendance',''),('extend_attendance',',5')]:
    with self.assertRaises(AssertionError):value(f"SELECT public.{fn}('{s}'{args})",I)
   self.assertEqual(value(f"SELECT state FROM public.attendance_sessions WHERE id='{s}'"),'open')
  finally:run('DROP TRIGGER fail_session_audit ON public.audit_events;DROP FUNCTION public.fail_session_audit()')

 def test_pre_start_withdrawal_is_excluded_and_no_student_notification(self):
  c,l=lecture();u=student();run(f"INSERT INTO public.course_enrollments(course_id,student_id,status) VALUES('{c}','{u}','dropped')")
  s=value(f"SELECT public.open_attendance('{l}')",I)
  self.assertEqual(value(f"SELECT count(*) FROM public.attendance_records WHERE session_id='{s}'"),'0')
  value(f"SELECT public.close_attendance('{s}')",I)
  self.assertEqual(json.loads(value(f"SELECT public.attendance_report('{c}')",I))['stats']['eligible'],0)
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_notifications n JOIN public.audit_events e ON e.id=n.event_id WHERE e.entity_id='{s}'"),'0')
 def test_same_correction_retry_does_not_duplicate_audit(self):
  c,l,u,s=setup_session();r=value(f"SELECT public.correct_attendance('{s}','{u}','present')",I)
  before=value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{r}'",S)
  self.assertEqual(value(f"SELECT public.correct_attendance('{s}','{u}','present')",I),r)
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{r}'",S),before)
