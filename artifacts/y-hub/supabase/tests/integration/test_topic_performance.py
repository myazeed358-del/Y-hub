"""Real GoTrue/JWT/PostgREST topic aggregation over real engine publication."""
import unittest
import test_practice_outline as fixtures

class TopicHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.OutlineHTTP.setUpClass.__func__)
 req=fixtures.OutlineHTTP.req
 worker=fixtures.OutlineHTTP.worker
 proposal=fixtures.OutlineHTTP.proposal
 read=fixtures.OutlineHTTP.read
 save=fixtures.OutlineHTTP.save
 computed=fixtures.OutlineHTTP.computed
 create=fixtures.OutlineHTTP.create
 selection=fixtures.OutlineHTTP.selection
 mapping=fixtures.OutlineHTTP.mapping
 def setUp(self):
  fixtures.OutlineHTTP.setUp(self)
  args=self.mapping();args['p_sections'][0]['kind']='topic';self.assertEqual(self.req('instructor','/rpc/set_ai_practice_outline',args),(200,1))
 def topics(self,role='student',kind='topic',offset=0):return self.req(role,'/rpc/read_ai_practice_topic_performance',{'p_course':self.course,'p_kind':kind,'p_offset':offset})
 def solved(self,mode='practice'):
  sid,_=self.create(mode);self.assertEqual(self.worker('publish_ai_practice_math_question',self.computed(sid))[0],204);self.assertEqual(self.save(sid,self.read(sid)['revision'],0,True)[0],200);return sid
 def test_verified_score_and_teacher_topic_are_released_after_answer(self):
  sid,_=self.create();self.assertEqual(self.worker('publish_ai_practice_math_question',self.computed(sid))[0],204)
  self.assertEqual(self.topics()[1]['groups'],[]);self.save(sid,self.read(sid)['revision'],0,True)
  status,data=self.topics();self.assertEqual(status,200);group=data['groups'][0];self.assertEqual(group['summary']['score'],100);self.assertEqual(group['attribution']['sectionId'],self.source)
  self.assertIsNone(self.topics(kind='chapter')[1]['groups'][0]['attribution'])
 def test_self_test_and_pending_review_never_leak_a_grade(self):
  sid=self.solved('exam');self.assertEqual(self.topics()[1]['groups'],[])
  self.assertEqual(self.req('student','/rpc/submit_ai_practice_session',{'p_id':sid,'p_revision':self.read(sid)['revision']})[0],200)
  self.assertEqual(self.topics()[1]['groups'][0]['summary']['exam']['graded'],1)
  self.assertEqual(self.req('student','/rpc/begin_ai_practice_review',{'p_session':sid,'p_position':1})[0],200)
  summary=self.topics()[1]['groups'][0]['summary'];self.assertIsNone(summary['score']);self.assertEqual(summary['exam']['pending'],1)
 def test_current_roles_and_anonymous_never_read_another_students_results(self):
  self.solved()
  for role in ['other','admin','super_admin',None]:self.assertIn(self.topics(role)[0],[401,403])
  self.assertEqual(self.topics('instructor')[1]['groups'],[])
  self.assertEqual(self.req('student','/rpc/read_ai_practice_topic_performance',{'p_course':self.course,'p_kind':'topic','p_actor':self.users['instructor']['id']})[0],404)
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
  self.assertEqual(self.topics()[0],403)
 def test_invalid_pages_and_dimensions_are_rejected_over_http(self):
  for kind,offset in [('unit',0),('topic',-1),('chapter',10001)]:self.assertEqual(self.topics(kind=kind,offset=offset)[0],400)
  self.solved();self.assertEqual(self.topics(offset=20)[1]['groups'],[]);self.assertEqual(self.topics(offset=20)[1]['groupCount'],1)
 def test_same_token_sees_new_weights_and_no_invalidated_scope(self):
  self.solved();self.assertEqual(self.topics()[1]['groups'][0]['summary']['coverage'],50)
  self.assertEqual(self.req('instructor','/rpc/set_ai_practice_performance_weights',{'p_course':self.course,'p_revision':0,'p_practice':30,'p_exam':70})[0],200)
  self.assertEqual(self.topics()[1]['groups'][0]['summary']['coverage'],30)
  args=self.mapping('Changed',1);args['p_sections'][0]['kind']='topic';self.assertEqual(self.req('instructor','/rpc/set_ai_practice_outline',args),(200,2))
  self.assertEqual(self.topics()[1]['groups'],[])
