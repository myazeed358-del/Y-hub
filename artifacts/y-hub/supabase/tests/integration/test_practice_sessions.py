"""Native local GoTrue/JWT/PostgREST: private answer flow, not mocked authorization."""
import base64,hashlib,hmac,json,time,unittest,uuid
import test_practice_sources as fixtures

class PracticeSessionsHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.PracticeSourcesHTTP.setUpClass.__func__)
 setUp=fixtures.PracticeSourcesHTTP.setUp
 req=fixtures.PracticeSourcesHTTP.req
 selection=fixtures.PracticeSourcesHTTP.selection
 def create(self,mode='practice',target=1,id=None):
  id=id or str(uuid.uuid4());args={**self.selection(),'p_id':id,'p_units':[],'p_query':'','p_mode':mode,'p_difficulty':'easy','p_language':'ar','p_target':target}
  status,data=self.req('student','/rpc/create_ai_practice_session',args);self.assertEqual((status,data),(200,id));return id,args
 def worker(self,name,args):
  enc=lambda x:base64.urlsafe_b64encode(x).rstrip(b'=').decode()
  head=enc(b'{"alg":"HS256","typ":"JWT"}');body=enc(json.dumps({'role':'service_role','exp':int(time.time())+120}).encode());sig=enc(hmac.new(self.stack.secret.encode(),(head+'.'+body).encode(),hashlib.sha256).digest())
  return self.stack.request('rest','/rpc/'+name,args,head+'.'+body+'.'+sig)
 def proposal(self,id):
  chunk=self.stack.sql(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{self.source}' ORDER BY ordinal LIMIT 1")
  return {'p_actor':self.users['student']['id'],'p_id':id,'p_position':1,'p_question':{'prompt':'مشتقة $x^2$؟','options':['$2x$','$3x$','$4x$','$5x$'],'correct':0,'explanation':'قاعدة القوة'},'p_evidence_ids':[chunk]}
 def read(self,id):
  status,data=self.req('student','/rpc/read_ai_practice_session',{'p_id':id});self.assertEqual(status,200);return data
 def save(self,id,revision,choice=0,answer=False):return self.req('student','/rpc/save_ai_practice_answer',{'p_id':id,'p_position':1,'p_revision':revision,'p_choice':choice,'p_answer':answer})
 def test_01_retry_creation_worker_generation_and_delayed_practice_feedback(self):
  id,args=self.create();self.assertEqual(self.req('student','/rpc/create_ai_practice_session',args),(200,id))
  self.assertEqual(self.worker('publish_ai_practice_question',self.proposal(id))[0],204)
  initial=self.read(id);self.assertIsNone(initial['questions'][0]['feedback'])
  status,revision=self.save(id,initial['revision']);self.assertEqual(status,200);self.assertIsNone(self.read(id)['questions'][0]['feedback'])
  self.assertEqual(self.save(id,revision,answer=True)[0],200);self.assertEqual(self.read(id)['questions'][0]['feedback']['citations'][0]['page'],2)
 def test_02_exam_draft_awaits_final_submission_and_retry_is_idempotent(self):
  id,_=self.create('exam');self.assertEqual(self.worker('publish_ai_practice_question',self.proposal(id))[0],204)
  status,revision=self.save(id,self.read(id)['revision'],1);self.assertEqual(status,200);self.assertIsNone(self.read(id)['questions'][0]['feedback'])
  args={'p_id':id,'p_revision':revision};first=self.req('student','/rpc/submit_ai_practice_session',args);self.assertEqual(first[0],200);self.assertEqual(self.req('student','/rpc/submit_ai_practice_session',args),first)
  self.assertFalse(self.read(id)['questions'][0]['feedback']['matchesSuggestion'])
 def test_03_browser_cannot_publish_forge_identity_or_read_answer_store(self):
  id,_=self.create()
  for role in ['student','instructor','admin','super_admin','other',None]:
   self.assertIn(self.req(role,'/rpc/publish_ai_practice_question',self.proposal(id))[0],[401,403])
  self.assertEqual(self.stack.request('rest','/questions',token=self.users['student']['token'],profile='practice_private')[0],406);self.assertEqual(self.read(id)['questions'],[])
  for method,data in [('POST',{'id':id}),('PATCH',{'revision':99}),('DELETE',None)]:self.assertEqual(self.req('student','/ai_practice_sessions',data,method)[0],403)
 def test_04_withdrawal_revokes_existing_content_and_worker_publication(self):
  id,_=self.create();self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
  self.assertEqual(self.req('student','/rpc/read_ai_practice_session',{'p_id':id})[0],403)
  self.assertEqual(self.worker('publish_ai_practice_question',self.proposal(id))[0],403)
  self.assertEqual(self.req('student',f'/ai_practice_sessions?id=eq.{id}'),(200,[]))
 def test_05_isolation_source_revision_and_current_role(self):
  id,_=self.create()
  for role in ['instructor','admin','super_admin','other']:self.assertEqual(self.req(role,'/rpc/read_ai_practice_session',{'p_id':id})[0],403)
  self.stack.sql(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{self.source}'")
  self.assertEqual(self.req('student','/rpc/read_ai_practice_session',{'p_id':id})[0],409)
  self.assertEqual(self.worker('publish_ai_practice_question',self.proposal(id))[0],409)
 def test_06_device_conflict_and_lost_acknowledgement(self):
  id,_=self.create();self.assertEqual(self.worker('publish_ai_practice_question',self.proposal(id))[0],204)
  rev=self.read(id)['revision'];status,saved=self.save(id,rev,0);self.assertEqual(status,200)
  self.assertEqual(self.save(id,rev,1)[0],409);self.assertEqual(self.save(id,rev,0),(200,saved))
