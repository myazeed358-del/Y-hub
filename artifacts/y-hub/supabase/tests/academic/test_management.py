import json,unittest,uuid,time
from concurrent.futures import ThreadPoolExecutor
from support import run,value,definition,course,I,A,S,U,O

def create(d,owner=I,actor=A,id=None):
 id=id or str(uuid.uuid4())
 return id,run(f"SELECT public.create_academic_section('{id}','{d}','{owner}','01','2026-Fall')",actor,False)
class AcademicManagement(unittest.TestCase):
 def test_admin_catalog_create_is_idempotent_and_instructor_denied(self):
  id=str(uuid.uuid4());sql=f"SELECT public.create_course_definition('{id}','Calculus','M101','Description','Science','mathematics')"
  for actor in [I,U]:self.assertNotEqual(run(sql,actor,False).returncode,0)
  self.assertEqual(value(sql,A),id);self.assertEqual(value(sql,S),id)
  self.assertNotEqual(run(sql.replace('Calculus','Different'),A,False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{id}' AND operation='INSERT'",S),'1')
 def test_section_creation_uses_catalog_and_keeps_distinct_identities(self):
  d=definition();a,p=create(d);self.assertEqual(p.returncode,0,p.stderr)
  b,p=create(d,O);self.assertEqual(p.returncode,0,p.stderr);self.assertNotEqual(a,b)
  self.assertEqual(value(f"SELECT course_definition_id FROM public.courses WHERE id='{a}'",I),d)
  self.assertEqual(value(f"SELECT section_label||'/'||academic_term FROM public.course_sections WHERE id='{a}'",I),'01/2026-Fall')
  self.assertEqual(value(f"SELECT is_published OR enrollment_open FROM public.courses WHERE id='{a}'",I),'f')
  self.assertEqual(value(f"SELECT count(*) FROM public.courses WHERE id='{b}'",I),'0')
 def test_create_permissions_and_actual_instructor_role(self):
  d=definition()
  for owner,actor in [(I,U),(O,I),(U,A),(A,A)]:self.assertNotEqual(create(d,owner,actor)[1].returncode,0)
  self.assertEqual(create(d,I,I)[1].returncode,0)
  self.assertEqual(create(d,O,S)[1].returncode,0)
 def test_retry_and_concurrent_creation_do_not_duplicate_sections_or_audit(self):
  d=definition();id=str(uuid.uuid4())
  with ThreadPoolExecutor(2) as pool: results=list(pool.map(lambda _:create(d,id=id)[1],range(2)))
  self.assertTrue(all(r.returncode==0 for r in results))
  self.assertEqual(value(f"SELECT count(*) FROM public.courses WHERE id='{id}'"),'1')
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{id}'",S),'1')
  self.assertNotEqual(create(d,O,id=id)[1].returncode,0)
 def test_assignment_cas_preserves_children_and_revokes_old_owner(self):
  c=course();unit=str(uuid.uuid4());run(f"INSERT INTO public.syllabus_units(id,course_id,title) VALUES('{unit}','{c}','History')",I)
  sql=f"SELECT public.assign_academic_section('{c}','{I}','{O}')"
  for actor in [I,U]:self.assertNotEqual(run(sql,actor,False).returncode,0)
  self.assertEqual(value(sql,A),c)
  run(f"DO $$ BEGIN PERFORM public.assign_academic_section('{c}','{I}','{O}'); RAISE EXCEPTION 'stale assignment accepted'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END $$",S)
  self.assertEqual(value(f"SELECT count(*) FROM public.syllabus_units WHERE id='{unit}'",I),'0')
  self.assertEqual(value(f"SELECT course_id FROM public.syllabus_units WHERE id='{unit}'",O),c)
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{c}' AND actor_id='{A}' AND operation='UPDATE'",S),'1')
 def test_directory_is_scoped_and_bounded(self):
  for actor in [I,O]:self.assertEqual(value("SELECT count(*) FROM public.list_assignable_instructors()",actor),'1')
  for actor in [A,S]:self.assertGreaterEqual(int(value("SELECT count(*) FROM public.list_assignable_instructors()",actor)),2)
  self.assertNotEqual(run('SELECT * FROM public.list_assignable_instructors()',U,False).returncode,0)
  self.assertNotEqual(run("SELECT * FROM public.list_assignable_instructors('',-1)",A,False).returncode,0)
 def test_role_revocation_wait_is_checked_and_audit_failure_rolls_back(self):
  d=definition()
  try:
   with ThreadPoolExecutor(2) as pool:
    revoke=pool.submit(run,f"UPDATE public.users SET role='student' WHERE id='{O}'; SELECT pg_sleep(.5)")
    time.sleep(.15);pending=pool.submit(create,d,O,O)
    revoke.result();self.assertNotEqual(pending.result()[1].returncode,0)
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{O}'")
  try:
   run("CREATE FUNCTION public.test_reject_section_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='courses' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_reject_section_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.test_reject_section_audit()")
   id,p=create(d);self.assertIn('audit unavailable',p.stderr)
   self.assertEqual(value(f"SELECT count(*) FROM public.courses WHERE id='{id}'"),'0')
  finally:run('DROP TRIGGER test_reject_section_audit ON public.audit_events; DROP FUNCTION public.test_reject_section_audit()')
 def test_roster_scope_tracks_assignment_and_current_role(self):
  c=course();run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{U}')",U)
  for actor in [I,A,S]:self.assertEqual(value(f"SELECT count(*) FROM public.get_managed_course_enrollment_roster_v2('{c}')",actor),'1')
  for actor in [O,U]:self.assertNotEqual(run(f"SELECT * FROM public.get_managed_course_enrollment_roster_v2('{c}')",actor,False).returncode,0)
  value(f"SELECT public.assign_academic_section('{c}','{I}','{O}')",A)
  self.assertNotEqual(run(f"SELECT * FROM public.get_managed_course_enrollment_roster_v2('{c}')",I,False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.get_managed_course_enrollment_roster_v2('{c}')",O),'1')
