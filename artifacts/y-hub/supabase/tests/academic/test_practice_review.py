"""Real isolated PostgreSQL: review transitions, scoped reviewers, audit and scores."""
import json,uuid,unittest
from concurrent.futures import ThreadPoolExecutor
from support import run,value,I,U,O,A,S
from test_practice_sources import setup
from test_practice_sessions import create,publish,read,save

def ready(mode='practice',confirm=True):
 c,p=setup();sid=create(c,p,mode=mode,target=1);publish(sid,p);save(sid,read(sid)['revision'],1,confirm);return c,p,sid

def begin(sid,actor=U,check=True):return run(f"SELECT public.begin_ai_practice_review('{sid}',1)",actor,check)
def auto(review,choice=0,kind='suggestion',actor=U,check=True):
 evidence=value(f"SELECT (q.evidence->0->>'id') FROM practice_private.questions q JOIN public.ai_practice_reviews r ON r.session_id=q.session_id AND r.position=q.position WHERE r.id='{review}'")
 ids="'{}'::uuid[]" if kind!='suggestion' else f"ARRAY['{evidence}'::uuid]"
 selected='NULL' if choice is None else str(choice)
 return run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_recheck('{actor}','{review}',1,'{kind}',{selected},'Automatic explanation',{ids})",check=check)
def request(review,revision=2,actor=U,check=True):return run(f"SELECT public.request_ai_practice_human_review('{review}',{revision})",actor,check)
def resolve(review,choice=1,revision=3,actor=I,explanation='Verified using the course reference',check=True):
 selected='NULL' if choice is None else str(choice)
 return run(f"SELECT public.resolve_ai_practice_review('{review}',{revision},{selected},'{explanation}')",actor,check)
def details(review,actor=U,check=True):return run(f"SELECT public.get_ai_practice_review('{review}')",actor,check)
def score(sid):return json.loads(value(f"SELECT public.get_ai_practice_assessment('{sid}')",U))

