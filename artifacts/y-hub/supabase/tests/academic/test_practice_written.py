"""Real isolated PostgreSQL: written answers, release, current ACLs and review scores."""
import json, unittest
from concurrent.futures import ThreadPoolExecutor
from support import run, value, I, U, A, S, O
from test_practice_sources import setup
from test_practice_sessions import create, read, save, publish
from test_practice_math import math_publish
from test_practice_review import begin, request, score, details, resolve, auto

def sqltext(text):
 return "NULL" if text is None else "'"+str(text).replace("'","''")+"'"
def ready(mode='practice'):
 c,p=setup(); sid=create(c,p,target=1,mode=mode);math_publish(sid,p);return c,p,sid
def written(sid,text='2x',result=1,confirm=False,revision=None,actor=U,check=True):
 revision=read(sid)['revision'] if revision is None else revision
 return run(f"SET LOCAL ROLE service_role;SELECT public.save_ai_practice_written_answer('{actor}','{sid}',1,{revision},{sqltext(text)},{sqltext(result)},'Private engine explanation',{str(confirm).lower()})",check=check)
def recheck(review,result=1,check=True):
 return run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_written_recheck('{U}','{review}',1,{sqltext(result)},'Private automatic explanation')",check=check)
def resolve_written(review,result=1,actor=I,revision=3,check=True):
 return run(f"SELECT public.resolve_ai_practice_written_review('{review}',{revision},{sqltext(result)},'Private instructor explanation')",actor,check)

