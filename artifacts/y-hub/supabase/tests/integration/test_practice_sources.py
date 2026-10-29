"""Real isolated Auth JWT/PostgREST requests for practice source scope."""
import json, unittest, uuid
from pathlib import Path
from runtime import Stack

class PracticeSourcesHTTP(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.stack=Stack(Path.cwd());cls.addClassCleanup(cls.stack.close);cls.stack.start();cls.users={}
  for role in ['student','instructor','admin','super_admin','other']:
   status,data=cls.stack.request('auth','/signup',{'email':role+'@practice.invalid','password':'Local-test-only-123!','data':{'full_name_ar':'مستخدم تجريبي','full_name_en':'Local Test'}})
   assert status==200,data
   cls.users[role]={'id':data['user']['id'],'token':data['access_token']}
   if role in ['instructor','admin','super_admin']:cls.stack.sql(f"UPDATE public.users SET role='{role}' WHERE id='{data['user']['id']}'")
 def setUp(self):
  self.course=str(uuid.uuid4());self.material=str(uuid.uuid4())
  self.stack.sql(f"INSERT INTO public.courses(id,instructor_id,title,is_published) VALUES('{self.course}','{self.users['instructor']['id']}','Section',true);INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{self.material}','{self.course}','Approved book','pdf','https://local.invalid/book.pdf');INSERT INTO public.course_enrollments(course_id,student_id,status) VALUES('{self.course}','{self.users['student']['id']}','active')")
  self.source=self.stack.sql(f"SELECT id FROM public.ai_tutor_sources WHERE material_id='{self.material}'");self.revision=self.stack.sql(f"SELECT revision FROM public.ai_tutor_sources WHERE id='{self.source}'")
  chunks=json.dumps([{'text':'مشتقة الدالة derivative','page':2},{'text':'Vector space','page':4}]).replace("'","''")
  self.stack.sql(f"SET ROLE service_role;SELECT public.publish_ai_tutor_source('{self.users['instructor']['id']}','{self.source}','{self.revision}','{chunks}');RESET ROLE")
 def req(self,role,path,data=None,method=None):return self.stack.request('rest',path,data,self.users[role]['token'] if role else None,method)
 def selection(self):return {'p_course':self.course,'p_selection':[{'sourceId':self.source,'revision':self.revision,'pages':[2]}]}
 def assignment(self,role='primary',rev=0):return {'p_source':self.source,'p_source_revision':self.revision,'p_expected_revision':rev,'p_role':role,'p_expected_primary':None}
 def test_01_primary_catalog_multiple_scope_and_verified_arabic_evidence(self):
  self.assertEqual(self.req('instructor','/rpc/set_ai_practice_reference',self.assignment()),(200,1))
  status,catalog=self.req('student','/rpc/get_ai_practice_sources',{'p_course':self.course});self.assertEqual(status,200);self.assertEqual(catalog['primaryId'],self.source)
  self.assertFalse(catalog['canManage']);self.assertEqual(next(s for s in catalog['sources'] if s['id']==self.source)['pages'],[2,4])
  status,preview=self.req('student','/rpc/preview_ai_practice_sources',{**self.selection(),'p_query':'المشتقة derivative'});self.assertEqual(status,200)
  self.assertEqual(preview['evidence'][0]['page'],2);self.assertEqual(preview['evidence'][0]['title'],'Approved book');self.assertEqual(preview['evidence'][0]['revision'],self.revision)
 def test_02_withdrawal_foreign_roles_and_anonymous_are_denied(self):
  for role in ['other','admin','super_admin',None]:
   self.assertIn(self.req(role,'/rpc/preview_ai_practice_sources',self.selection())[0],[401,403])
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
  self.assertEqual(self.req('student','/rpc/get_ai_practice_sources',{'p_course':self.course})[0],403)
  self.assertEqual(self.req('student','/rpc/preview_ai_practice_sources',self.selection())[0],403)
 def test_03_invalid_pages_forged_evidence_and_changed_revision_fail_closed(self):
  for patch in [{'pages':[3]},{'text':'Forged source'},{'sourceId':str(uuid.uuid4())}]:
   args=self.selection();args['p_selection'][0].update(patch)
   self.assertIn(self.req('student','/rpc/preview_ai_practice_sources',args)[0],[400,403])
  self.stack.sql(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid(),status='pending' WHERE id='{self.source}'")
  status,error=self.req('student','/rpc/preview_ai_practice_sources',self.selection());self.assertEqual(status,409);self.assertEqual(error['code'],'PT409')
 def test_04_idempotent_retry_no_duplicate_audit_and_terminal_conflict(self):
  args=self.assignment();self.assertEqual(self.req('instructor','/rpc/set_ai_practice_reference',args),(200,1));self.assertEqual(self.req('instructor','/rpc/set_ai_practice_reference',args),(200,1))
  self.assertEqual(self.stack.sql(f"SELECT count(*) FROM public.audit_events WHERE entity_type='ai_practice_references' AND entity_id='{self.source}'"),'1')
  self.assertEqual(self.req('instructor','/rpc/set_ai_practice_reference',self.assignment('lecture'))[0],409)
  self.assertEqual(self.req('instructor','/rpc/set_ai_practice_reference',self.assignment('lecture',1)),(200,2))
 def test_05_no_forged_classification_or_direct_mutations_and_demotion_rechecked(self):
  for role in ['student','admin','super_admin','other']:
   self.assertEqual(self.req(role,'/rpc/set_ai_practice_reference',self.assignment())[0],403)
  for role in ['student','instructor','admin','super_admin']:
   for method,body in [('POST',{'id':self.source,'course_id':self.course,'role':'primary'}),('PATCH',{'role':'primary'}),('DELETE',None)]:
    self.assertEqual(self.req(role,'/ai_practice_references',body,method)[0],403)
  actor=self.users['instructor']['id'];self.stack.sql(f"UPDATE public.users SET role='student' WHERE id='{actor}'")
  try:self.assertEqual(self.req('instructor','/rpc/set_ai_practice_reference',self.assignment())[0],403)
  finally:self.stack.sql(f"UPDATE public.users SET role='instructor' WHERE id='{actor}'")
