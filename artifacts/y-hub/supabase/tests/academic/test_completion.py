import json,unittest,uuid
from concurrent.futures import ThreadPoolExecutor
from support import run,value,course,I,A,S,U,O
from test_syllabus import unit,save

def setup():
 c=course();u=unit();save(c,0,[u]);t=u['sections'][0]['id']
 run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{U}')",U)
 return c,t

def read(c,actor=U):return json.loads(value(f"SELECT public.read_lesson_progress('{c}')",actor))
def mark(t,rev,state,actor=U,check=True):return run(f"SELECT public.set_lesson_completion('{t}',{rev},'{state}')",actor,check)
def rule(t,rev,mode,exams=(),actor=I,check=True):
 ids=','.join("'"+e+"'::uuid" for e in exams)
 return run(f"SELECT public.set_lesson_completion_rule('{t}',{rev},'{mode}',ARRAY[{ids}]::uuid[])",actor,check)
def exam(c):
 e,q=str(uuid.uuid4()),str(uuid.uuid4())
 run(f"INSERT INTO public.exams(id,course_id,title,is_published) VALUES('{e}','{c}','Verified activity',true);INSERT INTO public.questions(id,exam_id,course_id,type,content,correct_answer,points) VALUES('{q}','{e}','{c}','math','Local','42',1)",I)
 return e,q

def submit(e,q):
 run(f"SELECT public.start_exam_attempt('{e}');SELECT public.submit_exam('{e}','{{\"{q}\":\"42\"}}')",U)

