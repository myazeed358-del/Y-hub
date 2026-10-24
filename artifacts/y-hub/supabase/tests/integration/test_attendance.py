"""Actual local GoTrue JWT -> PostgREST -> attendance RPC/RLS tests."""
import unittest, uuid
from datetime import datetime,timedelta,timezone
import test_http as base

class AttendanceHTTP(unittest.TestCase):
 setUpClass=classmethod(base.SupabaseHTTP.setUpClass.__func__)
 request=base.SupabaseHTTP.request
 ok=base.SupabaseHTTP.ok
 denied=base.SupabaseHTTP.denied
 enroll=base.SupabaseHTTP.enroll
 def setup_session(self):
  c=str(uuid.uuid4())
  # Provision only the fixture section locally. Main's unrelated academic-creation
  # RPCs 0031/0032 are absent; this suite tests attendance, not that missing flow.
  self.stack.sql(f"INSERT INTO public.courses(id,instructor_id,title,is_published,enrollment_open) VALUES('{c}','{self.accounts['instructor']['id']}','Attendance section',true,true)")
  self.enroll(c)
  now=datetime.now(timezone.utc)
  l=self.ok('instructor','/rpc/schedule_academic_lecture',{'p_course':c,'p_title':'Attendance fixture','p_start':now.isoformat(),'p_end':(now+timedelta(hours=1)).isoformat()})
  s=self.ok('instructor','/rpc/open_attendance_v2',{'p_lecture':l,'p_duration_minutes':10,'p_qr_seconds':60})
  return c,l,s
 def test_01_actual_jwt_binary_correction_and_number(self):
  c,l,s=self.setup_session();u=self.accounts['student']['id']
  self.ok('instructor','/rpc/correct_attendance',{'p_session':s,'p_student':u,'p_status':'present'})
  report=self.ok('student','/rpc/attendance_report',{'p_course':c})
  self.assertEqual(report['rows'][0]['status'],'present');self.assertRegex(report['rows'][0]['user_number'],r'^\d{9}$')
  self.assertEqual(self.ok('student2','/rpc/attendance_report',{'p_course':c})['rows'],[])
  self.denied('other','/rpc/correct_attendance',{'p_session':s,'p_student':u,'p_status':'absent'})
  self.denied('student','/attendance_records',{'session_id':s,'student_id':u,'status':'present'})
 def test_02_rotating_qr_late_enrollment_and_duplicate(self):
  c,l,s=self.setup_session();qr=self.ok('instructor','/rpc/attendance_qr',{'p_session':s})
  self.assertEqual(qr['intervalSeconds'],60)
  r=self.ok('student','/rpc/check_in_attendance',{'p_token':qr['token']})
  self.assertEqual(self.ok('student','/rpc/check_in_attendance',{'p_token':qr['token']}),r)
  self.enroll(c,'student2');self.denied('student2','/rpc/check_in_attendance',{'p_token':qr['token']})
  self.denied('student','/rpc/check_in_attendance',{'p_token':qr['token']+'invalid'})
 def test_03_revocation_and_expiry_use_database_state(self):
  c,l,s=self.setup_session();qr=self.ok('instructor','/rpc/attendance_qr',{'p_session':s})
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}' AND student_id='{self.accounts['student']['id']}'")
  self.denied('student','/rpc/check_in_attendance',{'p_token':qr['token']})
  self.stack.sql(f"UPDATE public.attendance_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{s}'")
  self.assertEqual(self.ok('student','/rpc/get_attendance_session',{'p_lecture':l})['state'],'closed')
  self.assertEqual(self.ok('student','/rpc/attendance_report',{'p_course':c})['stats']['absent'],1)
 def test_04_admin_owner_controls_foreign_denial_and_cancel_audit(self):
  c,l,s=self.setup_session()
  for actor in ['student','other']:
   self.denied(actor,'/rpc/extend_attendance',{'p_session':s,'p_minutes':5})
   self.denied(actor,'/rpc/cancel_attendance',{'p_session':s})
  self.ok('admin','/rpc/extend_attendance',{'p_session':s,'p_minutes':5})
  self.ok('super','/rpc/cancel_attendance',{'p_session':s})
  self.assertEqual(self.ok('student','/rpc/attendance_report',{'p_course':c})['stats']['eligible'],0)
  self.assertEqual(self.ok('admin',f'/audit_events?entity_id=eq.{s}&actor_role=eq.super_admin'),[])
  self.assertTrue(self.ok('super',f'/audit_events?entity_id=eq.{s}&actor_role=eq.super_admin'))
 def test_05_stale_instructor_jwt_does_not_preserve_role(self):
  c,l,s=self.setup_session();actor=self.accounts['instructor']['id']
  try:
   self.stack.sql(f"UPDATE public.users SET role='student' WHERE id='{actor}'")
   self.denied('instructor','/rpc/extend_attendance',{'p_session':s,'p_minutes':5})
   self.denied('instructor','/rpc/attendance_session_roster_v2',{'p_session':s})
  finally:self.stack.sql(f"UPDATE public.users SET role='instructor' WHERE id='{actor}'")
