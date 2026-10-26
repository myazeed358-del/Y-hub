"""Actual local GoTrue signup/JWT, PostgREST RPC and PostgreSQL. No external URLs."""
import unittest,uuid,json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from runtime import Stack
class ProfileNamesHTTP(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.stack=Stack(Path.cwd());cls.addClassCleanup(cls.stack.close);cls.stack.start()
 def signup(self,metadata=None):
  metadata=metadata if metadata is not None else {'full_name_ar':'أحمد عبد الله','full_name_en':'Ahmad Abdullah'}
  return self.stack.request('auth','/signup',{'email':str(uuid.uuid4())+'@names.invalid','password':'Local-name-test-123!','data':metadata})
 def account(self,legacy=False):
  status,data=self.signup();self.assertEqual(status,200);u=data['user']['id'];t=data['access_token']
  if legacy:self.stack.sql(f"UPDATE public.users SET full_name_ar=NULL,full_name_en=NULL WHERE id='{u}'")
  return u,t
 def test_real_signup_requires_names_and_ignores_forged_role_number(self):
  status,data=self.signup({'full_name':'Old client only'});self.assertGreaterEqual(status,400)
  status,data=self.signup({'full_name_ar':'أحمد','full_name_en':'Ahmad','role':'super_admin','user_number':'000000001'})
  self.assertEqual(status,200)
  code,rows=self.stack.request('rest','/users?select=id,full_name_ar,full_name_en,role,user_number',token=data['access_token'])
  self.assertEqual(code,200);self.assertEqual(len(rows),1);self.assertEqual(rows[0]['role'],'student')
  self.assertEqual(rows[0]['full_name_ar'],'أحمد');self.assertNotEqual(rows[0]['user_number'],'000000001')
 def test_legacy_completion_retry_and_actual_own_scope(self):
  uid,token=self.account(True);other,other_token=self.account(True)
  for _ in range(2):
   status,_=self.stack.request('rest','/rpc/complete_own_profile_names',{'p_ar':'أحمد','p_en':'Ahmad'},token);self.assertEqual(status,204)
  self.assertEqual(self.stack.sql(f"SELECT full_name_en FROM public.users WHERE id='{uid}'"),'Ahmad')
  self.assertEqual(self.stack.sql(f"SELECT full_name_en IS NULL FROM public.users WHERE id='{other}'"),'t')
  status,_=self.stack.request('rest','/rpc/complete_own_profile_names',{'p_ar':'خالد','p_en':'Khaled'},token);self.assertEqual(status,409)
  status,_=self.stack.request('rest','/rpc/complete_own_profile_names',{'p_ar':'أحمد','p_en':'Ahmad','p_user_id':uid},other_token);self.assertGreaterEqual(status,400)
 def test_direct_write_anonymous_and_invalid_payloads_are_denied(self):
  uid,token=self.account(True)
  for body in [{'p_ar':'أحمد','p_en':'<script>'},{'p_ar':'أحمد'},{'p_ar':None,'p_en':'Ahmad'}]:
   status,_=self.stack.request('rest','/rpc/complete_own_profile_names',body,token);self.assertGreaterEqual(status,400)
  status,_=self.stack.request('rest','/rpc/complete_own_profile_names',{'p_ar':'أحمد','p_en':'Ahmad'});self.assertGreaterEqual(status,400)
  status,_=self.stack.request('rest',f'/users?id=eq.{uid}',{'full_name_en':'Changed'},token,'PATCH');self.assertGreaterEqual(status,400)
 def test_two_devices_complete_atomically(self):
  uid,token=self.account(True)
  with ThreadPoolExecutor(2) as pool:
   results=list(pool.map(lambda pair:self.stack.request('rest','/rpc/complete_own_profile_names',{'p_ar':pair[0],'p_en':pair[1]},token),[('أحمد','Ahmad'),('خالد','Khaled')]))
  self.assertEqual(sorted(r[0] for r in results),[204,409])
  self.assertIn(self.stack.sql(f"SELECT full_name_ar||'/'||full_name_en FROM public.users WHERE id='{uid}'"),['أحمد/Ahmad','خالد/Khaled'])
 def test_auth_metadata_changes_do_not_rewrite_saved_profile_names(self):
  uid,token=self.account()
  status,_=self.stack.request('auth','/user',{'data':{'full_name_en':'Changed','role':'super_admin'}},token,'PUT')
  self.assertEqual(status,200)
  self.assertEqual(self.stack.sql(f"SELECT full_name_en||'/'||role FROM public.users WHERE id='{uid}'"),'Ahmad Abdullah/student')
