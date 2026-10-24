"""Isolated native GoTrue JWT + PostgREST integration, never a hosted database."""
import unittest,uuid,json
from pathlib import Path
from runtime import Stack
class TutorHTTP(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.stack=Stack(Path.cwd());cls.addClassCleanup(cls.stack.close);cls.stack.start();cls.users={}
  for role in ['student','instructor','admin','super_admin','other']:
   status,data=cls.stack.request('auth','/signup',{'email':role+'@tutor.invalid','password':'Local-test-only-123!','data':{'full_name':role}})
   assert status==200,data
   cls.users[role]={'id':data['user']['id'],'token':data['access_token']}
   if role in ['instructor','admin','super_admin']:cls.stack.sql(f"UPDATE public.users SET role='{role}' WHERE id='{data['user']['id']}'")
 def setUp(self):
  self.stack.sql('DELETE FROM tutor_private.leases; DELETE FROM public.ai_tutor_hourly_usage; DELETE FROM public.ai_tutor_daily_usage;')
  self.course=str(uuid.uuid4());self.material=str(uuid.uuid4());owner=self.users['instructor']['id'];student=self.users['student']['id']
  self.stack.sql(f"INSERT INTO public.courses(id,instructor_id,title,is_published) VALUES('{self.course}','{owner}','Same name',true); INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{self.material}','{self.course}','Lecture','pdf','https://local.invalid/book.pdf'); INSERT INTO public.course_enrollments(course_id,student_id,status) VALUES('{self.course}','{student}','active')")
  self.source=self.stack.sql(f"SELECT id FROM public.ai_tutor_sources WHERE material_id='{self.material}'");self.revision=self.stack.sql(f"SELECT revision FROM public.ai_tutor_sources WHERE id='{self.source}'")
  self.publish()
 def publish(self,chunks=None,source=None,revision=None,actor=None):
  chunks=chunks if chunks is not None else [{'text':'Vectors form a vector space. متجهات فضاء','page':2}]
  payload=json.dumps(chunks).replace("'","''")
  return self.stack.sql(f"SET ROLE service_role;SELECT public.publish_ai_tutor_source('{actor or self.users['instructor']['id']}','{source or self.source}','{revision or self.revision}','{payload}'::jsonb,NULL,NULL);RESET ROLE")
 def req(self,role,path,data=None,method=None):return self.stack.request('rest',path,data,self.users[role]['token'],method)
 def search(self,role='student',course=None):return self.req(role,'/rpc/search_ai_tutor',{'p_course':course or self.course,'p_query':'vector'})
 def test_01_real_jwt_retrieves_only_enrolled_section(self):
  status,rows=self.search();self.assertEqual(status,200);self.assertEqual(len(rows),1);self.assertEqual(rows[0]['page'],2);self.assertEqual(rows[0]['title'],'Lecture')
  for role in ['other','admin','super_admin']:self.assertEqual(self.search(role),(200,[]))
  self.assertEqual(len(self.search('instructor')[1]),1)
 def test_02_no_mixing_same_named_sections(self):
  other=str(uuid.uuid4());self.stack.sql(f"INSERT INTO public.courses(id,instructor_id,title,is_published) VALUES('{other}','{self.users['instructor']['id']}','Same name',true)")
  self.assertEqual(self.search('student',other),(200,[]))
 def test_03_revocation_hides_chunks_and_sources_immediately(self):
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
  self.assertEqual(self.search(),(200,[]));self.assertEqual(self.req('student',f"/ai_tutor_sources?course_id=eq.{self.course}"),(200,[]))
 def test_04_demoted_instructor_cannot_read_or_publish(self):
  actor=self.users['instructor']['id'];self.stack.sql(f"UPDATE public.users SET role='student' WHERE id='{actor}'")
  try:
   self.assertEqual(self.search('instructor'),(200,[]))
   with self.assertRaises(RuntimeError):self.publish()
  finally:self.stack.sql(f"UPDATE public.users SET role='instructor' WHERE id='{actor}'")
 def test_05_browser_cannot_forge_index_or_quota_identity(self):
  for role in ['student','instructor','admin','super_admin']:
   self.assertEqual(self.req(role,'/rpc/publish_ai_tutor_source',{'p_actor':self.users['instructor']['id'],'p_source':self.source,'p_revision':self.revision,'p_chunks':[]})[0],403)
   self.assertEqual(self.req(role,'/rpc/begin_ai_tutor_request',{'p_actor':self.users['instructor']['id'],'p_course':self.course})[0],403)
   for method,payload in [('POST',{'source_id':self.source,'revision':self.revision,'ordinal':3,'text':'forged'}),('PATCH',{'text':'forged'}),('DELETE',None)]:
    self.assertEqual(self.req(role,'/ai_tutor_chunks',payload,method)[0],403)
 def test_06_material_update_and_delete_invalidate_index(self):
  self.stack.sql(f"UPDATE public.course_materials SET url='https://local.invalid/replaced.pdf' WHERE id='{self.material}'")
  self.assertEqual(self.search(),(200,[]))
  with self.assertRaises(RuntimeError):self.publish()
  self.stack.sql(f"DELETE FROM public.course_materials WHERE id='{self.material}'")
  self.assertEqual(self.stack.sql(f"SELECT count(*) FROM public.ai_tutor_sources WHERE material_id='{self.material}'"),'0')
 def test_07_storage_replacement_invalidates_old_generation(self):
  self.stack.sql("INSERT INTO storage.objects(bucket_id,name) VALUES('materials','book.pdf')")
  self.assertEqual(self.search(),(200,[]))
  with self.assertRaises(RuntimeError):self.publish()
 def test_08_syllabus_metadata_preserves_unit_and_invalidates_changes(self):
  unit=str(uuid.uuid4());self.stack.sql(f"INSERT INTO public.syllabus_units(id,course_id,title) VALUES('{unit}','{self.course}','Vectors')")
  source=self.stack.sql(f"SELECT id FROM public.ai_tutor_sources WHERE course_id='{self.course}' AND kind='syllabus'");revision=self.stack.sql(f"SELECT revision FROM public.ai_tutor_sources WHERE id='{source}'")
  self.publish([{'text':'vector unit','unitId':unit}],source,revision)
  self.assertTrue(any(r['unit_id']==unit for r in self.search()[1]));self.stack.sql(f"UPDATE public.syllabus_units SET title='Changed' WHERE id='{unit}'")
  self.assertFalse(any(r['source_id']==source for r in self.search()[1]))
 def test_09_unreadable_pdf_is_explicit_and_old_chunks_removed(self):
  self.publish([]);self.assertEqual(self.search(),(200,[]));self.assertEqual(self.stack.sql(f"SELECT status FROM public.ai_tutor_sources WHERE id='{self.source}'"),'unreadable')
 def test_10_failed_publication_rolls_back_previous_index(self):
  with self.assertRaises(RuntimeError):self.publish([{'text':'ok'},{'text':''}])
  self.assertEqual(self.search()[1][0]['text'],'Vectors form a vector space. متجهات فضاء')
 def test_11_quota_and_concurrency_enforced_on_server(self):
  actor=self.users['student']['id'];sql=f"SELECT public.begin_ai_tutor_request('{actor}','{self.course}',false)"
  token=self.stack.sql(sql)
  with self.assertRaises(RuntimeError):self.stack.sql(sql)
  self.stack.sql(f"SELECT public.end_ai_tutor_request('{actor}','{token}')")
  for _ in range(9):
   token=self.stack.sql(sql);self.stack.sql(f"SELECT public.end_ai_tutor_request('{actor}','{token}')")
  with self.assertRaises(RuntimeError):self.stack.sql(sql)
  self.stack.sql('DELETE FROM public.ai_tutor_hourly_usage;UPDATE public.ai_tutor_daily_usage SET request_count=100')
  with self.assertRaises(RuntimeError):self.stack.sql(sql)
 def test_12_semantic_retrieval_and_model_isolation(self):
  payload=json.dumps([{'text':'unrelated lexical words','embedding':[1,0,0]}])
  self.stack.sql(f"SELECT public.publish_ai_tutor_source('{self.users['instructor']['id']}','{self.source}','{self.revision}','{payload}','local-vector-model',NULL)")
  args={'p_course':self.course,'p_query':'matrix','p_embedding':[1,0,0],'p_model':'local-vector-model'}
  status,rows=self.req('student','/rpc/search_ai_tutor',args);self.assertEqual(status,200);self.assertEqual(len(rows),1)
  args['p_model']='different-model';self.assertEqual(self.req('student','/rpc/search_ai_tutor',args),(200,[]))
 def test_13_no_exam_or_student_file_source_type(self):
  with self.assertRaises(RuntimeError):self.stack.sql(f"INSERT INTO public.ai_tutor_sources(course_id,kind,title) VALUES('{self.course}','exam','Secret')")
  self.assertEqual(self.stack.request('rest','/ai_tutor_chunks')[0],401)

 def test_14_global_concurrency_has_four_slots(self):
  for role in ['student','instructor','other','admin']:
   actor=self.users[role]['id'];course=self.course
   if role=='other':self.stack.sql(f"INSERT INTO public.course_enrollments(course_id,student_id,status) VALUES('{course}','{actor}','active')")
   if role=='admin':
    course=str(uuid.uuid4());self.stack.sql(f"INSERT INTO public.courses(id,instructor_id,title,is_published) VALUES('{course}','{actor}','Admin section',true)")
   self.stack.sql(f"SELECT public.begin_ai_tutor_request('{actor}','{course}',false)")
  actor=self.users['super_admin']['id'];course=str(uuid.uuid4());self.stack.sql(f"INSERT INTO public.courses(id,instructor_id,title,is_published) VALUES('{course}','{actor}','Owner section',true)")
  with self.assertRaises(RuntimeError):self.stack.sql(f"SELECT public.begin_ai_tutor_request('{actor}','{course}',false)")
 def test_15_expired_jwt_is_rejected_by_real_postgrest(self):
  import base64,hmac,hashlib,time
  def enc(value):return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b'=').decode()
  header=enc({'alg':'HS256','typ':'JWT'});body=enc({'sub':self.users['student']['id'],'role':'authenticated','aud':'authenticated','exp':int(time.time())-120})
  signature=base64.urlsafe_b64encode(hmac.new(self.stack.secret.encode(),(header+'.'+body).encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
  status,_=self.stack.request('rest','/rpc/search_ai_tutor',{'p_course':self.course,'p_query':'vector'},header+'.'+body+'.'+signature)
  self.assertEqual(status,401)
 def test_16_simultaneous_requests_get_one_actor_lease(self):
  from concurrent.futures import ThreadPoolExecutor
  actor=self.users['student']['id'];sql=f"SELECT public.begin_ai_tutor_request('{actor}','{self.course}',false)"
  def attempt():
   try:self.stack.sql(sql);return True
   except RuntimeError:return False
  with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:attempt(),range(2)))
  self.assertEqual(results.count(True),1);self.assertEqual(self.stack.sql(f"SELECT request_count FROM public.ai_tutor_hourly_usage WHERE user_id='{actor}'"),'1')

 def test_17_storage_updates_preserve_unrelated_ready_indexes(self):
  self.stack.sql(f"UPDATE public.ai_tutor_sources SET object_path='book.pdf' WHERE id='{self.source}'")
  self.stack.sql("INSERT INTO storage.objects(bucket_id,name) VALUES('materials','unrelated.pdf')")
  self.assertEqual(len(self.search()[1]),1)
  self.stack.sql("INSERT INTO storage.objects(bucket_id,name) VALUES('materials','book.pdf')")
  self.assertEqual(self.search(),(200,[]))

 def test_18_null_revision_cannot_bypass_index_compare_and_swap(self):
  with self.assertRaises(RuntimeError):self.stack.sql(f"SELECT public.publish_ai_tutor_source('{self.users['instructor']['id']}','{self.source}',NULL,'[]')")
  self.assertEqual(len(self.search()[1]),1)
