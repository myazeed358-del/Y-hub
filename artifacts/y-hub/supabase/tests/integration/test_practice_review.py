"""Review lifecycle over actual isolated GoTrue/JWT/PostgREST with no production target."""
import unittest
import test_practice_sessions as fixtures

class PracticeReviewHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.PracticeSessionsHTTP.setUpClass.__func__)
 setUp=fixtures.PracticeSessionsHTTP.setUp
 req=fixtures.PracticeSessionsHTTP.req
 selection=fixtures.PracticeSessionsHTTP.selection
 create=fixtures.PracticeSessionsHTTP.create
 worker=fixtures.PracticeSessionsHTTP.worker
 proposal=fixtures.PracticeSessionsHTTP.proposal
 read=fixtures.PracticeSessionsHTTP.read
 save=fixtures.PracticeSessionsHTTP.save
 def ready(self,confirm=True,mode='practice'):
  session,_=self.create(mode);self.assertEqual(self.worker('publish_ai_practice_question',self.proposal(session))[0],204)
  self.assertEqual(self.save(session,self.read(session)['revision'],1,confirm)[0],200);return session
 def begin(self,session):
  status,id=self.req('student','/rpc/begin_ai_practice_review',{'p_session':session,'p_position':1});self.assertEqual(status,200);return id
 def auto(self,id,session):return self.worker('publish_ai_practice_recheck',{'p_actor':self.users['student']['id'],'p_review':id,'p_revision':1,'p_kind':'suggestion','p_choice':1,'p_explanation':'Independent model suggestion','p_evidence':self.proposal(session)['p_evidence_ids']})
 def request(self,id):return self.req('student','/rpc/request_ai_practice_human_review',{'p_review':id,'p_revision':2})
 def resolve(self,id,role='instructor',revision=3,choice=1):return self.req(role,'/rpc/resolve_ai_practice_review',{'p_review':id,'p_revision':revision,'p_choice':choice,'p_explanation':'Resolved from the approved course reference'})
 def assessment(self,session):
  status,data=self.req('student','/rpc/get_ai_practice_assessment',{'p_session':session});self.assertEqual(status,200);return data
 def test_01_pending_recheck_request_resolution_and_score(self):
  session=self.ready();id=self.begin(session);self.assertEqual(self.assessment(session)['graded'],0)
  self.assertEqual(self.auto(id,session),(200,2));self.assertEqual(self.assessment(session)['pending'],1);self.assertEqual(self.request(id),(200,3));self.assertEqual(self.resolve(id),(200,4))
  result=self.assessment(session);self.assertEqual((result['earned'],result['graded'],result['pending']),(1,1,0))
  self.assertEqual(self.resolve(id),(200,4));self.assertEqual(self.auto(id,session),(200,4))
 def test_02_exam_never_reveals_review_before_submission(self):
  session=self.ready(False,'exam');self.assertEqual(self.req('student','/rpc/begin_ai_practice_review',{'p_session':session,'p_position':1})[0],409)
  self.assertEqual(self.assessment(session)['items'],[])
  self.assertEqual(self.req('student','/rpc/submit_ai_practice_session',{'p_id':session,'p_revision':self.read(session)['revision']})[0],200);self.begin(session)
 def test_03_explicit_sharing_and_no_unscoped_admin_or_browser_worker(self):
  session=self.ready();id=self.begin(session);args={'p_review':id}
  self.assertEqual(self.req('instructor','/rpc/get_ai_practice_review',args)[0],403)
  self.assertEqual(self.request(id)[0],409);self.assertEqual(self.auto(id,session)[0],200);self.assertEqual(self.req('instructor','/rpc/get_ai_practice_review',args)[0],403)
  self.request(id);self.assertEqual(self.req('instructor','/rpc/get_ai_practice_review',args)[0],200)
  for role in ['other','admin','super_admin']:
   self.assertEqual(self.req(role,'/rpc/get_ai_practice_review',args)[0],403);self.assertEqual(self.resolve(id,role)[0],403)
  for role in ['student','instructor','admin','super_admin']:
   self.assertEqual(self.req(role,'/rpc/ai_practice_review_context',{'p_actor':self.users['student']['id'],'p_review':id})[0],403)
   for method,data in [('POST',{'id':id}),('PATCH',{'state':'resolved'}),('DELETE',None)]:self.assertEqual(self.req(role,'/ai_practice_reviews',data,method)[0],403)
 def test_04_current_role_withdrawal_and_queue_scope(self):
  session=self.ready();id=self.begin(session);self.auto(id,session);self.request(id)
  status,rows=self.req('instructor','/rpc/list_ai_practice_reviews',{'p_course':self.course});self.assertEqual(status,200);self.assertEqual(rows[0]['student_id'],self.users['student']['id'])
  instructor=self.users['instructor']['id'];self.stack.sql(f"UPDATE public.users SET role='student' WHERE id='{instructor}'")
  try:self.assertEqual(self.resolve(id)[0],403)
  finally:self.stack.sql(f"UPDATE public.users SET role='instructor' WHERE id='{instructor}'")
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
  for role in ['student','instructor']:self.assertEqual(self.req(role,'/rpc/get_ai_practice_review',{'p_review':id})[0],403)
  self.assertEqual(self.resolve(id)[0],403);self.assertEqual(self.req('instructor','/rpc/list_ai_practice_reviews',{'p_course':self.course}),(200,[]))
 def test_05_conflicting_resolutions_and_exclusion_do_not_become_wrong_answers(self):
  session=self.ready();id=self.begin(session);self.auto(id,session);self.request(id)
  self.assertEqual(self.resolve(id,choice=None),(200,4));self.assertEqual(self.resolve(id,choice=0)[0],409)
  result=self.assessment(session);self.assertEqual((result['graded'],result['earned'],result['excluded']),(0,0,1))
 def test_06_private_schema_and_audit_identity_without_content(self):
  session=self.ready();id=self.begin(session);self.auto(id,session);self.request(id);self.resolve(id)
  self.assertEqual(self.stack.request('rest','/review_details',token=self.users['student']['token'],profile='practice_private')[0],406)
  status,events=self.req('admin',f'/audit_events?entity_id=eq.{id}');self.assertEqual(status,200);self.assertEqual(len(events),1);self.assertEqual(events[0]['actor_id'],self.users['instructor']['id'])
  self.assertNotIn('Resolved from',str(events));self.assertNotIn('correct',str(events))
