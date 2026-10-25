"""Real local JWT/RPC tests for approved grant workflows; no hosted writes."""
import unittest
from concurrent.futures import ThreadPoolExecutor
import test_http as base
class GrantHTTP(unittest.TestCase):
 setUpClass=classmethod(base.SupabaseHTTP.setUpClass.__func__)
 request=base.SupabaseHTTP.request
 ok=base.SupabaseHTTP.ok
 denied=base.SupabaseHTTP.denied
 section=base.SupabaseHTTP.section
 enroll=base.SupabaseHTTP.enroll
 def fixture(self):
  u=self.accounts['student']['id'];self.stack.sql(f"UPDATE public.users SET major='medicine' WHERE id='{u}'")
  _,c=self.section(major='');self.enroll(c)
  return c,u,{'p_course':c,'p_student':u,'p_engines':['linear-algebra','ode'],'p_expires':None}
 def test_01_enrollment_lifetime_batch_and_withdrawal_remove_compute_access(self):
  c,u,p=self.fixture();self.assertFalse(self.ok('student','/rpc/authorize_engine_compute',{'p_protocol':'phase','p_scope':'10'}))
  ids=self.ok('instructor','/rpc/grant_engine_access_batch',p);self.assertEqual(len(ids),2)
  self.assertTrue(self.ok('student','/rpc/authorize_engine_compute',{'p_protocol':'phase','p_scope':'10'}))
  self.assertEqual(self.ok('instructor','/rpc/grant_engine_access_batch',p),ids)
  self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}' AND student_id='{u}'")
  self.assertFalse(self.ok('student','/rpc/authorize_engine_compute',{'p_protocol':'phase','p_scope':'10'}))
  history=self.ok('instructor','/rpc/engine_grant_history',{'p_course':c,'p_student':u,'p_active':False})
  self.assertEqual({r['state'] for r in history['rows']},{'withdrawal'})
 def test_02_directory_number_scope_and_no_forged_batches(self):
  c,u,p=self.fixture();number=self.stack.sql(f"SELECT user_number FROM public.users WHERE id='{u}'")
  rows=self.ok('instructor','/rpc/search_engine_students',{'p_course':c,'p_search':number})['rows'];self.assertEqual(rows[0]['user_number'],number);self.assertEqual(rows[0]['student_id'],u)
  for actor in ['student','student2',None]:self.denied(actor,'/rpc/search_engine_students',{})
  self.assertEqual(self.ok('other','/rpc/search_engine_students',{'p_search':number})['total'],0)
  for actor in ['other','student','admin','super',None]:self.denied(actor,'/rpc/grant_engine_access_batch',p)
  self.denied('instructor','/rpc/grant_engine_access_batch',{**p,'p_engines':['linear-algebra','y-sheets']})
  self.assertEqual(self.ok('instructor',f'/engine_grants?course_id=eq.{c}'),[])
 def test_03_concurrent_retry_is_atomic_and_audited_once_per_grant(self):
  c,u,p=self.fixture()
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:self.ok('instructor','/rpc/grant_engine_access_batch',p),range(2)))
  self.assertEqual(results[0],results[1]);self.assertEqual(len(self.ok('instructor',f'/engine_grants?course_id=eq.{c}')),2)
  for g in results[0]:
   self.assertEqual(len(self.ok('admin',f'/audit_events?entity_id=eq.{g}&operation=eq.INSERT')),1)
  self.ok('instructor','/rpc/revoke_engine_access',{'p_grant':results[0][0]})
  events=self.ok('admin',f'/audit_events?entity_id=eq.{results[0][0]}&operation=eq.UPDATE');self.assertEqual(events[0]['new_values']['revocation_reason'],'manual')
 def test_04_stale_jwt_does_not_preserve_delegation_after_demotion(self):
  c,u,p=self.fixture();i=self.accounts['instructor']['id']
  try:
   self.stack.sql(f"UPDATE public.users SET role='student' WHERE id='{i}'")
   self.denied('instructor','/rpc/grant_engine_access_batch',p)
   self.denied('instructor','/rpc/engine_grant_history',{'p_course':c})
  finally:self.stack.sql(f"UPDATE public.users SET role='instructor' WHERE id='{i}'")
