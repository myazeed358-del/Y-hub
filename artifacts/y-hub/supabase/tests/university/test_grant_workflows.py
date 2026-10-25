import json,unittest
from concurrent.futures import ThreadPoolExecutor
from support import run,value,I,A,S,O
from test_engine_grants import setup,student,ENGINE,allowed

def batch(c,u,engines="ARRAY['linear-algebra','ode']",actor=I,expires='NULL'):
 return json.loads(value(f"SELECT to_json(public.grant_engine_access_batch('{c}','{u}',{engines},{expires}))",actor))
def history(c,u,active=True,actor=I):
 return json.loads(value(f"SELECT public.engine_grant_history(p_course=>'{c}',p_student=>'{u}',p_active=>{str(active).lower()})",actor))
class GrantWorkflows(unittest.TestCase):
 def test_atomic_multi_engine_and_membership_lifetime(self):
  c,u=setup();ids=batch(c,u);self.assertEqual(len(ids),2);self.assertEqual(batch(c,u),ids)
  self.assertEqual(allowed(u),'t');self.assertEqual(value("SELECT public.authorize_engine_compute('phase','10')",u),'t');self.assertEqual(value(f"SELECT count(*) FROM public.engine_grants WHERE student_id='{u}' AND expires_at IS NULL"),'2')
  self.assertEqual(history(c,u)['total'],2)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}' AND student_id='{u}'")
  self.assertEqual(allowed(u),'f');rows=history(c,u,False)['rows'];self.assertEqual({r['state'] for r in rows},{'withdrawal'})
  run(f"UPDATE public.course_enrollments SET status='active' WHERE course_id='{c}' AND student_id='{u}'")
  self.assertEqual(allowed(u),'f')
 def test_invalid_engine_rolls_back_entire_batch_and_required_audit(self):
  c,u=setup()
  for engines in ["ARRAY['linear-algebra','y-sheets']","ARRAY['ode','ode']","ARRAY[]::text[]"]:
   with self.assertRaises(AssertionError):batch(c,u,engines)
   self.assertEqual(value(f"SELECT count(*) FROM public.engine_grants WHERE student_id='{u}'"),'0')
  try:
   run("CREATE FUNCTION public.block_batch_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='engine_grants' AND NEW.new_values->>'engine_id'='ode' THEN RAISE EXCEPTION 'audit offline'; END IF; RETURN NEW; END $$; CREATE TRIGGER block_batch_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.block_batch_audit()")
   with self.assertRaises(AssertionError):batch(c,u)
   self.assertEqual(value(f"SELECT count(*) FROM public.engine_grants WHERE student_id='{u}'"),'0')
  finally:run('DROP TRIGGER block_batch_audit ON public.audit_events; DROP FUNCTION public.block_batch_audit()')
 def test_search_is_scoped_and_includes_immutable_number_and_section(self):
  c,u=setup();number=value(f"SELECT user_number FROM public.users WHERE id='{u}'")
  result=json.loads(value(f"SELECT public.search_engine_students(p_search=>'{number}')",I))
  self.assertEqual(result['total'],1);self.assertEqual(result['rows'][0]['course_id'],c);self.assertEqual(result['rows'][0]['user_number'],number)
  run(f"UPDATE public.users SET full_name='طالب اختبار' WHERE id='{u}'")
  self.assertEqual(json.loads(value(f"SELECT public.search_engine_students(p_course=>'{c}',p_search=>'طالب')",I))['rows'][0]['student_id'],u)
  self.assertEqual(json.loads(value(f"SELECT public.search_engine_students(p_search=>'{number}')",O))['total'],0)
  for actor in [A,S]:self.assertEqual(json.loads(value(f"SELECT public.search_engine_students(p_search=>'{number}')",actor))['total'],1)
  self.assertNotEqual(run('SELECT public.search_engine_students()',u,False).returncode,0)
 def test_concurrent_batches_and_manual_revoke_preserve_base_access(self):
  c,u=setup()
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:batch(c,u),range(2)))
  self.assertEqual(results[0],results[1]);self.assertEqual(history(c,u)['total'],2)
  value(f"SELECT public.revoke_engine_access('{results[0][0]}')",I)
  self.assertEqual(history(c,u,False)['rows'][0]['state'],'manual')
  self.assertEqual(value("SELECT public.can_use_module('ode')",u),'t')
  run(f"UPDATE public.users SET major='mathematics' WHERE id='{u}'")
  self.assertEqual(allowed(u),'t')
 def test_foreign_or_inactive_students_and_untrusted_roles_cannot_receive_grants(self):
  c,u=setup()
  for actor in [O,u,A,S]:
   with self.assertRaises(AssertionError):batch(c,u,actor=actor)
  with self.assertRaises(AssertionError):batch(c,student())
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}' AND student_id='{u}'")
  with self.assertRaises(AssertionError):batch(c,u)
 def test_expiry_history_and_assignment_reasons_are_server_derived(self):
  c,u=setup();ids=batch(c,u,expires="clock_timestamp()+interval '1 day'")
  run(f"UPDATE public.engine_grants SET created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' WHERE id='{ids[0]}'")
  self.assertIn('expired',[r['state'] for r in history(c,u,False)['rows']])
  value(f"SELECT public.assign_academic_section('{c}','{I}','{O}')",A)
  self.assertNotEqual(run(f"SELECT public.engine_grant_history(p_course=>'{c}')",I,False).returncode,0)
  self.assertEqual(history(c,u,False,O)['total'],2)
  self.assertEqual({r['revocation_reason'] for r in history(c,u,False,O)['rows']},{'assignment'})
 def test_revoke_and_assignment_lock_parent_before_grant(self):
  import time
  c,u=setup();ids=batch(c,u)
  with ThreadPoolExecutor(2) as pool:
   assignment=pool.submit(run,f"SELECT id FROM public.courses WHERE id='{c}' FOR UPDATE; SELECT pg_sleep(.4); UPDATE public.courses SET instructor_id='{O}' WHERE id='{c}'")
   time.sleep(.15)
   revoke=pool.submit(run,f"SELECT public.revoke_engine_access('{ids[0]}')",I,False)
   self.assertEqual(assignment.result().returncode,0)
   result=revoke.result();self.assertNotEqual(result.returncode,0);self.assertNotIn('deadlock detected',result.stderr)
  self.assertEqual(history(c,u,False,O)['total'],2)
