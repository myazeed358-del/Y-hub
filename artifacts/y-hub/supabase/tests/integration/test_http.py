"""Real GoTrue-issued JWTs through PostgREST and database RLS, never production."""
import base64,hashlib,hmac,json,time,unittest,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from runtime import Stack

def uid():return str(uuid.uuid4())
class SupabaseHTTP(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.stack=Stack(Path.cwd());cls.addClassCleanup(cls.stack.close);cls.stack.start();cls.accounts={}
  for name,role in [('student','student'),('student2','student'),('instructor','instructor'),('other','instructor'),('admin','admin'),('super','super_admin')]:
   email=f'{name}@phase3.example.com';password='Local-fixture-only-123!'
   status,data=cls.stack.request('auth','/signup',{'email':email,'password':password,'data':{'full_name_ar':'مستخدم تجريبي','full_name_en':'Local Test','full_name':'Local '+name,'major':'mathematics','role':'super_admin'}})
   if status!=200 or not data.get('access_token'):raise AssertionError('Real signup failed: '+str(status))
   user=data['user']['id'];cls.accounts[name]={'id':user,'token':data['access_token'],'email':email,'password':password}
   # Provision synthetic test roles only via the disposable database, never from metadata.
   if role!='student':cls.stack.sql(f"UPDATE public.users SET role='{role}' WHERE id='{user}'")
 def request(self,actor,path,data=None,method=None):
  return self.stack.request('rest',path,data,self.accounts[actor]['token'] if actor else None,method)
 def ok(self,actor,path,data=None,method=None):
  status,body=self.request(actor,path,data,method)
  self.assertLess(status,300,f'{path}: HTTP {status}, {body}')
  return body
 def denied(self,actor,path,data=None,method=None):
  status,_=self.request(actor,path,data,method);self.assertIn(status,[400,401,403,404,409])
 def conflict(self,actor,path,data):
  start=time.monotonic();status,body=self.request(actor,path,data)
  self.assertEqual(status,409);self.assertEqual(body['code'],'PT409')
  self.assertLess(time.monotonic()-start,10,'Permanent application conflicts must not loop in transaction retries')
 def section(self,major='mathematics'):
  d,c=uid(),uid()
  self.ok('admin','/rpc/create_course_definition',{'p_id':d,'p_title':'Local definition','p_code':'M1','p_description':'','p_department':'Science','p_major':major})
  payload={'p_id':c,'p_definition':d,'p_instructor':self.accounts['instructor']['id'],'p_label':'01','p_term':'2026-Fall'}
  self.ok('admin','/rpc/create_academic_section',payload)
  self.ok('instructor',f'/courses?id=eq.{c}',{'is_published':True,'enrollment_open':True},'PATCH')
  return d,c
 def enroll(self,c,actor='student'):
  self.ok(actor,'/course_enrollments',{'course_id':c,'student_id':self.accounts[actor]['id']})
 def exam(self):
  _,c=self.section();self.enroll(c);e,q=uid(),uid()
  self.ok('instructor','/exams',{'id':e,'course_id':c,'title':'Local exam','is_published':True,'time_limit_minutes':30})
  self.ok('instructor','/questions',{'id':q,'exam_id':e,'course_id':c,'type':'math','content':'Original','correct_answer':'42','points':3})
  return c,e,q
 def test_01_real_signup_jwt_profile_and_untrusted_metadata(self):
  rows=self.ok('student','/users?select=id,role')
  self.assertEqual(rows,[{'id':self.accounts['student']['id'],'role':'student'}])
  self.denied('student',f"/users?id=eq.{self.accounts['student']['id']}",{'role':'super_admin'},'PATCH')
 def test_02_invalid_signature_and_expired_tokens_are_rejected_by_postgrest(self):
  original=self.accounts['student']['token'];parts=original.split('.')
  payload=json.loads(base64.urlsafe_b64decode(parts[1]+'='*(-len(parts[1])%4)))
  payload['sub']=self.accounts['admin']['id']
  encoded=base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
  status,_=self.stack.request('rest','/users',token=parts[0]+'.'+encoded+'.'+parts[2]);self.assertEqual(status,401)
  payload['exp']=int(time.time())-120
  body=parts[0]+'.'+base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
  signature=base64.urlsafe_b64encode(hmac.new(self.stack.secret.encode(),body.encode(),hashlib.sha256).digest()).decode().rstrip('=')
  status,_=self.stack.request('rest','/users',token=body+'.'+signature);self.assertEqual(status,401)
 def test_03_real_password_signin_refresh_and_logout(self):
  account=self.accounts['student2']
  status,data=self.stack.request('auth','/token?grant_type=password',{'email':account['email'],'password':account['password']})
  self.assertEqual(status,200);old=data['refresh_token']
  status,data=self.stack.request('auth','/token?grant_type=refresh_token',{'refresh_token':old});self.assertEqual(status,200)
  status,_=self.stack.request('auth','/logout',{},data['access_token']);self.assertIn(status,[200,204])
  status,_=self.stack.request('auth','/token?grant_type=refresh_token',{'refresh_token':data['refresh_token']});self.assertGreaterEqual(status,400)
 def test_04_catalog_section_permissions_and_idempotent_creation(self):
  d,c=self.section()
  for actor in ['student','instructor']:
   self.denied(actor,'/rpc/create_course_definition',{'p_id':uid(),'p_title':'Denied','p_code':'','p_description':'','p_department':'','p_major':''})
  self.assertEqual(self.ok('other',f'/course_sections?id=eq.{c}'),[])
  payload={'p_id':c,'p_definition':d,'p_instructor':self.accounts['instructor']['id'],'p_label':'01','p_term':'2026-Fall'}
  self.assertEqual(self.ok('admin','/rpc/create_academic_section',payload),c)
  self.assertEqual(len(self.ok('admin',f'/courses?id=eq.{c}')),1)
  self.conflict('admin','/rpc/create_academic_section',{**payload,'p_label':'Different'})
  self.conflict('admin','/rpc/create_course_definition',{'p_id':d,'p_title':'Different','p_code':'M1','p_description':'','p_department':'Science','p_major':'mathematics'})
 def test_05_major_and_enrollment_visibility_are_database_enforced(self):
  _,c=self.section('medicine')
  self.assertEqual(self.ok('student',f'/courses?id=eq.{c}'),[])
  self.denied('student','/course_enrollments',{'course_id':c,'student_id':self.accounts['student']['id']})
 def test_06_syllabus_roundtrip_conflicts_roster_and_scope(self):
  _,c=self.section();self.enroll(c)
  u={'id':uid(),'title':'Unit','sections':[{'id':uid(),'title':'Topic'}]}
  payload={'p_course_id':c,'p_expected_revision':0,'p_units':[u]}
  revision=self.ok('instructor','/rpc/save_course_syllabus',payload);self.assertGreater(revision,0)
  self.assertEqual(self.ok('student','/rpc/read_course_syllabus',{'p_course_id':c})['units'],[u])
  self.assertIsNone(self.ok('student2','/rpc/read_course_syllabus',{'p_course_id':c}))
  self.denied('student','/rpc/save_course_syllabus',payload)
  self.conflict('instructor','/rpc/save_course_syllabus',payload)
  roster=self.ok('admin','/rpc/get_managed_course_enrollment_roster_v2',{'p_course_id':c})
  self.assertEqual(roster[0]['full_name'],'مستخدم تجريبي')
  self.denied('other','/rpc/get_managed_course_enrollment_roster_v2',{'p_course_id':c})
 def test_07_exam_snapshot_timer_and_concurrent_exactly_once_result(self):
  c,e,q=self.exam();payload={'p_exam_id':e}
  attempt=self.ok('student','/rpc/start_exam_attempt',payload)
  self.ok('instructor',f'/questions?id=eq.{q}',{'content':'Changed','correct_answer':'99','points':9},'PATCH')
  questions=self.ok('student','/rpc/get_exam_questions',payload)
  self.assertEqual(questions[0]['content'],'Original');self.assertNotIn('correct_answer',questions[0])
  self.assertEqual(self.ok('student','/rpc/start_exam_attempt',payload)['deadline_at'],attempt['deadline_at'])
  account=self.accounts['student']
  status,second=self.stack.request('auth','/token?grant_type=password',{'email':account['email'],'password':account['password']})
  self.assertEqual(status,200)
  status,resumed=self.stack.request('rest','/rpc/start_exam_attempt',payload,second['access_token'])
  self.assertEqual(status,200);self.assertEqual(resumed['deadline_at'],attempt['deadline_at'])
  def submit(index):
   token=second['access_token'] if index else account['token']
   status,result=self.stack.request('rest','/rpc/submit_exam',{'p_exam_id':e,'p_answers':{q:'42'}},token)
   self.assertEqual(status,200);return result
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(submit,range(2)))
  self.assertEqual(results[0]['result'],results[1]['result']);self.assertEqual(results[0]['result']['score'],3)
  self.assertEqual(self.ok('student2',f'/student_results?exam_id=eq.{e}'),[])
 def test_08_unpublished_parent_and_revoked_enrollment_deny_rpc(self):
  c,e,q=self.exam()
  self.ok('instructor',f'/courses?id=eq.{c}',{'is_published':False},'PATCH')
  self.denied('student','/rpc/start_exam_attempt',{'p_exam_id':e})
  self.ok('instructor',f'/courses?id=eq.{c}',{'is_published':True},'PATCH')
  self.ok('student','/rpc/start_exam_attempt',{'p_exam_id':e})
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  self.denied('student','/rpc/submit_exam',{'p_exam_id':e,'p_answers':{q:'42'}})
 def test_09_assignment_preserves_identity_and_removes_old_owner_access(self):
  _,c=self.section()
  payload={'p_section':c,'p_expected_instructor':self.accounts['instructor']['id'],'p_instructor':self.accounts['other']['id']}
  self.denied('instructor','/rpc/assign_academic_section',payload)
  self.assertEqual(self.ok('admin','/rpc/assign_academic_section',payload),c)
  self.assertEqual(self.ok('instructor',f'/courses?id=eq.{c}'),[])
  self.assertEqual(self.ok('other',f'/courses?id=eq.{c}')[0]['id'],c)
  self.conflict('admin','/rpc/assign_academic_section',payload)
 def test_10_existing_jwt_loses_staff_privileges_after_demotion(self):
  c,e,q=self.exam();owner=self.accounts['instructor']['id']
  try:
   self.ok('admin','/rpc/admin_set_user_role',{'p_user_id':owner,'p_new_role':'student'})
   self.enroll(c,'instructor')
   self.assertEqual(self.ok('instructor',f'/questions?id=eq.{q}'),[])
   self.assertEqual(self.ok('instructor',f"/course_enrollments?course_id=eq.{c}&student_id=eq.{self.accounts['student']['id']}"),[])
   self.denied('instructor','/rpc/save_course_syllabus',{'p_course_id':c,'p_expected_revision':0,'p_units':[]})
  finally:self.ok('admin','/rpc/admin_set_user_role',{'p_user_id':owner,'p_new_role':'instructor'})
 def test_11_y_sheets_receipt_cas_and_cross_account_isolation(self):
  w,sheet,request=uid(),uid(),uid()
  content={'id':w,'name':'Local workbook','activeSheetId':sheet,'sheets':[{'id':sheet,'name':'Sheet 1','cells':{}}]}
  payload={'p_id':w,'p_request_id':request,'p_expected_revision':0,'p_content':content,'p_expected_owner_id':self.accounts['student']['id']}
  revision=self.ok('student','/rpc/save_y_sheets_workbook',payload)
  self.assertEqual(self.ok('student','/rpc/save_y_sheets_workbook',payload),revision)
  self.assertEqual(self.ok('student2',f'/y_sheets_workbooks?id=eq.{w}'),[])
  self.denied('student2','/rpc/save_y_sheets_workbook',payload)
  self.conflict('student','/rpc/save_y_sheets_workbook',{**payload,'p_request_id':uid()})
  self.conflict('student','/rpc/delete_y_sheets_workbook',{'p_id':w,'p_expected_revision':0})
  self.assertEqual(self.ok('student',f'/y_sheets_workbooks?id=eq.{w}')[0]['revision'],revision)
  self.assertEqual(self.ok('student','/rpc/delete_y_sheets_workbook',{'p_id':w,'p_expected_revision':revision}),w)
  self.conflict('student','/rpc/save_y_sheets_workbook',payload)
  self.assertEqual(self.ok('student',f'/y_sheets_workbooks?id=eq.{w}'),[])
 def test_12_audit_visibility_and_append_only(self):
  _,c=self.section()
  self.assertEqual(self.ok('instructor','/audit_events?limit=1'),[])
  events=self.ok('admin',f'/audit_events?entity_id=eq.{c}')
  self.assertTrue(events);self.assertTrue(all(e['actor_role']=='instructor' for e in events))
  elevated=self.ok('super',f'/audit_events?entity_id=eq.{c}')
  self.assertTrue(any(e['actor_role']=='admin' for e in elevated))
  for actor in ['student','instructor','admin','super']:
   self.denied(actor,'/audit_events',{'id':uid()})
   self.denied(actor,f"/audit_events?id=eq.{elevated[0]['id']}",{'actor_role':'student'},'PATCH')
   self.denied(actor,f"/audit_events?id=eq.{elevated[0]['id']}",method='DELETE')
 def test_13_required_audit_failure_rolls_back_rpc(self):
  d,c=self.section();target=uid()
  try:
   self.stack.sql("CREATE FUNCTION public.http_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'local audit failure'; END $$; CREATE TRIGGER http_test_fail_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.http_test_fail_audit()")
   status,_=self.request('admin','/rpc/create_academic_section',{'p_id':target,'p_definition':d,'p_instructor':self.accounts['instructor']['id'],'p_label':'02','p_term':'Fall'})
   self.assertGreaterEqual(status,400)
   self.assertEqual(self.stack.sql(f"SELECT count(*) FROM public.courses WHERE id='{target}'"),'0')
  finally:self.stack.sql('DROP TRIGGER http_test_fail_audit ON public.audit_events; DROP FUNCTION public.http_test_fail_audit()')
 def test_14_anonymous_and_role_escalation_attempts_are_denied(self):
  self.denied(None,'/rpc/list_assignable_instructors',{})
  for actor in ['student','instructor','admin']:
   self.denied(actor,'/rpc/admin_set_user_role',{'p_user_id':self.accounts['student2']['id'],'p_new_role':'super_admin'})
 def lecture(self,online=False):
  from datetime import datetime,timedelta,timezone
  _,c=self.section();self.enroll(c)
  now=datetime.now(timezone.utc)
  l=self.ok('instructor','/rpc/'+('schedule_online_lecture' if online else 'schedule_academic_lecture'),{'p_course':c,'p_title':'Local lecture','p_start':now.isoformat(),'p_end':(now+timedelta(hours=1)).isoformat()})
  return c,l
 def qr(self,s):
  from datetime import datetime,timezone
  qr=self.ok('instructor','/rpc/attendance_qr',{'p_session':s})
  remaining=(datetime.fromisoformat(qr['expiresAt'])-datetime.now(timezone.utc)).total_seconds()
  if remaining<1.5:
   time.sleep(max(0,remaining)+.05);qr=self.ok('instructor','/rpc/attendance_qr',{'p_session':s})
  return qr
 def test_15_exceptional_engine_access_uses_current_profile_and_audited_enrollment(self):
  from datetime import datetime,timedelta,timezone
  _,c=self.section();self.enroll(c);u=self.accounts['student']['id']
  try:
   self.stack.sql(f"UPDATE public.users SET major='medicine' WHERE id='{u}'")
   self.assertFalse(self.ok('student','/rpc/can_use_module',{'p_module':'linear-algebra'}))
   payload={'p_course':c,'p_student':u,'p_engine':'linear-algebra','p_expires':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()}
   self.denied('other','/rpc/grant_engine_access',payload)
   grant=self.ok('instructor','/rpc/grant_engine_access',payload)
   self.assertTrue(self.ok('student','/rpc/authorize_engine_compute',{'p_protocol':'phase','p_scope':'10'}))
   self.assertEqual(self.ok('admin',f'/audit_events?entity_id=eq.{grant}')[0]['actor_role'],'instructor')
   self.denied('student','/engine_grants',{'course_id':c,'student_id':u,'engine_id':'linear-algebra'})
   # Existing platform intentionally has no instructor enrollment-update policy.
   self.assertEqual(self.ok('instructor',f'/course_enrollments?course_id=eq.{c}&student_id=eq.{u}',{'status':'dropped'},'PATCH'),[])
   self.assertTrue(self.ok('student','/rpc/can_use_module',{'p_module':'linear-algebra'}))
   # Simulate an authorized registrar transition ONLY in the isolated fixture DB.
   self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}' AND student_id='{u}'")
   self.assertFalse(self.ok('student','/rpc/can_use_module',{'p_module':'linear-algebra'}))
  finally:self.stack.sql(f"UPDATE public.users SET major='mathematics' WHERE id='{u}'")
 def test_16_quick_access_cross_device_conflict_isolation_and_application_options(self):
  current=self.ok('student','/rpc/read_quick_access',{})
  ids={o['moduleId'] for o in current['available']};self.assertTrue({'y-sheets','y-attendance','online-lectures'}<=ids)
  payload={'p_revision':current['revision'],'p_paths':[]};account=self.accounts['student']
  status,session=self.stack.request('auth','/token?grant_type=password',{'email':account['email'],'password':account['password']});self.assertEqual(status,200)
  with ThreadPoolExecutor(2) as pool:
   results=list(pool.map(lambda t:self.stack.request('rest','/rpc/save_quick_access',payload,t),[account['token'],session['access_token']]))
  self.assertEqual(sorted(r[0] for r in results),[200,409])
  self.assertEqual(self.ok('student','/rpc/read_quick_access',{})['paths'],[])
  for actor in ['student2','admin','super']:
   self.assertEqual(self.ok(actor,f"/student_quick_access?id=eq.{account['id']}"),[])
  self.denied('admin','/rpc/save_quick_access',{'p_revision':0,'p_paths':[]})
  self.denied('student','/student_quick_access',{'id':account['id'],'paths':[]})
 def test_17_native_jwt_attendance_duplicate_expiry_and_foreign_student(self):
  from datetime import datetime,timezone
  c,l=self.lecture();s=self.ok('instructor','/rpc/open_attendance',{'p_lecture':l});qr=self.qr(s)
  self.denied('student2','/rpc/check_in_attendance',{'p_token':qr['token']})
  account=self.accounts['student'];status,session=self.stack.request('auth','/token?grant_type=password',{'email':account['email'],'password':account['password']});self.assertEqual(status,200)
  with ThreadPoolExecutor(2) as pool:
   results=list(pool.map(lambda t:self.stack.request('rest','/rpc/check_in_attendance',{'p_token':qr['token']},t),[account['token'],session['access_token']]))
  self.assertEqual([r[0] for r in results],[200,200]);self.assertEqual(results[0][1],results[1][1])
  self.assertEqual(len(self.ok('student',f'/attendance_records?session_id=eq.{s}')),1)
  self.assertEqual(self.ok('student2',f'/attendance_records?session_id=eq.{s}'),[])
  remaining=(datetime.fromisoformat(qr['expiresAt'])-datetime.now(timezone.utc)).total_seconds();time.sleep(max(0,remaining)+.05)
  self.denied('student','/rpc/check_in_attendance',{'p_token':qr['token']})
  self.ok('instructor','/rpc/close_attendance',{'p_session':s})
  self.assertEqual(self.ok('student','/rpc/attendance_report',{'p_course':c})['stats']['present'],1)
 def test_18_attendance_audit_scope_and_required_failure_over_http(self):
  c,l=self.lecture();s=self.ok('instructor','/rpc/open_attendance',{'p_lecture':l});u=self.accounts['student']['id']
  # Approved binary attendance (0040): old excused records survive, new writes are denied.
  self.denied('instructor','/rpc/correct_attendance',{'p_session':s,'p_student':u,'p_status':'excused'})
  self.assertEqual(self.ok('student',f'/attendance_records?session_id=eq.{s}')[0]['status'],'absent')
  record=self.ok('instructor','/rpc/correct_attendance',{'p_session':s,'p_student':u,'p_status':'present','p_reason':'private supporting detail'})
  events=self.ok('admin',f'/audit_events?entity_id=eq.{record}');self.assertTrue(events);self.assertNotIn('private supporting detail',json.dumps(events))
  self.ok('admin','/rpc/correct_attendance',{'p_session':s,'p_student':u,'p_status':'absent','p_reason':'administrative correction'})
  self.assertFalse(any(e['actor_role']=='admin' for e in self.ok('admin',f'/audit_events?entity_id=eq.{record}')))
  self.assertTrue(any(e['actor_role']=='admin' for e in self.ok('super',f'/audit_events?entity_id=eq.{record}')))
  try:
   self.stack.sql("CREATE FUNCTION public.http_attendance_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='attendance_records' THEN RAISE EXCEPTION 'local failure'; END IF;RETURN NEW;END $$;CREATE TRIGGER http_attendance_audit_failure BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.http_attendance_audit_failure()")
   status,_=self.request('instructor','/rpc/correct_attendance',{'p_session':s,'p_student':u,'p_status':'present','p_reason':'must roll back'});self.assertGreaterEqual(status,400)
   self.assertEqual(self.ok('student',f'/attendance_records?id=eq.{record}')[0]['status'],'absent')
  finally:self.stack.sql('DROP TRIGGER http_attendance_audit_failure ON public.audit_events;DROP FUNCTION public.http_attendance_audit_failure()')
 def test_19_live_admission_blocks_time_roles_and_no_browser_reconciler(self):
  c,l=self.lecture(online=True);u=self.accounts['student']['id']
  for actor,moderator in [('student',False),('instructor',True),('admin',True),('super',True)]:
   gate=self.ok(actor,'/rpc/lecture_join_permission',{'p_lecture':l});self.assertEqual(gate['identity'],self.accounts[actor]['id']);self.assertEqual(gate['moderator'],moderator);self.assertEqual(gate['room'],'yhub-lecture-'+l)
  for actor in ['student2','other']:self.denied(actor,'/rpc/lecture_join_permission',{'p_lecture':l})
  for actor in ['student','instructor','admin','super']:self.denied(actor,'/rpc/lecture_participant_allowed',{'p_lecture':l,'p_user':u})
  self.ok('instructor','/rpc/block_lecture_participant',{'p_lecture':l,'p_student':u,'p_reason':'local moderation'})
  self.denied('student','/rpc/lecture_join_permission',{'p_lecture':l})
  self.ok('instructor','/rpc/cancel_academic_lecture',{'p_lecture':l});self.denied('instructor','/rpc/lecture_join_permission',{'p_lecture':l})
 def test_20_in_person_lectures_and_demoted_instructor_do_not_get_media_access(self):
  c,l=self.lecture();self.denied('student','/rpc/lecture_join_permission',{'p_lecture':l})
  c,l=self.lecture(online=True);i=self.accounts['instructor']['id']
  try:
   self.ok('super','/rpc/admin_set_user_role',{'p_user_id':i,'p_new_role':'student'})
   self.denied('instructor','/rpc/lecture_join_permission',{'p_lecture':l})
   self.denied('instructor','/rpc/open_attendance',{'p_lecture':l})
  finally:self.ok('super','/rpc/admin_set_user_role',{'p_user_id':i,'p_new_role':'instructor'})
 def test_21_service_reconciliation_is_authorized_over_http_but_never_for_users(self):
  c,l=self.lecture(online=True);u=self.accounts['student']['id']
  encode=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
  body=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'role':'service_role','exp':int(time.time())+60})
  signature=base64.urlsafe_b64encode(hmac.new(self.stack.secret.encode(),body.encode(),hashlib.sha256).digest()).decode().rstrip('=')
  token=body+'.'+signature;payload={'p_lecture':l,'p_user':u}
  status,allowed=self.stack.request('rest','/rpc/lecture_participant_allowed',payload,token);self.assertEqual(status,200);self.assertTrue(allowed)
  self.ok('instructor','/rpc/block_lecture_participant',{'p_lecture':l,'p_student':u,'p_reason':'reconcile now'})
  status,allowed=self.stack.request('rest','/rpc/lecture_participant_allowed',payload,token);self.assertEqual(status,200);self.assertFalse(allowed)
  for actor in ['student','instructor','admin','super']:self.denied(actor,'/rpc/lecture_participant_allowed',payload)

 def test_22_legacy_course_insert_returning_preserves_row_security(self):
  c=uid();owner=self.accounts['instructor']['id']
  rows=self.ok('instructor','/courses',{'id':c,'instructor_id':owner,'title':'Legacy creation','is_published':False})
  self.assertEqual(rows[0]['id'],c);self.assertTrue(rows[0]['course_definition_id'])
  self.assertEqual(self.ok('other',f'/courses?id=eq.{c}'),[])
  self.assertEqual(self.ok('student',f'/courses?id=eq.{c}'),[])
  self.assertEqual(self.ok('admin',f'/courses?id=eq.{c}')[0]['id'],c)
  forged=uid()
  self.denied('student','/courses',{'id':forged,'instructor_id':self.accounts['student']['id'],'title':'Denied'})
  self.assertEqual(self.ok('admin',f'/courses?id=eq.{forged}'),[])
 def test_23_section_activity_directories_follow_actual_membership_and_assignment(self):
  _,c=self.section();self.enroll(c)
  for endpoint in ['my_attendance_sections','my_online_lecture_sections']:
   self.assertIn(c,[r['id'] for r in self.ok('student','/rpc/'+endpoint,{})])
   self.assertNotIn(c,[r['id'] for r in self.ok('student2','/rpc/'+endpoint,{})])
   self.assertNotIn(c,[r['id'] for r in self.ok('other','/rpc/'+endpoint,{})])
  self.ok('admin','/rpc/assign_academic_section',{'p_section':c,'p_expected_instructor':self.accounts['instructor']['id'],'p_instructor':self.accounts['other']['id']})
  for endpoint in ['my_attendance_sections','my_online_lecture_sections']:
   self.assertNotIn(c,[r['id'] for r in self.ok('instructor','/rpc/'+endpoint,{})])
   self.assertIn(c,[r['id'] for r in self.ok('other','/rpc/'+endpoint,{})])
 def learning_directory(self,actor,claimed_student=None):
  student=claimed_student or self.accounts[actor]['id']
  return self.ok(actor,f'/courses?select=id,title,section_label,academic_term,course_enrollments!inner(student_id,status)&course_enrollments.student_id=eq.{student}&course_enrollments.status=eq.active&is_published=eq.true&order=title,id&offset=0&limit=26')
 def test_24_learning_path_distinguishes_equal_titles_and_reads_actual_syllabus(self):
  _,first=self.section();_,second=self.section();self.enroll(first);self.enroll(second)
  for cid,title in [(first,'Topic first section'),(second,'Topic second section')]:
   units=[{'id':uid(),'title':'Actual unit','sections':[{'id':uid(),'title':title}]}]
   self.ok('instructor','/rpc/save_course_syllabus',{'p_course_id':cid,'p_expected_revision':0,'p_units':units})
   snapshot=self.ok('student','/rpc/read_course_syllabus',{'p_course_id':cid})
   self.assertEqual(snapshot['courseId'],cid);self.assertEqual(snapshot['units'],units)
  directory=self.learning_directory('student');ids=[r['id'] for r in directory]
  self.assertIn(first,ids);self.assertIn(second,ids)
  self.assertEqual(next(r['title'] for r in directory if r['id']==first),next(r['title'] for r in directory if r['id']==second))
  self.assertNotIn(first,[r['id'] for r in self.learning_directory('student2')])
 def test_25_learning_path_rejects_foreign_identity_and_withdrawal(self):
  _,cid=self.section();self.enroll(cid)
  self.assertEqual(self.learning_directory('student2',self.accounts['student']['id']),[])
  self.assertIsNone(self.ok('student2','/rpc/read_course_syllabus',{'p_course_id':cid}))
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{cid}'")
  self.assertNotIn(cid,[r['id'] for r in self.learning_directory('student')])
  self.assertIsNone(self.ok('student','/rpc/read_course_syllabus',{'p_course_id':cid}))
 def test_26_learning_path_unpublished_section_and_unauthenticated_access(self):
  _,cid=self.section();self.enroll(cid)
  self.ok('instructor',f'/courses?id=eq.{cid}',{'is_published':False},'PATCH')
  self.assertNotIn(cid,[r['id'] for r in self.learning_directory('student')])
  self.assertIsNone(self.ok('student','/rpc/read_course_syllabus',{'p_course_id':cid}))
  self.denied(None,'/rpc/read_course_syllabus',{'p_course_id':cid})
 def test_27_learning_path_staff_scope_uses_live_roles_and_existing_rpc(self):
  _,cid=self.section();instructor=self.accounts['instructor']['id']
  path=f'/courses?select=id,title,section_label,academic_term&id=eq.{cid}&instructor_id=eq.{instructor}&order=title,id&offset=0&limit=26'
  self.assertEqual(self.ok('instructor',path)[0]['id'],cid)
  self.assertEqual(self.ok('other',path),[])
  self.assertIsNone(self.ok('other','/rpc/read_course_syllabus',{'p_course_id':cid}))
  for role in ['admin','super']:
   self.assertEqual(self.ok(role,f'/courses?select=id,title,section_label,academic_term&id=eq.{cid}')[0]['id'],cid)
   self.assertEqual(self.ok(role,'/rpc/read_course_syllabus',{'p_course_id':cid})['courseId'],cid)
 def learning_topic(self):
  _,c=self.section();self.enroll(c);topic=uid();units=[{'id':uid(),'title':'Unit','sections':[{'id':topic,'title':'Lesson'}]}]
  self.ok('instructor','/rpc/save_course_syllabus',{'p_course_id':c,'p_expected_revision':0,'p_units':units});return c,topic
 def test_28_completion_roundtrip_retry_and_withdrawal_over_native_jwt(self):
  c,t=self.learning_topic();payload={'p_topic':t,'p_expected_revision':0,'p_state':'completed'}
  self.assertEqual(self.ok('student','/rpc/set_lesson_completion',payload),1)
  self.assertEqual(self.ok('student','/rpc/set_lesson_completion',payload),1)
  state=self.ok('student','/rpc/read_lesson_progress',{'p_course':c});self.assertTrue(state['topics'][0]['completed'])
  self.denied('student2','/rpc/set_lesson_completion',payload)
  self.denied('student','/rpc/set_lesson_completion',{**payload,'p_student':self.accounts['student2']['id']})
  self.denied('student','/lesson_completion_overrides',{'topic_id':t,'student_id':self.accounts['student']['id'],'completed':True})
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  self.denied('student','/rpc/read_lesson_progress',{'p_course':c})
  self.denied('student','/rpc/set_lesson_completion',{**payload,'p_state':'incomplete','p_expected_revision':1})
 def test_29_completion_rule_activity_submission_and_manual_override(self):
  c,t=self.learning_topic();e,q=uid(),uid()
  self.ok('instructor','/exams',{'id':e,'course_id':c,'title':'Completion activity','is_published':True})
  self.ok('instructor','/questions',{'id':q,'exam_id':e,'course_id':c,'type':'math','content':'Local','correct_answer':'42','points':1})
  rule={'p_topic':t,'p_expected_revision':0,'p_mode':'all','p_exam_ids':[e]}
  self.denied('other','/rpc/set_lesson_completion_rule',rule);self.denied('student','/rpc/set_lesson_completion_rule',rule)
  self.assertEqual(self.ok('instructor','/rpc/set_lesson_completion_rule',rule),1)
  before=self.ok('student','/rpc/read_lesson_progress',{'p_course':c});self.assertFalse(before['topics'][0]['completed']);self.assertNotIn('correct_answer',json.dumps(before))
  self.ok('student','/rpc/start_exam_attempt',{'p_exam_id':e});self.ok('student','/rpc/submit_exam',{'p_exam_id':e,'p_answers':{q:'42'}})
  self.assertTrue(self.ok('student','/rpc/read_lesson_progress',{'p_course':c})['topics'][0]['completed'])
  self.ok('student','/rpc/set_lesson_completion',{'p_topic':t,'p_expected_revision':0,'p_state':'incomplete'})
  self.assertFalse(self.ok('student','/rpc/read_lesson_progress',{'p_course':c})['topics'][0]['completed'])
 def test_30_completion_conflicts_use_terminal_409_and_no_fake_actor(self):
  c,t=self.learning_topic();self.ok('student','/rpc/set_lesson_completion',{'p_topic':t,'p_expected_revision':0,'p_state':'completed'})
  self.conflict('student','/rpc/set_lesson_completion',{'p_topic':t,'p_expected_revision':0,'p_state':'incomplete'})
  for actor in ['admin','super']:
   data=self.ok(actor,'/rpc/read_lesson_progress',{'p_course':c});self.assertFalse(data['student']);self.assertFalse(data['canManage']);self.assertEqual(data['topics'][0]['revision'],0)
  self.denied(None,'/rpc/read_lesson_progress',{'p_course':c})
