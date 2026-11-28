"""Actual math artifact + local GoTrue/JWT/PostgREST. No hosted deployment claims."""
import json, subprocess, unittest
from pathlib import Path
import test_practice_math as fixtures

class WrittenAnswersHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.PracticeMathHTTP.setUpClass.__func__)
 setUp=fixtures.PracticeMathHTTP.setUp
 req=fixtures.PracticeMathHTTP.req
 selection=fixtures.PracticeMathHTTP.selection
 create=fixtures.PracticeMathHTTP.create
 worker=fixtures.PracticeMathHTTP.worker
 proposal=fixtures.PracticeMathHTTP.proposal
 read=fixtures.PracticeMathHTTP.read
 save=fixtures.PracticeMathHTTP.save
 computed=fixtures.PracticeMathHTTP.computed
 assessment=fixtures.PracticeMathHTTP.assessment
 def ready(self,mode='practice'):
  sid,_=self.create(mode);args=self.computed(sid);self.assertEqual(self.worker('publish_ai_practice_math_question',args)[0],204);return sid,args
 def write(self,sid,args,text='3x^2+4x-5',confirm=False,revision=None):
  module=(Path(__file__).resolve().parents[2]/'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
  code='import {gradeWrittenPolynomial} from '+json.dumps(module)+';process.stdout.write(JSON.stringify(gradeWrittenPolynomial('+json.dumps(args['p_verification'])+','+json.dumps(text)+',"ar")));'
  result=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],text=True,timeout=10))
  return self.worker('save_ai_practice_written_answer',{'p_actor':self.users['student']['id'],'p_id':sid,'p_position':1,'p_revision':revision or self.read(sid)['revision'],'p_text':text,'p_score':result['score'],'p_explanation':result['explanation'],'p_answer':confirm})
 def test_real_computation_is_private_until_confirmed(self):
  sid,args=self.ready();self.assertEqual(self.write(sid,args)[0],200)
  q=self.read(sid)['questions'][0];self.assertEqual(q['writtenAnswer'],'3x^2+4x-5');self.assertIsNone(q['feedback']);self.assertEqual(self.assessment(sid)['graded'],0)
  self.assertEqual(self.write(sid,args,confirm=True)[0],200);self.assertEqual(self.assessment(sid)['earned'],1)
 def test_unsubmitted_exam_cannot_leak_result_through_assessment(self):
  sid,args=self.ready('exam');self.write(sid,args,'7x',False)
  self.assertEqual(self.assessment(sid)['items'],[]);self.assertIsNone(self.read(sid)['questions'][0]['feedback'])
  self.req('student','/rpc/submit_ai_practice_session',{'p_id':sid,'p_revision':self.read(sid)['revision']})
  self.assertEqual((self.assessment(sid)['earned'],self.assessment(sid)['graded']),(0,1))
 def test_real_engine_marks_unsupported_pending_and_reviewer_resolves(self):
  sid,args=self.ready();self.write(sid,args,'(x+1)^2',True)
  self.assertEqual((self.assessment(sid)['graded'],self.assessment(sid)['pending']),(0,1))
  status,rid=self.req('student','/rpc/begin_ai_practice_review',{'p_session':sid,'p_position':1});self.assertEqual(status,200)
  self.assertEqual(self.worker('publish_ai_practice_written_recheck',{'p_actor':self.users['student']['id'],'p_review':rid,'p_revision':1,'p_score':None,'p_explanation':'Unsupported expression needs human review'})[0],200)
  self.assertEqual(self.req('student','/rpc/request_ai_practice_human_review',{'p_review':rid,'p_revision':2})[0],200)
  payload={'p_review':rid,'p_revision':3,'p_score':0,'p_explanation':'Expression differs from the required derivative.'}
  for role in ['student','admin','super_admin','other',None]:self.assertIn(self.req(role,'/rpc/resolve_ai_practice_written_review',payload)[0],[401,403])
  self.assertEqual(self.req('instructor','/rpc/resolve_ai_practice_written_review',payload)[0],200)
  self.assertEqual((self.assessment(sid)['earned'],self.assessment(sid)['graded']),(0,1))
 def test_browser_roles_cannot_forge_server_grade_or_read_task(self):
  sid,args=self.ready();payload={'p_actor':self.users['student']['id'],'p_id':sid,'p_position':1}
  for role in ['student','instructor','admin','super_admin','other',None]:
   self.assertIn(self.req(role,'/rpc/ai_practice_written_context',payload)[0],[401,403])
   self.assertIn(self.req(role,'/rpc/save_ai_practice_written_answer',{**payload,'p_revision':2,'p_text':'2x','p_score':1,'p_explanation':'forged','p_answer':True})[0],[401,403])
 def test_stale_revision_and_withdrawal_reject_new_writes(self):
  sid,args=self.ready();old=self.read(sid)['revision'];self.write(sid,args)
  self.assertEqual(self.write(sid,args,'7x',revision=old)[0],409)
  self.assertEqual(self.write(sid,args,revision=old)[0],200)
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
  self.assertEqual(self.write(sid,args,'7x',revision=old)[0],403)
