"""Isolated PostgreSQL: trusted engine publication, current permissions and honest scores."""
import json,unittest
from concurrent.futures import ThreadPoolExecutor
from support import run,value,I,U,A,S,O
from test_practice_sources import setup,literal
from test_practice_sessions import create,read,save,publish
from test_practice_review import begin,auto,request,resolve,score
VERIFICATION={'method':'polynomial-derivative-v1','task':{'kind':'polynomial_derivative','variable':'x','coefficients':[0,0,1],'options':[[0,2],[0,3],[0,4],[0,5]]}}
def math_publish(sid,p,verification=VERIFICATION,actor=U,check=True,question=None):
 chunk=value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{p['sourceId']}' ORDER BY ordinal LIMIT 1")
 q=question or {'prompt':'Engine-rendered derivative x²','options':['2x','3x','4x','5x'],'correct':0,'explanation':'Engine-rendered steps.'}
 return run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_math_question('{actor}','{sid}',1,{literal(q)},ARRAY['{chunk}'::uuid],{literal(verification)})",check=check)
class PracticeMath(unittest.TestCase):
 def test_math_grade_and_provenance_wait_for_confirmed_answer(self):
  c,p=setup();sid=create(c,p,target=1);math_publish(sid,p)
  self.assertIsNone(read(sid)['questions'][0]['feedback']);self.assertEqual(score(sid)['items'],[])
  save(sid,read(sid)['revision'],0,True)
  self.assertEqual(read(sid)['questions'][0]['feedback']['verification'],'polynomial-derivative-v1')
  result=score(sid);self.assertEqual((result['earned'],result['graded'],result['pending']),(1,1,0));self.assertEqual(result['items'][0]['state'],'math_verified')
 def test_wrong_verified_choice_is_scored_only_after_self_test_submission(self):
  c,p=setup();sid=create(c,p,mode='exam',target=1);math_publish(sid,p);save(sid,read(sid)['revision'],1,True)
  self.assertEqual(score(sid)['graded'],0);self.assertIsNone(read(sid)['questions'][0]['feedback'])
  run(f"SELECT public.submit_ai_practice_session('{sid}',{read(sid)['revision']})",U)
  result=score(sid);self.assertEqual((result['earned'],result['graded']),(0,1))
 def test_request_suspends_engine_score_and_human_resolution_has_precedence(self):
  c,p=setup();sid=create(c,p,target=1);math_publish(sid,p);save(sid,read(sid)['revision'],0,True)
  review=begin(sid).stdout.strip();self.assertEqual(score(sid)['graded'],0)
  auto(review);request(review);resolve(review,choice=None)
  self.assertEqual((score(sid)['graded'],score(sid)['excluded']),(0,1))
  math_publish(sid,p);self.assertEqual(score(sid)['excluded'],1)
 def test_browser_cannot_claim_verification_even_with_admin_role(self):
  c,p=setup();sid=create(c,p)
  for actor in [U,I,A,S,O]:
   self.assertNotEqual(run(f"SELECT public.publish_ai_practice_math_question('{U}','{sid}',1,'{{}}','{{}}','{{}}')",actor,False).returncode,0)
   self.assertNotEqual(run("UPDATE practice_private.questions SET math_verification='{}'",actor,False).returncode,0)
  self.assertEqual(read(sid)['questions'],[])
 def test_ordinary_model_answer_is_never_upgraded_by_retry(self):
  c,p=setup();sid=create(c,p);publish(sid,p);math_publish(sid,p);save(sid,read(sid)['revision'],0,True)
  self.assertIsNone(read(sid)['questions'][0]['feedback']['verification']);self.assertEqual(score(sid)['graded'],0)
 def test_duplicate_engine_publication_is_idempotent_and_cannot_overwrite_key(self):
  c,p=setup();sid=create(c,p,target=1)
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:math_publish(sid,p,check=False),[0,1]))
  self.assertTrue(all(r.returncode==0 for r in results));self.assertEqual(read(sid)['revision'],2)
  math_publish(sid,p,question={'prompt':'Changed','options':['a','b','c','d'],'correct':3,'explanation':'Changed'})
  save(sid,2,0,True);self.assertEqual(read(sid)['questions'][0]['feedback']['suggestedChoice'],0)
 def test_current_engine_policy_denial_rolls_back_publication(self):
  c,p=setup();sid=create(c,p)
  try:
   run("UPDATE public.module_policies SET enabled=false WHERE id='calculus-1'")
   self.assertNotEqual(math_publish(sid,p,check=False).returncode,0);self.assertEqual(read(sid)['questions'],[])
  finally:run("UPDATE public.module_policies SET enabled=true WHERE id='calculus-1'")
 def test_wrong_evidence_or_changed_source_leaves_no_partial_verified_row(self):
  c,p=setup();sid=create(c,p);other,p2=setup()
  self.assertNotEqual(math_publish(sid,p2,check=False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM practice_private.questions WHERE session_id='{sid}'"),'0')
  run(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{p['sourceId']}'")
  self.assertNotEqual(math_publish(sid,p,check=False).returncode,0)
 def test_invalid_verification_contract_is_rejected_atomically(self):
  c,p=setup();sid=create(c,p)
  for verification in [None,{}, {'method':'numerical-samples','task':VERIFICATION['task']}, {**VERIFICATION,'claimedGrade':1}]:
   self.assertNotEqual(math_publish(sid,p,verification,check=False).returncode,0)
  self.assertEqual(read(sid)['questions'],[])
 def test_withdrawal_revokes_verified_history_and_future_publication(self):
  c,p=setup();sid=create(c,p,target=1);math_publish(sid,p)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  self.assertNotEqual(math_publish(sid,p,check=False).returncode,0)
  for actor in [U,I,A,S,O]:self.assertNotEqual(run(f"SELECT public.get_ai_practice_assessment('{sid}')",actor,False).returncode,0)