class PracticeReview(unittest.TestCase):
 def test_pending_answer_never_counts_as_wrong_or_as_graded(self):
  c,p,sid=ready();self.assertEqual(score(sid)['graded'],0);review=begin(sid).stdout.strip()
  self.assertEqual(score(sid)['pending'],1);self.assertEqual(score(sid)['earned'],0)
  auto(review);request(review);self.assertEqual(score(sid)['graded'],0)
  resolve(review);self.assertEqual(score(sid)['earned'],1);self.assertEqual(score(sid)['graded'],1);self.assertEqual(score(sid)['pending'],0)
 def test_no_review_or_evidence_before_draft_confirmation_or_exam_submission(self):
  for mode in ['practice','exam']:
   c,p,sid=ready(mode,False);self.assertNotEqual(begin(sid,check=False).returncode,0);self.assertEqual(score(sid)['items'],[])
   if mode=='exam':run(f"SELECT public.submit_ai_practice_session('{sid}',{read(sid)['revision']})",U)
   else:save(sid,read(sid)['revision'],1,True)
   self.assertEqual(begin(sid).returncode,0)
 def test_automatic_recheck_required_before_explicit_human_request(self):
  c,p,sid=ready();review=begin(sid).stdout.strip()
  self.assertNotEqual(request(review,1,check=False).returncode,0)
  self.assertNotEqual(details(review,I,False).returncode,0)
  auto(review);self.assertNotEqual(details(review,I,False).returncode,0)
  request(review);self.assertEqual(details(review,I).returncode,0)
 def test_model_disagreement_and_unavailable_remain_excluded(self):
  for kind,choice,outcome in [('suggestion',1,'disagrees'),('uncertain',None,'uncertain'),('unavailable',None,'unavailable')]:
   c,p,sid=ready();review=begin(sid).stdout.strip();auto(review,choice,kind)
   self.assertEqual(json.loads(details(review).stdout)['review']['auto_outcome'],outcome);self.assertEqual(score(sid)['graded'],0)
   request(review);resolve(review,choice=None);self.assertEqual(score(sid)['excluded'],1);self.assertEqual(score(sid)['graded'],0)
 def test_no_cross_account_or_admin_platform_bypass(self):
  c,p,sid=ready();review=begin(sid).stdout.strip();auto(review);request(review)
  for actor in [O,A,S]:
   self.assertNotEqual(begin(sid,actor,False).returncode,0);self.assertNotEqual(details(review,actor,False).returncode,0);self.assertNotEqual(resolve(review,actor=actor,check=False).returncode,0)
   self.assertEqual(value(f"SELECT count(*) FROM public.ai_practice_reviews WHERE id='{review}'",actor),'0')
 def test_direct_writes_fake_worker_and_private_answers_are_denied(self):
  c,p,sid=ready();review=begin(sid).stdout.strip()
  for actor in [U,I,A,S]:
   for sql in ['INSERT INTO public.ai_practice_reviews DEFAULT VALUES','UPDATE public.ai_practice_reviews SET state=\'resolved\'','DELETE FROM public.ai_practice_reviews','SELECT * FROM practice_private.review_details',f"SELECT public.ai_practice_review_context('{U}','{review}')"]:
    self.assertNotEqual(run(sql,actor,False).returncode,0)
 def test_retry_is_idempotent_and_late_automatic_reply_cannot_overwrite_human(self):
  c,p,sid=ready();review=begin(sid).stdout.strip();self.assertEqual(begin(sid).stdout.strip(),review)
  auto(review);self.assertEqual(request(review).stdout,request(review).stdout);first=resolve(review).stdout
  self.assertEqual(resolve(review).stdout,first);auto(review,choice=0)
  self.assertEqual(score(sid)['earned'],1);self.assertNotEqual(resolve(review,choice=0,check=False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_type='ai_practice_reviews' AND entity_id='{review}'"),'4')
 def test_concurrent_resolutions_one_winner(self):
  c,p,sid=ready();review=begin(sid).stdout.strip();auto(review);request(review)
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda n:resolve(review,choice=n,check=False),[0,1]))
  self.assertEqual(sum(r.returncode==0 for r in results),1);self.assertEqual(score(sid)['graded'],1)
 def test_withdrawal_and_changed_source_block_owner_worker_and_reviewer(self):
  c,p,sid=ready();review=begin(sid).stdout.strip();auto(review);request(review)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  for actor in [U,I]:self.assertNotEqual(details(review,actor,False).returncode,0)
  self.assertNotEqual(resolve(review,check=False).returncode,0);self.assertNotEqual(auto(review,check=False).returncode,0)
  self.assertEqual(value(f"SELECT public.list_ai_practice_reviews('{c}')",I),'[]')
  run(f"UPDATE public.course_enrollments SET status='active' WHERE course_id='{c}';UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{p['sourceId']}'")
  self.assertNotEqual(resolve(review,check=False).returncode,0)
 def test_current_instructor_role_and_assignment_are_rechecked(self):
  c,p,sid=ready();review=begin(sid).stdout.strip();auto(review);request(review)
  try:
   run(f"SELECT public.admin_set_user_role('{I}','student')",S)
   self.assertNotEqual(resolve(review,check=False).returncode,0)
  finally:run(f"SELECT public.admin_set_user_role('{I}','instructor')",S)
  old_role=value(f"SELECT role FROM public.users WHERE id='{O}'")
  try:
   run(f"SELECT public.admin_set_user_role('{O}','instructor')",S);run(f"UPDATE public.courses SET instructor_id='{O}' WHERE id='{c}'")
   self.assertNotEqual(details(review,I,False).returncode,0);resolve(review,actor=O)
  finally:run(f"SELECT public.admin_set_user_role('{O}','{old_role}')",S)
 def test_mandatory_audit_failure_rolls_back_resolution_and_grade(self):
  c,p,sid=ready();review=begin(sid).stdout.strip();auto(review);request(review)
  try:
   run("CREATE FUNCTION public.fail_review_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='ai_practice_reviews' THEN RAISE EXCEPTION 'Audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_review BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_review_audit()")
   self.assertNotEqual(resolve(review,check=False).returncode,0);self.assertEqual(score(sid)['graded'],0)
   self.assertIsNone(json.loads(details(review).stdout)['resolution'])
  finally:run('DROP TRIGGER fail_review ON public.audit_events;DROP FUNCTION public.fail_review_audit()')
 def test_audit_records_actor_and_affected_student_but_never_answer_content(self):
  c,p,sid=ready();review=begin(sid).stdout.strip();auto(review);request(review);resolve(review,explanation='Private resolution text must stay private')
  rows=json.loads(value(f"SELECT jsonb_agg(to_jsonb(e)) FROM public.audit_events e WHERE entity_id='{review}'",A))
  self.assertEqual(len(rows),1);self.assertEqual(rows[0]['actor_id'],I);self.assertNotIn('Private resolution',json.dumps(rows));self.assertNotIn('2x',json.dumps(rows))
  self.assertEqual(value(f"SELECT person_id FROM public.audit_event_people WHERE event_id='{rows[0]['id']}' AND relation='affected'",A),U)
 def test_queue_pagination_and_resolved_filter(self):
  c,p,sid=ready();review=begin(sid).stdout.strip();auto(review);request(review)
  rows=json.loads(value(f"SELECT public.list_ai_practice_reviews('{c}')",I));self.assertEqual(rows[0]['student_id'],U);self.assertRegex(rows[0]['user_number'],r'^\d{9}$')
  self.assertEqual(value(f"SELECT public.list_ai_practice_reviews('{c}',false,20)",I),'[]');resolve(review)
  self.assertEqual(value(f"SELECT public.list_ai_practice_reviews('{c}')",I),'[]');self.assertEqual(len(json.loads(value(f"SELECT public.list_ai_practice_reviews('{c}',true)",I))),1)
 def test_no_self_review_even_when_instructor_owns_section(self):
  c,p=setup();sid=create(c,p,actor=I,target=1);publish(sid,p,actor=I)
  run(f"SELECT public.save_ai_practice_answer('{sid}',1,2,0,true)",I);review=begin(sid,I).stdout.strip();auto(review,actor=I);request(review,actor=I)
  self.assertNotEqual(resolve(review,actor=I,check=False).returncode,0)