class LessonCompletion(unittest.TestCase):
 def test_manual_completion_undo_and_no_view_side_effect(self):
  c,t=setup();self.assertFalse(read(c)['topics'][0]['completed']);self.assertEqual(value(f"SELECT count(*) FROM public.lesson_completion_overrides WHERE topic_id='{t}'"),'0')
  self.assertEqual(int(mark(t,0,'completed').stdout),1);self.assertTrue(read(c)['topics'][0]['completed'])
  self.assertEqual(int(mark(t,1,'incomplete').stdout),2);self.assertFalse(read(c)['topics'][0]['completed'])
 def test_retry_after_lost_ack_is_idempotent_and_audited_once(self):
  c,t=setup();mark(t,0,'completed');self.assertEqual(int(mark(t,0,'completed').stdout),1)
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_type='lesson_completion_overrides' AND context->>'course_id'='{c}'"),'1')
 def test_two_devices_do_not_overwrite_conflicting_changes(self):
  c,t=setup()
  with ThreadPoolExecutor(2) as p:results=list(p.map(lambda state:mark(t,0,state,check=False),['completed','incomplete']))
  self.assertEqual(sum(r.returncode==0 for r in results),1);self.assertIn('reload',next(r.stderr for r in results if r.returncode))
 def test_any_all_actual_submission_and_manual_override(self):
  c,t=setup();a,q=exam(c);b,qb=exam(c);rule(t,0,'all',[a,b]);self.assertFalse(read(c)['topics'][0]['completed'])
  run(f"SELECT public.start_exam_attempt('{a}')",U);self.assertFalse(read(c)['topics'][0]['completed'])
  submit(a,q);self.assertFalse(read(c)['topics'][0]['completed']);rule(t,1,'any',[a,b]);self.assertTrue(read(c)['topics'][0]['completed'])
  mark(t,0,'incomplete');self.assertFalse(read(c)['topics'][0]['completed']);mark(t,1,'automatic');self.assertTrue(read(c)['topics'][0]['completed'])
  rule(t,2,'all',[a,b]);submit(b,qb);self.assertTrue(read(c)['topics'][0]['completed'])
 def test_manual_is_available_even_if_conditions_are_unmet(self):
  c,t=setup();a,q=exam(c);rule(t,0,'all',[a]);mark(t,0,'completed');self.assertTrue(read(c)['topics'][0]['completed'])
  self.assertEqual(read(c)['topics'][0]['fulfilled'],0)
 def test_rule_scope_current_roles_and_conflicts(self):
  c,t=setup();a,q=exam(c)
  for actor in [U,O,A,S]:self.assertNotEqual(rule(t,0,'any',[a],actor,False).returncode,0)
  rule(t,0,'any',[a]);self.assertEqual(int(rule(t,0,'any',[a]).stdout),1)
  self.assertNotEqual(rule(t,0,'manual',check=False).returncode,0)
  other=course();e,_=exam(other);self.assertNotEqual(rule(t,1,'any',[e],check=False).returncode,0)
 def test_withdrawn_cannot_read_or_write(self):
  c,t=setup();mark(t,0,'completed');run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  self.assertNotEqual(mark(t,1,'incomplete',check=False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.read_lesson_progress('{c}')",U,False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.lesson_completion_overrides WHERE topic_id='{t}'",U),'0')
  self.assertEqual(value(f"SELECT count(*) FROM public.lesson_completion_overrides WHERE topic_id='{t}'"),'1')
 def test_unpublished_section_denies_progress_without_erasing_history(self):
  c,t=setup();mark(t,0,'completed');run(f"UPDATE public.courses SET is_published=false WHERE id='{c}'",I)
  self.assertNotEqual(mark(t,1,'incomplete',check=False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.read_lesson_progress('{c}')",U,False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.lesson_completion_overrides WHERE topic_id='{t}'"),'1')
 def test_demoted_instructor_cannot_revise_conditions_with_old_session(self):
  c,t=setup();e,q=exam(c)
  try:
   run(f"SELECT public.admin_set_user_role('{I}','student')",S)
   self.assertNotEqual(rule(t,0,'any',[e],check=False).returncode,0)
   self.assertEqual(value(f"SELECT count(*) FROM public.lesson_completion_rules WHERE id='{t}'"),'0')
  finally:run(f"SELECT public.admin_set_user_role('{I}','instructor')",S)
 def test_zero_grade_submission_still_completes_an_activity(self):
  c,t=setup();e,q=exam(c);rule(t,0,'any',[e])
  run(f"SELECT public.start_exam_attempt('{e}');SELECT public.submit_exam('{e}','{{\"{q}\":\"wrong\"}}')",U)
  self.assertTrue(read(c)['topics'][0]['completed'])
  self.assertEqual(value(f"SELECT score FROM public.student_results WHERE exam_id='{e}' AND student_id='{U}'"),'0')
 def test_syllabus_edits_keep_progress_for_retained_topic_ids(self):
  c,t=setup();e,q=exam(c);rule(t,0,'any',[e]);mark(t,0,'completed')
  snapshot=json.loads(value(f"SELECT public.read_course_syllabus('{c}')",I));snapshot['units'][0]['title']='Revised unit';snapshot['units'][0]['sections'][0]['title']='Revised topic'
  save(c,snapshot['revision'],snapshot['units'])
  topic=read(c)['topics'][0];self.assertEqual(topic['title'],'Revised topic');self.assertTrue(topic['completed']);self.assertEqual(topic['ruleRevision'],1);self.assertEqual(topic['revision'],1)
 def test_staff_read_has_rules_but_never_another_students_progress(self):
  c,t=setup();mark(t,0,'completed')
  for actor in [I,A,S]:
   data=read(c,actor);self.assertFalse(data['student']);self.assertFalse(data['topics'][0]['completed']);self.assertEqual(data['topics'][0]['revision'],0)
   self.assertEqual(value(f"SELECT count(*) FROM public.lesson_completion_overrides WHERE topic_id='{t}'",actor),'0')
  self.assertNotEqual(run(f"SELECT public.read_lesson_progress('{c}')",O,False).returncode,0)
 def test_direct_writes_and_forged_student_identity_denied(self):
  c,t=setup()
  for actor in [U,I,A,S]:
   for sql in ['INSERT INTO public.lesson_completion_overrides DEFAULT VALUES','UPDATE public.lesson_completion_overrides SET completed=true','DELETE FROM public.lesson_completion_overrides','INSERT INTO public.lesson_completion_rules DEFAULT VALUES','UPDATE public.lesson_completion_rules SET mode=\'manual\'','DELETE FROM public.lesson_completion_rules']:
    self.assertNotEqual(run(sql,actor,False).returncode,0)
 def test_deleted_or_unpublished_activity_does_not_autocomplete(self):
  c,t=setup();e,q=exam(c);rule(t,0,'any',[e]);submit(e,q);self.assertTrue(read(c)['topics'][0]['completed'])
  run(f"UPDATE public.exams SET is_published=false WHERE id='{e}'",I);self.assertFalse(read(c)['topics'][0]['completed'])
  run(f"DELETE FROM public.exams WHERE id='{e}'",I);self.assertFalse(read(c)['topics'][0]['completed'])
 def test_required_audit_failure_rolls_back_progress(self):
  c,t=setup()
  try:
   run("CREATE FUNCTION public.fail_learning_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type IN ('lesson_completion_overrides','lesson_completion_rules') THEN RAISE EXCEPTION 'Required audit failed'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_learning BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_learning_audit()")
   self.assertNotEqual(mark(t,0,'completed',check=False).returncode,0);self.assertEqual(read(c)['topics'][0]['revision'],0)
   self.assertNotEqual(rule(t,0,'manual',check=False).returncode,0);self.assertEqual(read(c)['topics'][0]['ruleRevision'],0)
  finally:run('DROP TRIGGER fail_learning ON public.audit_events; DROP FUNCTION public.fail_learning_audit()')
 def test_rule_audit_identity_and_topic_delete_cascade(self):
  c,t=setup();e,q=exam(c);rule(t,0,'any',[e]);mark(t,0,'completed')
  self.assertEqual(value(f"SELECT actor_id FROM public.audit_events WHERE entity_type='lesson_completion_rules' AND entity_id='{t}' ORDER BY occurred_at LIMIT 1",A),I)
  run(f"DELETE FROM public.syllabus_sections WHERE id='{t}'",I)
  self.assertEqual(value(f"SELECT count(*) FROM public.lesson_completion_overrides WHERE topic_id='{t}'"),'0');self.assertEqual(read(c)['topics'],[])
