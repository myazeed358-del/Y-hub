"""Filtered reporting uses trusted roles and a consistent server-side scope."""
import json, unittest
from support import run, value, I, A, S, O
from test_attendance import lecture
from test_engine_grants import student

class AttendanceReports(unittest.TestCase):
 def fixture(self):
  c,l=lecture();u,v=student(),student()
  run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{u}'),('{c}','{v}')")
  s=value(f"SELECT public.open_attendance('{l}')",I)
  value(f"SELECT public.correct_attendance('{s}','{u}','present','private medical note')",I)
  value(f"SELECT public.close_attendance('{s}')",I)
  return c,l,s,u,v
 def report(self,c,actor=I,extra=''):
  return json.loads(value(f"SELECT public.attendance_report_v2(p_course=>'{c}'{extra})",actor))
 def test_student_scope_cannot_be_overridden_and_survives_withdrawal(self):
  c,l,s,u,v=self.fixture()
  for actor in [I,A,S]: self.assertEqual(self.report(c,actor)['total'],2)
  self.assertEqual(self.report(c,u)['total'],1)
  self.assertEqual(self.report(c,student())['total'],0)
  self.assertNotEqual(run(f"SELECT public.attendance_report_v2(p_course=>'{c}',p_student=>'{v}')",u,False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.attendance_report_v2('{c}')",O,False).returncode,0)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE student_id='{u}' AND course_id='{c}'")
  self.assertEqual(self.report(c,u)['rows'][0]['student_id'],u)
 def test_filters_pagination_statistics_and_chart_share_the_same_scope(self):
  c,l,s,u,v=self.fixture()
  first=self.report(c,extra=',p_limit=>1');second=self.report(c,extra=',p_offset=>1,p_limit=>1')
  self.assertEqual(first['total'],2);self.assertNotEqual(first['rows'][0]['id'],second['rows'][0]['id'])
  self.assertEqual(first['revision'],second['revision']);self.assertEqual(first['stats'],{'eligible':2,'present':1,'absent':1,'excused':0})
  self.assertEqual(first['trend'][0]['eligible'],2)
  self.assertEqual(self.report(c,extra=f",p_student=>'{v}'")['stats']['absent'],1)
  self.assertEqual(self.report(c,extra=",p_status=>'present'")['total'],1)
  self.assertEqual(self.report(c,extra=f",p_lecture=>'{l}'")['total'],2)
  other_c,other_l=lecture();self.assertEqual(self.report(c,extra=f",p_lecture=>'{other_l}'")['total'],0)
  number=value(f"SELECT user_number FROM public.users WHERE id='{u}'")
  self.assertEqual(self.report(c,extra=f",p_search=>'{number}'")['total'],1)
  self.assertEqual(self.report(c,extra=",p_search=>'%' ")['total'],0)
  self.assertEqual(self.report(c,extra=",p_from=>clock_timestamp()+interval '1 day'")['total'],0)
  self.assertEqual(self.report(c,extra=",p_to=>clock_timestamp()-interval '1 day'")['total'],0)
 def test_cancelled_and_open_rows_do_not_inflate_final_statistics(self):
  c,l,s,u,v=self.fixture();value(f"SELECT public.cancel_attendance('{s}')",I)
  r=self.report(c);self.assertEqual(r['total'],2);self.assertEqual(r['stats']['eligible'],0);self.assertEqual(r['trend'],[])
  self.assertEqual(self.report(c,extra=",p_state=>'cancelled'")['total'],2)
  c,l=lecture();u=student();run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{u}')")
  s=value(f"SELECT public.open_attendance('{l}')",I)
  self.assertEqual(self.report(c)['stats']['eligible'],0)
  run(f"UPDATE public.attendance_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{s}'")
  self.assertEqual(self.report(c)['stats']['absent'],1)
 def test_projection_excludes_secrets_and_revision_detects_corrections(self):
  c,l,s,u,v=self.fixture();before=self.report(c)
  self.assertNotIn('private medical note',json.dumps(before))
  self.assertEqual(set(before['rows'][0]),{'id','session_id','student_id','full_name','user_number','title','starts_at','status','method','state'})
  value(f"SELECT public.correct_attendance('{s}','{v}','present')",I)
  self.assertNotEqual(before['revision'],self.report(c)['revision'])
 def test_invalid_filters_and_public_execute_fail_closed(self):
  c,l,s,u,v=self.fixture()
  for extra in [',p_limit=>0',',p_limit=>201',',p_offset=>-1',",p_status=>'late'",",p_state=>'hidden'",",p_search=>repeat('a',101)",",p_from=>'2026-02-01',p_to=>'2026-01-01'"]:
   self.assertNotEqual(run(f"SELECT public.attendance_report_v2(p_course=>'{c}'{extra})",I,False).returncode,0)
  self.assertEqual(value("SELECT has_function_privilege('anon','public.attendance_report_v2(uuid,integer,integer,uuid,uuid,timestamptz,timestamptz,text,text,text)','EXECUTE')"),'f')
  self.assertEqual(value("SELECT has_function_privilege('service_role','public.attendance_report_v2(uuid,integer,integer,uuid,uuid,timestamptz,timestamptz,text,text,text)','EXECUTE')"),'f')
 def test_current_role_and_assignment_are_rechecked(self):
  c,l,s,u,v=self.fixture()
  try:
   run(f"UPDATE public.users SET role='student' WHERE id='{I}'")
   self.assertEqual(self.report(c)['total'],0)
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{I}'")
  value(f"SELECT public.assign_academic_section('{c}','{I}','{O}')",A)
  self.assertNotEqual(run(f"SELECT public.attendance_report_v2('{c}')",I,False).returncode,0)
  self.assertEqual(self.report(c,O)['total'],2)
