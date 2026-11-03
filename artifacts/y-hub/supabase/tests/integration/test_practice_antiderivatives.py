"""Native local GoTrue/JWT/PostgREST with the deployed engine adapter, no provider mock proof."""
import json,subprocess,unittest
from pathlib import Path
import test_practice_math as fixtures

class AntiderivativeHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.PracticeMathHTTP.setUpClass.__func__)
 setUp=fixtures.PracticeMathHTTP.setUp
 req=fixtures.PracticeMathHTTP.req
 selection=fixtures.PracticeMathHTTP.selection
 create=fixtures.PracticeMathHTTP.create
 worker=fixtures.PracticeMathHTTP.worker
 proposal=fixtures.PracticeMathHTTP.proposal
 read=fixtures.PracticeMathHTTP.read
 save=fixtures.PracticeMathHTTP.save
 assessment=fixtures.PracticeMathHTTP.assessment
 def computed(self,sid):
  module=(Path(__file__).resolve().parents[2]/'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
  code='import {verifyAntiderivative} from '+json.dumps(module)+";process.stdout.write(JSON.stringify(verifyAntiderivative({kind:'polynomial_antiderivative',variable:'t',coefficients:[2,-6,3],options:[[0,2,-3,1],[0,2,-6,1],[0,2,-3,3],[0]]},'ar')));"
  result=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],text=True,timeout=10))
  return {**self.proposal(sid),'p_question':result['question'],'p_verification':result['verification']}
 def test_01_real_computation_then_delayed_arabic_feedback(self):
  sid,_=self.create();args=self.computed(sid)
  self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],204)
  self.assertIsNone(self.read(sid)['questions'][0]['feedback'])
  self.assertEqual(self.save(sid,self.read(sid)['revision'],0,True)[0],200)
  feedback=self.read(sid)['questions'][0]['feedback']
  self.assertEqual(feedback['verification'],'polynomial-antiderivative-v1')
  self.assertIn('t^{3}-3t^{2}+2t+C',feedback['explanation'])
  self.assertEqual(self.assessment(sid)['earned'],1)
 # Exercise the same native authorization contracts with the NEW operation.
 test_02_browser_cannot_forge=fixtures.PracticeMathHTTP.test_02_no_browser_can_forge_engine_output
 test_03_current_engine_permission=fixtures.PracticeMathHTTP.test_03_revoked_engine_permission_blocks_trusted_worker
 test_04_self_test_and_review=fixtures.PracticeMathHTTP.test_04_self_test_withholds_verified_score_then_review_suspends_it
 test_05_retry_and_withdrawal=fixtures.PracticeMathHTTP.test_05_retry_and_current_section_isolation
 test_06_exceptional_grants=fixtures.PracticeMathHTTP.test_06_exceptional_permission_is_current_and_revocable
