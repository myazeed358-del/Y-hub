import unittest,json,time
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
from support import run,value,I,A,S,U,O,course
from test_engine_grants import student

def lecture(c=None):
 c=c or course();l=value(f"SELECT public.schedule_academic_lecture('{c}','Lecture',clock_timestamp(),clock_timestamp()+interval '1 hour')",I);return c,l
def setup_session():
 c,l=lecture();u=student();run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{u}')");s=value(f"SELECT public.open_attendance('{l}')",I);return c,l,u,s
def token(s):
 qr=json.loads(value(f"SELECT public.attendance_qr('{s}')",I))
 remaining=(datetime.fromisoformat(qr['expiresAt'])-datetime.now(timezone.utc)).total_seconds()
 if remaining<1.5:
  time.sleep(max(0,remaining)+.05);qr=json.loads(value(f"SELECT public.attendance_qr('{s}')",I))
 return qr['token']
def checkin(s,u):return value(f"SELECT public.check_in_attendance('{token(s)}')",u)
class Attendance(unittest.TestCase):
 def test_lifecycle_roster_checkin_idempotency_and_stats(self):
  c,l,u,s=setup_session();r=checkin(s,u);self.assertEqual(checkin(s,u),r)
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{r}'",S),'2')
  value(f"SELECT public.close_attendance('{s}')",I)
  report=json.loads(value(f"SELECT public.attendance_report('{c}')",u));self.assertEqual(report['stats']['present'],1)
  self.assertEqual(report['rows'][0]['student_id'],u)
  with self.assertRaises(AssertionError):checkin(s,u)
 def test_forged_expired_and_unknown_tokens_rejected(self):
  c,l,u,s=setup_session();t=token(s)
  for bad in ['nope',t[:-1]+('a' if t[-1]!='a' else 'b')]:
   with self.assertRaises(AssertionError):value(f"SELECT public.check_in_attendance('{bad}')",u)
  expired=value(f"SELECT '{s}.'||(floor(extract(epoch FROM clock_timestamp())/10)::bigint-2)::text||'.'||yhub_attendance_private.signature('{s}',floor(extract(epoch FROM clock_timestamp())/10)::bigint-2)")
  with self.assertRaises(AssertionError):value(f"SELECT public.check_in_attendance('{expired}')",u)
 def test_roles_foreign_sections_and_non_enrolled_students(self):
  c,l,u,s=setup_session()
  for actor in [O,u,student()]:
   with self.assertRaises(AssertionError):value(f"SELECT public.attendance_qr('{s}')",actor)
   with self.assertRaises(AssertionError):value(f"SELECT public.close_attendance('{s}')",actor)
  for actor in [I,A,S,student()]:
   with self.assertRaises(AssertionError):checkin(s,actor)
  self.assertEqual(value(f"SELECT count(*) FROM public.attendance_records WHERE session_id='{s}'",O),'0')
  for actor in [u,I,A,S]:
   self.assertNotEqual(run(f"UPDATE public.attendance_records SET status='present' WHERE session_id='{s}'",actor,False).returncode,0)
   self.assertNotEqual(run('SELECT * FROM yhub_attendance_private.secrets',actor,False).returncode,0)
 def test_withdrawal_and_demotion_take_effect(self):
  c,l,u,s=setup_session();run(f"UPDATE public.course_enrollments SET status='dropped' WHERE student_id='{u}' AND course_id='{c}'")
  with self.assertRaises(AssertionError):checkin(s,u)
  try:
   run(f"UPDATE public.users SET role='student' WHERE id='{I}'")
   with self.assertRaises(AssertionError):token(s)
   self.assertEqual(value(f"SELECT count(*) FROM public.attendance_records WHERE session_id='{s}'",I),'0')
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{I}'")
 def test_manual_corrections_are_scoped_audited_and_redacted(self):
  c,l,u,s=setup_session()
  r=value(f"SELECT public.correct_attendance('{s}','{u}','excused','private medical note')",I)
  event=json.loads(value(f"SELECT new_values FROM public.audit_events WHERE entity_id='{r}' ORDER BY occurred_at DESC LIMIT 1",A))
  self.assertEqual(event['reason'],'[REDACTED]');self.assertEqual(event['status'],'excused')
  checkin(s,u);self.assertEqual(value(f"SELECT status FROM public.attendance_records WHERE id='{r}'",u),'excused')
  with self.assertRaises(AssertionError):value(f"SELECT public.correct_attendance('{s}','{student()}','present','not enrolled')",I)
  run(f"UPDATE public.attendance_sessions SET opened_at=clock_timestamp()-interval '9 days' WHERE id='{s}'")
  with self.assertRaises(AssertionError):value(f"SELECT public.correct_attendance('{s}','{u}','present','late correction')",I)
  value(f"SELECT public.correct_attendance('{s}','{u}','present','admin correction')",A)
 def test_two_devices_create_one_record_and_one_checkin_event(self):
  c,l,u,s=setup_session();t=token(s)
  with ThreadPoolExecutor(2) as pool:ids=list(pool.map(lambda _:value(f"SELECT public.check_in_attendance('{t}')",u),range(2)))
  self.assertEqual(ids[0],ids[1]);self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{ids[0]}'",S),'2')
 def test_required_audit_failure_rolls_back_checkin(self):
  c,l,u,s=setup_session()
  try:
   run("CREATE FUNCTION public.fail_attendance_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='attendance_records' THEN RAISE EXCEPTION 'audit unavailable'; END IF;RETURN NEW;END $$;CREATE TRIGGER fail_attendance_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_attendance_audit()")
   with self.assertRaises(AssertionError):checkin(s,u)
   self.assertEqual(value(f"SELECT status FROM public.attendance_records WHERE session_id='{s}'",u),'absent')
  finally:run('DROP TRIGGER fail_attendance_audit ON public.audit_events; DROP FUNCTION public.fail_attendance_audit()')
 def test_pagination_other_student_isolation_and_cancel(self):
  c,l,u,s=setup_session();v=student()
  self.assertEqual(json.loads(value(f"SELECT public.attendance_report('{c}')",v))['total'],0)
  self.assertEqual(json.loads(value(f"SELECT public.attendance_report('{c}',1,1)",I))['rows'],[])
  value(f"SELECT public.cancel_academic_lecture('{l}')",I)
  with self.assertRaises(AssertionError):checkin(s,u)
  self.assertEqual(json.loads(value(f"SELECT public.attendance_report('{c}')",u))['stats']['eligible'],0)
 def test_withdrawn_students_keep_own_history_and_manager_can_correct_roster(self):
  c,l,u,s=setup_session();run(f"UPDATE public.course_enrollments SET status='dropped' WHERE student_id='{u}' AND course_id='{c}'")
  self.assertIn(c,value('SELECT id FROM public.my_attendance_sections()',u))
  self.assertIn(u,value(f"SELECT student_id FROM public.attendance_session_roster('{s}')",I))
  for actor in [u,O]:
   with self.assertRaises(AssertionError):value(f"SELECT * FROM public.attendance_session_roster('{s}')",actor)
