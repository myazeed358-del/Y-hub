"""Real local GoTrue JWTs and PostgREST; no hosted project or production writes."""
import unittest,uuid,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from runtime import Stack
class SheetsHTTP(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.stack=Stack(Path.cwd());cls.addClassCleanup(cls.stack.close);cls.stack.start();cls.users={}
  for i,role in enumerate(['student','instructor','admin','super_admin']):
   email=f'sheets-{i}@local.example.invalid';password='Local-fixture-only-123!'
   status,data=cls.stack.request('auth','/signup',{'email':email,'password':password,'data':{'full_name_ar':'مستخدم تجريبي','full_name_en':'Local Test','full_name':'Local sheets test','role':'super_admin'}})
   assert status==200 and data.get('access_token')
   cls.users[role]={'id':data['user']['id'],'token':data['access_token'],'email':email,'password':password}
   if role!='student':cls.stack.sql(f"UPDATE public.users SET role='{role}' WHERE id='{data['user']['id']}'")
 def payload(self,role='student'):
  id=str(uuid.uuid4());return {'p_id':id,'p_request_id':str(uuid.uuid4()),'p_expected_revision':0,'p_expected_owner_id':self.users[role]['id'],'p_content':{'id':id,'name':'Local workbook','version':1,'activeSheetId':'s','sheets':[{'id':'s','name':'Sheet 1','cells':{},'rowCount':10,'colCount':10,'columnWidths':{},'rowHeights':{},'mergedCells':[],'conditionalFormats':[],'validations':{}}]}}
 def req(self,role,path,data=None,method=None,token=None):return self.stack.request('rest',path,data,token or self.users[role]['token'],method)
 def test_01_all_roles_save_own_workbooks_and_cannot_read_another_account(self):
  for role in self.users:
   p=self.payload(role);status,revision=self.req(role,'/rpc/save_y_sheets_workbook',p);self.assertEqual((status,revision),(200,1))
   for reader in self.users:
    status,rows=self.req(reader,f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=id,revision");self.assertEqual(status,200);self.assertEqual(len(rows),int(reader==role))
 def test_02_idempotent_retry_after_lost_ack_does_not_advance_revision(self):
  p=self.payload();self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1));self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1))
  status,rows=self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=revision");self.assertEqual((status,rows),(200,[{'revision':1}]))
 def test_03_native_session_identity_cannot_be_forged_and_direct_writes_are_denied(self):
  p=self.payload();p['p_expected_owner_id']=self.users['admin']['id'];self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p)[0],403)
  self.assertEqual(self.stack.request('rest','/rpc/save_y_sheets_workbook',self.payload())[0],401)
  p=self.payload();self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p)[0],200)
  for method,body in [('PATCH',{'name':'forged'}),('DELETE',None)]:self.assertEqual(self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}",body,method)[0],403)
 def test_04_two_authenticated_sessions_cannot_overwrite_the_same_revision(self):
  account=self.users['student'];status,login=self.stack.request('auth','/token?grant_type=password',{'email':account['email'],'password':account['password']});self.assertEqual(status,200)
  p=self.payload();self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1))
  a={**p,'p_request_id':str(uuid.uuid4()),'p_expected_revision':1,'p_content':{**p['p_content'],'name':'Device A'}};b={**a,'p_request_id':str(uuid.uuid4()),'p_content':{**p['p_content'],'name':'Device B'}}
  start=time.monotonic()
  with ThreadPoolExecutor(max_workers=2) as pool:
   requests=[pool.submit(self.req,'student','/rpc/save_y_sheets_workbook',payload,None,token) for payload,token in [(a,account['token']),(b,login['access_token'])]];results=[f.result() for f in requests]
  self.assertEqual(sum(status==200 for status,_ in results),1);self.assertEqual(sum(status==409 and body.get('code')=='PT409' for status,body in results if status!=200),1);self.assertLess(time.monotonic()-start,10)
  status,rows=self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=revision,name");self.assertEqual(status,200);self.assertEqual(rows[0]['revision'],2);self.assertIn(rows[0]['name'],['Device A','Device B'])

 def test_05_delete_conflict_and_receipt_replay_after_deletion_return_terminal_409(self):
  p=self.payload();self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1))
  update={**p,'p_request_id':str(uuid.uuid4()),'p_expected_revision':1};self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',update),(200,2))
  start=time.monotonic();status,body=self.req('student','/rpc/delete_y_sheets_workbook',{'p_id':p['p_id'],'p_expected_revision':1});self.assertEqual((status,body['code']),(409,'PT409'));self.assertLess(time.monotonic()-start,10)
  self.assertEqual(self.req('student','/rpc/delete_y_sheets_workbook',{'p_id':p['p_id'],'p_expected_revision':2}),(200,p['p_id']))
  status,body=self.req('student','/rpc/save_y_sheets_workbook',p);self.assertEqual((status,body['code']),(409,'PT409'))
  self.assertEqual(self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=id"),(200,[]))
