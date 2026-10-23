"""Local disposable PostgreSQL only. Auth stand-ins are not real JWT integration."""
import json, os, subprocess, unittest, uuid, time
from concurrent.futures import ThreadPoolExecutor
C=os.environ['YHUB_EXAM_TEST_CONTAINER']
assert C.startswith('yhub-exam-test-')
BASE=['docker','--host=unix:///var/run/docker.sock','exec','-i',C,'psql','-h','127.0.0.1','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
I,A,S,U,O=[f'00000000-0000-0000-0000-00000000000{n}' for n in [1,2,3,4,5]]
def run(sql,actor=None,check=True):
 prefix=f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{actor}';" if actor else ''
 p=subprocess.run(BASE,input='BEGIN;'+prefix+sql+';COMMIT;',capture_output=True,text=True,timeout=25)
 if check and p.returncode: raise AssertionError(p.stderr)
 return p
class Attempts(unittest.TestCase):
 def setUp(self):
  self.c,self.e,self.q=[str(uuid.uuid4()) for _ in range(3)]
  run(f"INSERT INTO public.courses(id,title,instructor_id,is_published) VALUES('{self.c}','Local exam','{I}',true)",I)
  run(f"INSERT INTO public.exams(id,course_id,title,time_limit_minutes,is_published) VALUES('{self.e}','{self.c}','Local',30,true); INSERT INTO public.questions(id,course_id,exam_id,type,content,correct_answer,points) VALUES('{self.q}','{self.c}','{self.e}','math','test','42',3)",I)
  run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{self.c}','{U}')")
 def rpc(self,name,extra='',actor=U,check=True):
  p=run(f"SELECT public.{name}('{self.e}'{extra})",actor,check)
  return json.loads(p.stdout) if check else p
 def start(self): return self.rpc('start_exam_attempt')
 def submit(self,check=True): return self.rpc('submit_exam',",'"+json.dumps({self.q:'42'})+"'",check=check)
 def expire(self): run(f"UPDATE public.exam_attempts SET started_at=clock_timestamp()-interval '2 minutes',deadline_at=clock_timestamp()-interval '1 minute' WHERE exam_id='{self.e}'")
 def test_start_refresh_and_two_devices_keep_identical_attempt(self):
  with ThreadPoolExecutor(2) as pool: states=list(pool.map(lambda _:self.start(),range(2)))
  self.assertEqual(states[0]['attempt_id'],states[1]['attempt_id'])
  self.assertEqual(states[0]['deadline_at'],self.start()['deadline_at'])
  self.assertEqual(self.rpc('get_exam_attempt')['deadline_at'],states[0]['deadline_at'])
 def test_server_grades_and_replay_returns_same_confirmed_result(self):
  self.start(); result=self.submit()
  self.assertEqual(result['result']['score'],3)
  self.assertEqual(result['result'],self.rpc('submit_exam',",'{}'")['result'])
 def test_concurrent_submissions_exactly_one_result(self):
  self.start()
  with ThreadPoolExecutor(2) as pool: results=list(pool.map(lambda _:self.submit(),range(2)))
  self.assertEqual(results[0]['result']['id'],results[1]['result']['id'])
  self.assertEqual(run(f"SELECT count(*) FROM public.student_results WHERE exam_id='{self.e}'").stdout.strip(),'1')
 def test_expired_attempt_has_no_invented_result_and_cannot_restart(self):
  state=self.start(); self.expire(); result=self.submit()
  self.assertEqual(result['status'],'expired'); self.assertIsNone(result['result'])
  self.assertEqual(self.start()['attempt_id'],state['attempt_id'])
  self.assertEqual(run(f"SELECT count(*) FROM public.student_results WHERE exam_id='{self.e}'").stdout.strip(),'0')
 def test_questions_cannot_be_read_before_start_or_after_expiry(self):
  self.assertNotEqual(self.rpc('get_exam_questions',check=False).returncode,0)
  self.start()
  p=run(f"SELECT row_to_json(q) FROM public.get_exam_questions('{self.e}') q",U)
  self.assertNotIn('correct_answer',p.stdout)
  self.expire(); self.assertNotEqual(self.rpc('get_exam_questions',check=False).returncode,0)
 def test_unenrolled_unpublished_and_dropped_denied(self):
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.c}'")
  self.assertNotEqual(self.rpc('start_exam_attempt',check=False).returncode,0)
  run(f"UPDATE public.course_enrollments SET status='active' WHERE course_id='{self.c}'; UPDATE public.exams SET is_published=false WHERE id='{self.e}'")
  self.assertNotEqual(self.rpc('start_exam_attempt',check=False).returncode,0)
 def test_access_revoked_during_attempt_rejects_submission(self):
  self.start(); run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.c}'")
  self.assertNotEqual(self.submit(check=False).returncode,0)
 def test_role_change_and_expired_session_deny(self):
  self.start()
  try:
   run(f"UPDATE public.users SET role='instructor' WHERE id='{U}'")
   self.assertNotEqual(self.submit(check=False).returncode,0)
   p=run(f"SET LOCAL ROLE authenticated; SELECT public.submit_exam('{self.e}','{{}}')",check=False)
   self.assertNotEqual(p.returncode,0)
  finally: run(f"UPDATE public.users SET role='student' WHERE id='{U}'")
 def test_historical_result_is_preserved_without_attempt(self):
  run(f"INSERT INTO public.student_results(exam_id,student_id,score,total_score,answers) VALUES('{self.e}','{U}',2,3,'{{}}')")
  state=self.start(); self.assertEqual(state['status'],'submitted'); self.assertIsNone(state['started_at'])
  self.assertEqual(state['result']['score'],2)
 def test_client_cannot_change_time_write_score_or_read_another_attempt(self):
  self.start()
  for sql in [f"UPDATE public.exam_attempts SET deadline_at=clock_timestamp()+interval '2 hours' WHERE exam_id='{self.e}'",f"DELETE FROM public.exam_attempts WHERE exam_id='{self.e}'",'INSERT INTO public.exam_attempts DEFAULT VALUES',f"INSERT INTO public.student_results(exam_id,student_id,score,total_score) VALUES('{self.e}','{U}',999,999)",f"SELECT yhub_exam_private.read_attempt('{self.e}',true)"]:
   self.assertNotEqual(run(sql,U,False).returncode,0)
  self.assertEqual(run(f"SELECT count(*) FROM public.exam_attempts WHERE exam_id='{self.e}'",O).stdout.strip(),'0')
 def test_submit_without_start_and_invalid_answers_rejected(self):
  self.assertNotEqual(self.submit(check=False).returncode,0)
  self.start(); self.assertNotEqual(self.rpc('submit_exam',",'[]'",check=False).returncode,0)
  self.assertNotEqual(self.rpc('submit_exam',",'{\"score\":999}'",check=False).returncode,0)
 def test_storage_failure_rolls_back_and_retry_works(self):
  self.start()
  try:
   run("CREATE FUNCTION public.fail_result_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'storage unavailable'; END $$; CREATE TRIGGER fail_result_test BEFORE INSERT ON public.student_results FOR EACH ROW EXECUTE FUNCTION public.fail_result_test()")
   self.assertNotEqual(self.submit(check=False).returncode,0)
   self.assertEqual(self.rpc('get_exam_attempt')['status'],'active')
  finally: run('DROP TRIGGER fail_result_test ON public.student_results; DROP FUNCTION public.fail_result_test()')
  self.assertEqual(self.submit()['status'],'submitted')
 def test_deadline_is_checked_after_lock_wait(self):
  self.start()
  run(f"UPDATE public.exam_attempts SET deadline_at=clock_timestamp()+interval '1 second' WHERE exam_id='{self.e}'")
  with ThreadPoolExecutor(2) as pool:
   blocker=pool.submit(run,f"SELECT id FROM public.exam_attempts WHERE exam_id='{self.e}' FOR UPDATE; SELECT pg_sleep(1.5)")
   time.sleep(.25)
   submitted=pool.submit(self.submit)
   blocker.result(); result=submitted.result()
  self.assertEqual(result['status'],'expired')
 def test_staff_read_access_and_no_staff_submission(self):
  for actor in [I,A,S]:
   self.assertEqual(self.rpc('get_exam_questions',actor=actor,check=False).returncode,0)
   self.assertNotEqual(self.rpc('start_exam_attempt',actor=actor,check=False).returncode,0)
  self.assertNotEqual(self.rpc('get_exam_questions',actor=O,check=False).returncode,0)
 def test_duration_edits_do_not_extend_existing_deadline(self):
  before=self.start()
  run(f"UPDATE public.exams SET time_limit_minutes=999 WHERE id='{self.e}'",I)
  self.assertEqual(before['deadline_at'],self.start()['deadline_at'])
 def test_concurrent_revocation_is_checked_after_lock_wait(self):
  self.start()
  with ThreadPoolExecutor(2) as pool:
   revoked=pool.submit(run,f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.c}'; SELECT pg_sleep(.8)")
   time.sleep(.25)
   submitted=pool.submit(self.submit,False)
   revoked.result(); result=submitted.result()
  self.assertNotEqual(result.returncode,0)
  self.assertIn('Active enrollment required',result.stderr)
 def test_attempt_question_version_survives_edits_and_deletion(self):
  self.start()
  run(f"UPDATE public.questions SET content='Changed',correct_answer='99',points=9 WHERE id='{self.q}'",I)
  visible=run(f"SELECT content FROM public.get_exam_questions('{self.e}')",U).stdout.strip()
  self.assertEqual(visible,'test')
  run(f"DELETE FROM public.questions WHERE id='{self.q}'",I)
  self.assertEqual(self.submit()['result']['score'],3)
 def test_later_attempt_gets_new_version_without_changing_first_attempt(self):
  self.start()
  run(f"UPDATE public.questions SET correct_answer='99',points=9 WHERE id='{self.q}'",I)
  self.assertEqual(self.submit()['result']['score'],3)
  other=str(uuid.uuid4())
  run(f"INSERT INTO auth.users(id,email) VALUES('{other}','local@example.invalid'); INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{self.c}','{other}')")
  self.rpc('start_exam_attempt',actor=other)
  result=self.rpc('submit_exam',",'"+json.dumps({self.q:'99'})+"'",actor=other)
  self.assertEqual(result['result']['score'],9)
 def test_snapshot_is_private(self):
  self.start()
  self.assertNotEqual(run('SELECT * FROM yhub_exam_private.attempt_questions',U,False).returncode,0)
 def test_failed_snapshot_rolls_back_attempt_creation(self):
  try:
   run("CREATE FUNCTION yhub_exam_private.test_fail_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'snapshot unavailable'; END $$; CREATE TRIGGER test_fail_snapshot BEFORE INSERT ON yhub_exam_private.attempt_questions FOR EACH ROW EXECUTE FUNCTION yhub_exam_private.test_fail_snapshot()")
   self.assertIn('snapshot unavailable',self.rpc('start_exam_attempt',check=False).stderr)
   self.assertEqual(run(f"SELECT count(*) FROM public.exam_attempts WHERE exam_id='{self.e}'").stdout.strip(),'0')
  finally:run('DROP TRIGGER test_fail_snapshot ON yhub_exam_private.attempt_questions; DROP FUNCTION yhub_exam_private.test_fail_snapshot()')
  self.assertEqual(self.start()['status'],'active')
