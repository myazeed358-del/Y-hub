import unittest,uuid,time
from concurrent.futures import ThreadPoolExecutor
from support import run,value,course,I,A,S,U,O
ENGINE='linear-algebra'
def student():
 id=str(uuid.uuid4());run(f"INSERT INTO auth.users(id,raw_user_meta_data) VALUES('{id}','{{\"full_name_ar\":\"مستخدم تجريبي\",\"full_name_en\":\"Local Test\"}}'); UPDATE public.users SET major='medicine' WHERE id='{id}'");return id
def setup():
 c=course();u=student();run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{u}')");return c,u
def grant(c,u,actor=I,engine=ENGINE):return value(f"SELECT public.grant_engine_access('{c}','{u}','{engine}',clock_timestamp()+interval '1 day')",actor)
def allowed(u):return value(f"SELECT public.can_use_module('{ENGINE}')",u)
class EngineGrants(unittest.TestCase):
 def test_grant_and_revoke_change_actual_database_access_and_audit(self):
  c,u=setup();self.assertEqual(allowed(u),'f');g=grant(c,u);self.assertEqual(allowed(u),'t')
  self.assertEqual(value(f"SELECT actor_role FROM public.audit_events WHERE entity_id='{g}'",A),'instructor')
  value(f"SELECT public.revoke_engine_access('{g}')",I);self.assertEqual(allowed(u),'f')
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{g}'",A),'2')
 def test_foreign_section_and_non_enrollment_are_denied(self):
  c,u=setup()
  for actor in [O,U,A,S]:
   with self.assertRaises(AssertionError):grant(c,u,actor)
  with self.assertRaises(AssertionError):grant(c,student())
 def test_current_instructor_major_and_module_kind_limit_delegation(self):
  c,u=setup()
  for engine in ['y-sheets','unknown','audit-log']:
   with self.assertRaises(AssertionError):grant(c,u,engine=engine)
  try:
   run(f"UPDATE public.users SET major='medicine' WHERE id='{I}'")
   with self.assertRaises(AssertionError):grant(c,u)
  finally:run(f"UPDATE public.users SET major='mathematics' WHERE id='{I}'")
 def test_withdrawal_and_reenrollment_never_resurrect_grant(self):
  c,u=setup();g=grant(c,u)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}' AND student_id='{u}'")
  self.assertEqual(allowed(u),'f')
  run(f"UPDATE public.course_enrollments SET status='active' WHERE course_id='{c}' AND student_id='{u}'")
  self.assertEqual(allowed(u),'f');self.assertNotEqual(grant(c,u),g)
 def test_assignment_and_role_changes_revoke_permanently(self):
  c,u=setup();grant(c,u)
  run(f"UPDATE public.courses SET instructor_id='{O}' WHERE id='{c}'")
  self.assertEqual(allowed(u),'f')
  run(f"UPDATE public.courses SET instructor_id='{I}' WHERE id='{c}'");grant(c,u)
  try:
   run(f"UPDATE public.users SET role='student' WHERE id='{I}'");self.assertEqual(allowed(u),'f')
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{I}'")
  self.assertEqual(allowed(u),'f')
 def test_expiry_and_deletion_are_effective_without_scheduler(self):
  c,u=setup();grant(c,u)
  run(f"UPDATE public.engine_grants SET created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' WHERE course_id='{c}'")
  self.assertEqual(allowed(u),'f');grant(c,u)
  run(f"DELETE FROM public.course_enrollments WHERE course_id='{c}' AND student_id='{u}'")
  self.assertEqual(allowed(u),'f')
 def test_client_cannot_forge_grants_catalog_or_actor(self):
  c,u=setup();g=grant(c,u)
  for actor in [u,I,A,S]:
   for sql in [f"UPDATE public.engine_grants SET expires_at=clock_timestamp()+interval '1 year' WHERE id='{g}'",f"DELETE FROM public.engine_grants WHERE id='{g}'","INSERT INTO public.engine_grants DEFAULT VALUES","UPDATE public.module_policies SET enabled=true","SELECT yhub_access_private.allowed(auth.uid(),'linear-algebra')"]:
    self.assertNotEqual(run(sql,actor,False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.engine_grants WHERE id='{g}'",O),'0')
  self.assertNotEqual(run(f"SET LOCAL ROLE anon; SELECT public.can_use_module('{ENGINE}')",check=False).returncode,0)
 def test_concurrent_grants_are_idempotent(self):
  c,u=setup()
  with ThreadPoolExecutor(2) as p:ids=list(p.map(lambda _:grant(c,u),range(2)))
  self.assertEqual(ids[0],ids[1]);self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{ids[0]}'",A),'1')
 def test_required_audit_failure_rolls_back_grant(self):
  c,u=setup()
  try:
   run("CREATE FUNCTION public.fail_grant_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='engine_grants' THEN RAISE EXCEPTION 'audit failed'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_grant_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_grant_audit()")
   with self.assertRaises(AssertionError):grant(c,u)
   self.assertEqual(allowed(u),'f')
  finally:run('DROP TRIGGER fail_grant_audit ON public.audit_events; DROP FUNCTION public.fail_grant_audit()')

 def test_backend_operation_authorization_rechecks_role_scope_and_revocation(self):
  c,u=setup()
  check=lambda scope:value(f"SELECT public.authorize_engine_compute('phase','{scope}')",u)
  self.assertEqual(check('10'),'f');g=grant(c,u);self.assertEqual(check('10'),'t');self.assertEqual(check('fuzzy'),'f')
  self.assertEqual(value("SELECT public.authorize_engine_compute('unknown','10')",u),'f')
  value(f"SELECT public.revoke_engine_access('{g}')",I);self.assertEqual(check('10'),'f')
 def test_demotion_while_grant_waits_prevents_authorization(self):
  c,u=setup()
  try:
   with ThreadPoolExecutor(2) as pool:
    revoke=pool.submit(run,f"UPDATE public.users SET role='student' WHERE id='{I}'; SELECT pg_sleep(.5)")
    time.sleep(.15);pending=pool.submit(grant,c,u)
    revoke.result()
    with self.assertRaises(AssertionError):pending.result()
   self.assertEqual(allowed(u),'f')
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{I}'")
