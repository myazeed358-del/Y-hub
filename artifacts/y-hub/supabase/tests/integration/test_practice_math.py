"""Real deployed artifact + native local Auth/JWT/PostgREST; no production writes."""
import json,subprocess,unittest
from pathlib import Path
import test_practice_sessions as fixtures
class PracticeMathHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.PracticeSessionsHTTP.setUpClass.__func__)
 def setUp(self):
  fixtures.PracticeSessionsHTTP.setUp(self)
  self.stack.sql(f"UPDATE public.users SET major='mathematics' WHERE id IN ('{self.users['student']['id']}','{self.users['instructor']['id']}')")
 req=fixtures.PracticeSessionsHTTP.req
 selection=fixtures.PracticeSessionsHTTP.selection
 create=fixtures.PracticeSessionsHTTP.create
 worker=fixtures.PracticeSessionsHTTP.worker
 proposal=fixtures.PracticeSessionsHTTP.proposal
 read=fixtures.PracticeSessionsHTTP.read
 save=fixtures.PracticeSessionsHTTP.save
 def computed(self,sid):
  module=(Path(__file__).resolve().parents[2]/'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
  code="import {verifyDerivative} from "+json.dumps(module)+";process.stdout.write(JSON.stringify(verifyDerivative({kind:'polynomial_derivative',variable:'x',coefficients:[1,-5,2,1],options:[[-5,4,3],[0],[1],[2]]},'ar')));"
  result=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],text=True,timeout=10))
  return {**self.proposal(sid),'p_question':result['question'],'p_verification':result['verification']}
 def assessment(self,sid):
  status,data=self.req('student','/rpc/get_ai_practice_assessment',{'p_session':sid});self.assertEqual(status,200);return data
 def test_01_real_engine_output_through_authenticated_storage_and_scoring(self):
  sid,_=self.create();args=self.computed(sid)
  self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],204)
  self.assertIsNone(self.read(sid)['questions'][0]['feedback']);self.assertEqual(self.assessment(sid)['graded'],0)
  self.assertEqual(self.save(sid,self.read(sid)['revision'],0,True)[0],200)
  self.assertEqual(self.assessment(sid)['earned'],1)
  feedback=self.read(sid)['questions'][0]['feedback'];self.assertIn('3x^{2}+4x-5',feedback['explanation']);self.assertEqual(feedback['verification'],'polynomial-derivative-v1')
 def test_02_no_browser_can_forge_engine_output(self):
  sid,_=self.create();args=self.computed(sid)
  for role in ['student','instructor','admin','super_admin','other',None]:self.assertIn(self.req(role,'/rpc/publish_ai_practice_math_question',args)[0],[401,403])
  self.assertEqual(self.read(sid)['questions'],[])
 def test_03_revoked_engine_permission_blocks_trusted_worker(self):
  sid,_=self.create();args=self.computed(sid)
  self.stack.sql("UPDATE public.module_policies SET enabled=false WHERE id='calculus-1'")
  try:
   self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],403);self.assertEqual(self.read(sid)['questions'],[])
  finally:self.stack.sql("UPDATE public.module_policies SET enabled=true WHERE id='calculus-1'")
 def test_04_self_test_withholds_verified_score_then_review_suspends_it(self):
  sid,_=self.create('exam');args=self.computed(sid);self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],204)
  self.save(sid,self.read(sid)['revision'],1,True);self.assertEqual(self.assessment(sid)['graded'],0)
  self.assertEqual(self.req('student','/rpc/submit_ai_practice_session',{'p_id':sid,'p_revision':self.read(sid)['revision']})[0],200)
  self.assertEqual((self.assessment(sid)['earned'],self.assessment(sid)['graded']),(0,1))
  self.assertEqual(self.req('student','/rpc/begin_ai_practice_review',{'p_session':sid,'p_position':1})[0],200)
  self.assertEqual((self.assessment(sid)['graded'],self.assessment(sid)['pending']),(0,1))
 def test_05_retry_and_current_section_isolation(self):
  sid,_=self.create();args=self.computed(sid)
  self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],204)
  self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],204);self.assertEqual(self.read(sid)['revision'],2)
  for role in ['other','instructor','admin','super_admin']:self.assertEqual(self.req(role,'/rpc/get_ai_practice_assessment',{'p_session':sid})[0],403)
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
  self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],403)
 def test_06_exceptional_permission_is_current_and_revocable(self):
  sid,_=self.create();args=self.computed(sid)
  self.stack.sql(f"UPDATE public.users SET major='physics' WHERE id='{self.users['student']['id']}'")
  self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],403)
  status,grants=self.req('instructor','/rpc/grant_engine_access_batch',{'p_course':self.course,'p_student':self.users['student']['id'],'p_engines':['calculus-1'],'p_expires':None})
  self.assertEqual(status,200,grants)
  self.assertEqual(self.req('student','/rpc/authorize_engine_compute',{'p_protocol':'ast','p_scope':'derive'}),(200,True))
  self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],204)
  self.assertEqual(self.req('instructor','/rpc/revoke_engine_access',{'p_grant':grants[0]})[0],200)
  self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],403)
