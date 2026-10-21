"""Phase 3 negative controls, tested before and after the new migration."""
import unittest, uuid
from support import run,value,course,I,A,S,U,O

class SecurityHardening(unittest.TestCase):
 def test_exam_rpc_denies_unpublished_parent_section(self):
  c=course(); e,q=str(uuid.uuid4()),str(uuid.uuid4())
  run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{U}')",U)
  run(f"INSERT INTO public.exams(id,course_id,title,is_published,time_limit_minutes) VALUES('{e}','{c}','Exam',true,30); INSERT INTO public.questions(id,course_id,exam_id,type,content,correct_answer) VALUES('{q}','{c}','{e}','tf','Private question','true')",I)
  run(f"UPDATE public.courses SET is_published=false WHERE id='{c}'",I)
  self.assertNotEqual(run(f"SELECT public.start_exam_attempt('{e}')",U,False).returncode,0)
 def test_demoted_enrolled_owner_cannot_read_other_enrollments(self):
  c=course(O)
  run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{U}')",U)
  try:
   run(f"UPDATE public.users SET role='student' WHERE id='{O}'")
   run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{O}')",O)
   self.assertEqual(value(f"SELECT count(*) FROM public.course_enrollments WHERE course_id='{c}' AND student_id='{U}'",O),'0')
   self.assertEqual(value(f"SELECT count(*) FROM public.course_enrollments WHERE course_id='{c}' AND student_id='{O}'",O),'1')
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{O}'")
 def test_browser_roles_have_no_truncate_or_trigger_privileges(self):
  for role in ['anon','authenticated']:
   for privilege in ['TRUNCATE','TRIGGER','REFERENCES']:
    self.assertEqual(value(f"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND has_table_privilege('{role}',c.oid,'{privilege}')"),'0',f'{role} {privilege}')
 def test_rls_auto_enable_if_present_has_pinned_search_path_and_no_client_execute(self):
  self.assertEqual(value("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rls_auto_enable' AND (NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog'],false) OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE'))"),'0')
 def test_present_platform_event_trigger_is_hardened_without_replacing_body(self):
  from pathlib import Path
  sql=Path('artifacts/y-hub/supabase/migrations/0029_security_privileges_and_exam_access.sql').read_text()
  harden=sql[sql.index('DO $$'):sql.index('\nCREATE OR REPLACE FUNCTION')]
  try:
   run("CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END $$")
   before=value("SELECT prosrc FROM pg_proc WHERE oid='public.rls_auto_enable()'::regprocedure")
   self.assertEqual(value("SELECT has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')"),'t')
   run(harden)
   self.assertEqual(value("SELECT prosrc FROM pg_proc WHERE oid='public.rls_auto_enable()'::regprocedure"),before)
   self.test_rls_auto_enable_if_present_has_pinned_search_path_and_no_client_execute()
  finally:run('DROP FUNCTION public.rls_auto_enable()')
 def test_domain_tables_have_rls_and_definers_are_not_publicly_executable(self):
  self.assertEqual(value("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'test_legacy_snapshot' AND NOT c.relrowsecurity"),'0')
  self.assertEqual(value("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname IN ('public','yhub_academic_private','yhub_audit_private','yhub_exam_private','y_sheets_private','yhub_internal') AND p.prosecdef AND a.grantee=0 AND a.privilege_type='EXECUTE'"),'0')