class PracticeWritten(unittest.TestCase):
 def test_draft_is_saved_but_score_and_explanation_are_hidden(self):
  c,p,sid=ready();written(sid)
  q=read(sid)['questions'][0];self.assertEqual(q['writtenAnswer'],'2x');self.assertIsNone(q['choice']);self.assertIsNone(q['feedback']);self.assertTrue(q['acceptsWritten'])
  self.assertNotIn('Private engine',json.dumps(read(sid)));self.assertEqual(score(sid)['items'],[])
  written(sid,confirm=True);self.assertEqual((score(sid)['earned'],score(sid)['graded']),(1,1))
  self.assertEqual(read(sid)['questions'][0]['feedback']['writtenResult']['score'],1)
 def test_exam_withholds_written_results_until_submission(self):
  c,p,sid=ready('exam');written(sid,'77x',0)
  self.assertIsNone(read(sid)['questions'][0]['feedback']);self.assertEqual(score(sid)['graded'],0)
  run(f"SELECT public.submit_ai_practice_session('{sid}',{read(sid)['revision']})",U)
  self.assertEqual((score(sid)['earned'],score(sid)['graded']),(0,1))
  self.assertNotEqual(written(sid,'2x',1,check=False).returncode,0)
 def test_pending_is_not_wrong_and_human_resolution_overrides(self):
  c,p,sid=ready();written(sid,'x+x with explanation',None,True)
  self.assertEqual((score(sid)['pending'],score(sid)['graded']),(1,0))
  review=begin(sid).stdout.strip();self.assertNotEqual(request(review,1,check=False).returncode,0)
  recheck(review,None);request(review);self.assertEqual(json.loads(details(review,I).stdout)['question']['writtenAnswer'],'x+x with explanation')
  resolve_written(review,1);self.assertEqual((score(sid)['earned'],score(sid)['graded']),(1,1))
  self.assertEqual(json.loads(details(review).stdout)['resolution']['score'],1)
 def test_requested_review_suspends_score_and_exclusion_is_not_zero(self):
  c,p,sid=ready();written(sid,confirm=True);review=begin(sid).stdout.strip()
  self.assertEqual(score(sid)['graded'],0);recheck(review);request(review);resolve_written(review,None)
  self.assertEqual((score(sid)['excluded'],score(sid)['graded']),(1,0))
 def test_no_browser_can_forge_score_or_read_private_context(self):
  c,p,sid=ready()
  for actor in [U,I,A,S,O]:
   for command in [f"SELECT public.ai_practice_written_context('{U}','{sid}',1)",f"SELECT public.save_ai_practice_written_answer('{U}','{sid}',1,2,'2x',1,'fake',true)","UPDATE practice_private.questions SET written_score=1"]:
    self.assertNotEqual(run(command,actor,False).returncode,0)
  self.assertIsNone(read(sid)['questions'][0]['writtenAnswer'])
 def test_cross_account_and_revoked_access_are_rechecked_at_write(self):
  c,p,sid=ready();revision=read(sid)['revision']
  self.assertNotEqual(written(sid,actor=O,revision=revision,check=False).returncode,0)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  self.assertNotEqual(written(sid,revision=revision,check=False).returncode,0)
 def test_source_and_engine_revocation_block_publication(self):
  c,p,sid=ready();revision=read(sid)['revision']
  try:
   run("UPDATE public.module_policies SET enabled=false WHERE id='calculus-1'")
   self.assertNotEqual(written(sid,revision=revision,check=False).returncode,0)
  finally:run("UPDATE public.module_policies SET enabled=true WHERE id='calculus-1'")
  run(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{p['sourceId']}'")
  self.assertNotEqual(written(sid,revision=revision,check=False).returncode,0)
 def test_concurrent_different_writes_one_winner_and_lost_ack_is_idempotent(self):
  c,p,sid=ready();revision=read(sid)['revision']
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda text:written(sid,text,1,revision=revision,check=False),['2x','x+x']))
  self.assertEqual(sum(r.returncode==0 for r in results),1)
  current=read(sid);text=current['questions'][0]['writtenAnswer'];written(sid,text,1,revision=revision)
  self.assertEqual(read(sid)['revision'],current['revision'])
 def test_switching_choice_and_written_drafts_clears_other_answer_kind(self):
  c,p,sid=ready();save(sid,2,1);written(sid)
  self.assertIsNone(read(sid)['questions'][0]['choice']);save(sid,read(sid)['revision'],0,True)
  q=read(sid)['questions'][0];self.assertIsNone(q['writtenAnswer']);self.assertIsNone(q['feedback']['writtenResult']);self.assertEqual(score(sid)['earned'],1)
  self.assertNotEqual(written(sid,check=False).returncode,0)
 def test_no_written_answer_on_unverified_model_question(self):
  c,p=setup();sid=create(c,p,target=1);publish(sid,p)
  self.assertFalse(read(sid)['questions'][0]['acceptsWritten']);self.assertNotEqual(written(sid,check=False).returncode,0)
 def test_no_review_cross_kind_confusion_or_late_overwrite(self):
  c,p,sid=ready();written(sid,confirm=True);review=begin(sid).stdout.strip()
  self.assertNotEqual(auto(review,check=False).returncode,0);recheck(review);request(review)
  self.assertNotEqual(resolve(review,check=False).returncode,0)
  for actor in [U,A,S,O]:self.assertNotEqual(resolve_written(review,actor=actor,check=False).returncode,0)
  first=resolve_written(review,0).stdout;self.assertEqual(resolve_written(review,0).stdout,first);recheck(review,1)
  self.assertEqual(score(sid)['earned'],0);self.assertEqual(score(sid)['graded'],1)
 def test_written_review_audit_does_not_contain_private_text(self):
  c,p,sid=ready();written(sid,confirm=True);review=begin(sid).stdout.strip();recheck(review);request(review);resolve_written(review)
  events=value(f"SELECT jsonb_agg(to_jsonb(e)) FROM public.audit_events e WHERE entity_id='{review}'")
  self.assertNotIn('Private',events);self.assertNotIn('2x',events);self.assertIn(I,events)
 def test_weighted_performance_uses_same_written_score_and_pending_rule(self):
  c,p,sid=ready();written(sid,result=None,confirm=True)
  rows=json.loads(value(f"SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM practice_private.performance_answers('{U}','{c}') r"))
  self.assertIsNone(rows[0]['score']);self.assertFalse(rows[0]['excluded'])
  review=begin(sid).stdout.strip();recheck(review);request(review);resolve_written(review,0)
  rows=json.loads(value(f"SELECT jsonb_agg(to_jsonb(r)) FROM practice_private.performance_answers('{U}','{c}') r"));self.assertEqual(rows[0]['score'],0)
 def test_draft_and_exam_review_release_cannot_be_bypassed(self):
  for mode in ['practice','exam']:
   c,p,sid=ready(mode);written(sid)
   self.assertNotEqual(begin(sid,check=False).returncode,0)
 def test_revoked_engine_blocks_new_grades_but_not_a_pending_human_review(self):
  c,p,sid=ready();written(sid,confirm=True);review=begin(sid).stdout.strip()
  try:
   run("UPDATE public.module_policies SET enabled=false WHERE id='calculus-1'")
   self.assertNotEqual(recheck(review,1,check=False).returncode,0)
   recheck(review,None);request(review);resolve_written(review,1)
   self.assertEqual(score(sid)['earned'],1)
  finally:run("UPDATE public.module_policies SET enabled=true WHERE id='calculus-1'")
 def test_mandatory_audit_failure_rolls_back_written_resolution(self):
  c,p,sid=ready();written(sid,confirm=True);review=begin(sid).stdout.strip();recheck(review);request(review)
  try:
   run("CREATE FUNCTION public.fail_written_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='ai_practice_reviews' THEN RAISE EXCEPTION 'Audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_written BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_written_audit()")
   self.assertNotEqual(resolve_written(review,check=False).returncode,0)
   self.assertEqual(score(sid)['graded'],0);self.assertIsNone(json.loads(details(review).stdout)['resolution'])
  finally:run('DROP TRIGGER fail_written ON public.audit_events;DROP FUNCTION public.fail_written_audit()')
