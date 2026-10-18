"""Destructive tests only in a disposable network-disabled local container."""
import os, subprocess, unittest, uuid, time
from concurrent.futures import ThreadPoolExecutor
C=os.environ['YHUB_COURSE_TEST_CONTAINER']; assert C.startswith('yhub-course-test-')
BASE=['docker','--host=unix:///var/run/docker.sock','exec','-i',C,'psql','-h','127.0.0.1','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
I,A,S,U,O=[f'00000000-0000-0000-0000-00000000000{n}' for n in [1,2,3,4,5]]
def run(sql,actor=None,check=True):
 prefix=f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{actor}';" if actor else ''
 p=subprocess.run(BASE,input='BEGIN;'+prefix+sql+';COMMIT;',capture_output=True,text=True,timeout=25)
 if check and p.returncode: raise AssertionError(p.stderr)
 return p
def course(owner=I):
 id=str(uuid.uuid4());run(f"INSERT INTO public.courses(id,instructor_id,title,is_published) VALUES('{id}','{owner}','Local deletion test',true)",owner);return id
def delete(id,actor=I,check=True):return run(f"SELECT public.delete_course_confirmed('{id}')",actor,check)
class CourseDeletion(unittest.TestCase):
 def test_zero_row_direct_delete_and_missing_vs_denied_rpc(self):
  id=course()
  self.assertEqual(run(f"DELETE FROM public.courses WHERE id='{id}' RETURNING id",O).stdout.strip(),'')
  self.assertIn('not permitted',delete(id,O,False).stderr)
  self.assertIn('not found',delete(str(uuid.uuid4()),I,False).stderr)
  self.assertEqual(delete(id).stdout.strip(),id)
  self.assertIn('not found',delete(id,I,False).stderr)
 def test_all_roles_match_existing_ownership_policy(self):
  for owner in [I,A,S]:
   id=course(owner)
   for other in [I,A,S,U,O]:
    if other!=owner:self.assertNotEqual(delete(id,other,False).returncode,0)
   self.assertEqual(delete(id,owner).stdout.strip(),id)
 def test_anonymous_and_no_session_denied(self):
  id=course()
  for sql in [f"SET LOCAL ROLE anon; SELECT public.delete_course_confirmed('{id}')",f"SET LOCAL ROLE authenticated; SELECT public.delete_course_confirmed('{id}')"]:
   self.assertNotEqual(run(sql,check=False).returncode,0)
 def test_future_restrictive_rls_still_applies_to_actual_delete(self):
  id=course()
  try:
   run('CREATE POLICY test_deny_delete ON public.courses AS RESTRICTIVE FOR DELETE TO authenticated USING(false)')
   self.assertIn('deletion rejected',delete(id,check=False).stderr)
   self.assertEqual(run(f"SELECT count(*) FROM public.courses WHERE id='{id}'").stdout.strip(),'1')
  finally:run('DROP POLICY test_deny_delete ON public.courses')
 def test_cascade_removes_existing_dependents_but_retains_audit_and_storage(self):
  id=course();m,e,q,unit,section,storage=[str(uuid.uuid4()) for _ in range(6)]
  run(f"""INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{m}','{id}','File','pdf','https://example.invalid/file.pdf');
  INSERT INTO public.exams(id,course_id,title) VALUES('{e}','{id}','Exam');
  INSERT INTO public.questions(id,course_id,exam_id,type,content,correct_answer) VALUES('{q}','{id}','{e}','tf','Question','true');
  INSERT INTO public.syllabus_units(id,course_id,title) VALUES('{unit}','{id}','Unit');
  INSERT INTO public.syllabus_sections(id,unit_id,title) VALUES('{section}','{unit}','Section')""",I)
  run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{id}','{U}'); INSERT INTO public.student_results(exam_id,student_id,score,total_score) VALUES('{e}','{U}',1,1); INSERT INTO storage.objects(id,name) VALUES('{storage}','local-file')")
  self.assertEqual(delete(id).stdout.strip(),id)
  for table,column,key in [('courses','id',id),('course_materials','id',m),('exams','id',e),('questions','id',q),('syllabus_units','id',unit),('syllabus_sections','id',section),('course_enrollments','course_id',id),('student_results','exam_id',e)]:
   self.assertEqual(run(f"SELECT count(*) FROM public.{table} WHERE {column}='{key}'").stdout.strip(),'0',table)
  self.assertEqual(run(f"SELECT count(*) FROM storage.objects WHERE id='{storage}'").stdout.strip(),'1')
  for actor in [A,S]:
   self.assertEqual(run(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{id}' AND operation='DELETE'",actor).stdout.strip(),'1')
  self.assertEqual(run(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{m}' AND operation='DELETE'",A).stdout.strip(),'1')
 def test_admin_event_is_reserved_for_super_admin(self):
  id=course(A);delete(id,A)
  self.assertEqual(run(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{id}'",A).stdout.strip(),'0')
  self.assertEqual(run(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{id}' AND operation='DELETE'",S).stdout.strip(),'1')
 def test_audit_failure_rolls_back_all_deletions_and_notifications(self):
  id=course();m=str(uuid.uuid4())
  run(f"INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{m}','{id}','Link','link','https://example.invalid')",I)
  notifications=run("SELECT count(*) FROM public.audit_notifications").stdout.strip()
  try:
   run("CREATE FUNCTION public.fail_course_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation='DELETE' AND NEW.entity_type='course_materials' THEN RAISE EXCEPTION 'required audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_course_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_course_audit()")
   self.assertIn('required audit failure',delete(id,check=False).stderr)
   for table,key in [('courses',id),('course_materials',m)]:
    self.assertEqual(run(f"SELECT count(*) FROM public.{table} WHERE id='{key}'").stdout.strip(),'1')
   self.assertEqual(run(f"SELECT count(*) FROM public.audit_events WHERE entity_id IN ('{id}','{m}') AND operation='DELETE'").stdout.strip(),'0')
   self.assertEqual(run("SELECT count(*) FROM public.audit_notifications").stdout.strip(),notifications)
  finally:run('DROP TRIGGER fail_course_audit ON public.audit_events; DROP FUNCTION public.fail_course_audit()')
  self.assertEqual(delete(id).stdout.strip(),id)
 def test_concurrent_deletes_return_exactly_one_confirmation(self):
  id=course()
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:delete(id,check=False),range(2)))
  self.assertEqual(sum(p.returncode==0 for p in results),1)
  self.assertEqual(run(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{id}' AND operation='DELETE'").stdout.strip(),'1')
 def test_committed_role_revocation_prevents_delete(self):
  id=course(O)
  try:
   with ThreadPoolExecutor(2) as pool:
    revoke=pool.submit(run,f"UPDATE public.users SET role='student' WHERE id='{O}'; SELECT pg_sleep(.8)")
    time.sleep(.25);deletion=pool.submit(delete,id,O,False)
    revoke.result();self.assertNotEqual(deletion.result().returncode,0)
   self.assertEqual(run(f"SELECT count(*) FROM public.courses WHERE id='{id}'").stdout.strip(),'1')
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{O}'")
