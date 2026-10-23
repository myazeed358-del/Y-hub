import json,unittest
from support import run,value,I,A,S,O
from test_attendance import setup_session as attendance_session
from support import course
from test_engine_grants import student

def setup_session():
 c=course();u=student();run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{u}')")
 l=value(f"SELECT public.schedule_online_lecture('{c}','Online lecture',clock_timestamp(),clock_timestamp()+interval '1 hour')",I)
 return c,l,u,None

def permission(l,u):return json.loads(value(f"SELECT public.lecture_join_permission('{l}')",u))
class Lectures(unittest.TestCase):
 def test_current_roles_and_enrollment_authorize_only_exact_room(self):
  c,l,u,s=setup_session()
  self.assertIn(c,value('SELECT id FROM public.my_online_lecture_sections()',u))
  self.assertNotIn(c,value('SELECT id FROM public.my_online_lecture_sections()',O))
  for actor,moderator in [(u,False),(I,True),(A,True),(S,True)]:
   receipt=permission(l,actor);self.assertEqual(receipt['identity'],actor);self.assertEqual(receipt['moderator'],moderator);self.assertEqual(receipt['room'],'yhub-lecture-'+l)
  for actor in [student(),O]:
   with self.assertRaises(AssertionError):permission(l,actor)
 def test_block_is_durable_audited_and_prevents_new_admission(self):
  c,l,u,s=setup_session();permission(l,u)
  block=value(f"SELECT public.block_lecture_participant('{l}','{u}','inappropriate behavior')",I)
  with self.assertRaises(AssertionError):permission(l,u)
  self.assertEqual(value(f"SELECT new_values->>'reason' FROM public.audit_events WHERE entity_id='{block}'",A),'[REDACTED]')
  for actor in [u,O]:
   with self.assertRaises(AssertionError):value(f"SELECT public.block_lecture_participant('{l}','{u}','not allowed')",actor)
  with self.assertRaises(AssertionError):value(f"SELECT public.block_lecture_participant('{l}','{A}','cannot remove admin')",I)
 def test_withdrawal_cancellation_and_time_window_revoke_admission(self):
  c,l,u,s=setup_session();run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}' AND student_id='{u}'")
  with self.assertRaises(AssertionError):permission(l,u)
  run(f"UPDATE public.course_enrollments SET status='active' WHERE course_id='{c}' AND student_id='{u}'");permission(l,u)
  value(f"SELECT public.cancel_academic_lecture('{l}')",I)
  with self.assertRaises(AssertionError):permission(l,u)
  c,l,u,s=setup_session();run(f"UPDATE public.academic_lectures SET starts_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 hour' WHERE id='{l}'")
  with self.assertRaises(AssertionError):permission(l,I)
 def test_demotion_and_section_reassignment_take_effect(self):
  c,l,u,s=setup_session()
  try:
   run(f"UPDATE public.users SET role='student' WHERE id='{I}'")
   with self.assertRaises(AssertionError):permission(l,I)
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{I}'")
  run(f"UPDATE public.courses SET instructor_id='{O}' WHERE id='{c}'")
  with self.assertRaises(AssertionError):permission(l,I)
  self.assertTrue(permission(l,O)['moderator'])
 def test_browser_cannot_forge_blocks_or_call_service_reconciliation(self):
  c,l,u,s=setup_session()
  for actor in [u,I,A,S]:
   for sql in ["INSERT INTO public.lecture_access_blocks DEFAULT VALUES",'DELETE FROM public.lecture_access_blocks',f"SELECT public.lecture_participant_allowed('{l}','{u}')",f"SELECT yhub_live_private.allowed('{l}','{u}')"]:
    self.assertNotEqual(run(sql,actor,False).returncode,0)
  self.assertEqual(value(f"SET LOCAL ROLE service_role; SELECT public.lecture_participant_allowed('{l}','{u}')"),'t')
  value(f"SELECT public.block_lecture_participant('{l}','{u}','blocked student')",I)
  self.assertEqual(value(f"SET LOCAL ROLE service_role; SELECT public.lecture_participant_allowed('{l}','{u}')"),'f')
 def test_audit_failure_rolls_back_block(self):
  c,l,u,s=setup_session()
  try:
   run("CREATE FUNCTION public.fail_live_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='lecture_access_blocks' THEN RAISE EXCEPTION 'failed'; END IF;RETURN NEW;END $$;CREATE TRIGGER fail_live_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_live_audit()")
   with self.assertRaises(AssertionError):value(f"SELECT public.block_lecture_participant('{l}','{u}','required audit')",I)
   permission(l,u)
  finally:run('DROP TRIGGER fail_live_audit ON public.audit_events; DROP FUNCTION public.fail_live_audit()')

 def test_in_person_lectures_never_create_online_rooms_and_scheduling_is_guarded(self):
  c,l,u,s=attendance_session()
  with self.assertRaises(AssertionError):permission(l,u)
  for actor in [u,O]:
   with self.assertRaises(AssertionError):value(f"SELECT public.schedule_online_lecture('{c}','Denied',clock_timestamp(),clock_timestamp()+interval '1 hour')",actor)
 def test_concurrent_promotion_prevents_removing_a_new_administrator(self):
  import time
  from concurrent.futures import ThreadPoolExecutor
  c,l,u,s=setup_session()
  with ThreadPoolExecutor(2) as pool:
   promotion=pool.submit(run,f"UPDATE public.users SET role='admin' WHERE id='{u}'; SELECT pg_sleep(.6)")
   time.sleep(.15)
   pending=pool.submit(value,f"SELECT public.block_lecture_participant('{l}','{u}','concurrent removal')",I)
   promotion.result()
   with self.assertRaises(AssertionError):pending.result()
