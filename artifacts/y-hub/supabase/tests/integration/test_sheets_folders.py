"""Native GoTrue identities and PostgREST for private organization RPCs."""
import unittest,uuid
from concurrent.futures import ThreadPoolExecutor
import test_y_sheets as fixtures
class SheetsFoldersHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.SheetsHTTP.setUpClass.__func__)
 payload=fixtures.SheetsHTTP.payload
 req=fixtures.SheetsHTTP.req
 def folder(self,role='student'):
  p={'p_owner':self.users[role]['id'],'p_kind':'folder','p_id':str(uuid.uuid4()),'p_revision':0,'p_parent':None,'p_name':'Private folder','p_favorite':False,'p_pinned':False}
  self.assertEqual(self.req(role,'/rpc/organize_y_sheets',p),(200,1));return p
 def test_own_tree_for_every_role_with_no_admin_file_bypass(self):
  for role in self.users:
   p=self.folder(role)
   status,body=self.req(role,'/rpc/browse_y_sheets',{'p_owner':p['p_owner'],'p_parent':p['p_id']})
   self.assertEqual(status,200);self.assertEqual(body['trail'][0]['id'],p['p_id'])
   for other in self.users:
    if other!=role:
     self.assertEqual(self.req(other,'/rpc/browse_y_sheets',{'p_owner':self.users[other]['id'],'p_parent':p['p_id']})[0],403)
     self.assertEqual(self.req(other,'/rpc/organize_y_sheets',{**p,'p_owner':self.users[other]['id'],'p_revision':1,'p_name':'Stolen'})[0],403)
 def test_direct_table_and_forged_actor_and_anonymous_are_denied(self):
  p=self.folder();p['p_owner']=self.users['admin']['id']
  self.assertEqual(self.req('student','/rpc/organize_y_sheets',p)[0],403)
  for method,body in [('GET',None),('POST',{'id':str(uuid.uuid4()),'owner_id':self.users['student']['id'],'name':'Forged'})]:
   self.assertEqual(self.req('student','/y_sheets_folders',body,method)[0],403)
  self.assertEqual(self.stack.request('rest','/rpc/browse_y_sheets',{'p_owner':self.users['student']['id']})[0],401)
 def test_move_keeps_file_identity_content_and_save_revision(self):
  folder=self.folder();p=self.payload();self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1))
  before=self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=*")
  move={**folder,'p_kind':'workbook','p_id':p['p_id'],'p_name':None,'p_parent':folder['p_id'],'p_favorite':True,'p_pinned':True}
  self.assertEqual(self.req('student','/rpc/organize_y_sheets',move),(200,1));self.assertEqual(self.req('student','/rpc/organize_y_sheets',move),(200,1))
  self.assertEqual(self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=*"),before)
  status,body=self.req('student','/rpc/browse_y_sheets',{'p_owner':folder['p_owner'],'p_parent':folder['p_id']})
  self.assertEqual(status,200);self.assertEqual([r['id'] for r in body['items']],[p['p_id']])
 def test_concurrent_http_updates_report_terminal_409(self):
  p=self.folder()
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda name:self.req('student','/rpc/organize_y_sheets',{**p,'p_revision':1,'p_name':name}),['One','Two']))
  self.assertEqual(sorted(x[0] for x in results),[200,409])
  self.assertEqual(next(body for status,body in results if status==409)['code'],'PT409')
