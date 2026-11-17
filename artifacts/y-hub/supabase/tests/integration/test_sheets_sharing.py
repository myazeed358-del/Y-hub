import unittest,uuid
from concurrent.futures import ThreadPoolExecutor
import test_y_sheets as fixtures
class SheetsSharingHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.SheetsHTTP.setUpClass.__func__)
 payload=fixtures.SheetsHTTP.payload
 req=fixtures.SheetsHTTP.req
 def setup_file(self,mode='view'):
  p=self.payload();self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1))
  grant={'p_actor':self.users['student']['id'],'p_id':p['p_id'],'p_recipient':self.users['instructor']['id'],'p_permission':mode,'p_revision':0}
  self.assertEqual(self.req('student','/rpc/set_y_sheets_share',grant),(200,1));return p,grant
 def read(self,p,role='instructor',grant=None):return self.req(role,'/rpc/read_shared_y_sheets',{'p_actor':self.users[role]['id'],'p_id':p['p_id'],'p_grant':grant})
 def edit(self,p,grant=1):return {'p_actor':self.users['instructor']['id'],'p_id':p['p_id'],'p_grant':grant,'p_request':str(uuid.uuid4()),'p_revision':1,'p_content':p['p_content']}
 def test_explicit_view_and_edit_access_with_no_platform_role_bypass(self):
  p,g=self.setup_file();self.assertEqual(self.read(p)[0],200)
  self.assertEqual(self.req('instructor','/rpc/save_shared_y_sheets',self.edit(p))[0],403)
  for role in ['admin','super_admin']:self.assertEqual(self.read(p,role)[0],403)
  self.assertEqual(self.req('student','/rpc/set_y_sheets_share',{**g,'p_permission':'edit','p_revision':1}),(200,2))
  self.assertEqual(self.req('instructor','/rpc/save_shared_y_sheets',self.edit(p,2)),(200,2))
  self.assertEqual(self.req('instructor',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=content"),(200,[]))
 def test_revocation_blocks_read_write_replay_and_regrant_rejects_old_epoch(self):
  p,g=self.setup_file('edit');edit=self.edit(p);self.assertEqual(self.req('instructor','/rpc/save_shared_y_sheets',edit),(200,2))
  self.assertEqual(self.req('student','/rpc/set_y_sheets_share',{**g,'p_permission':'none','p_revision':1}),(200,2))
  self.assertEqual(self.read(p)[0],403);self.assertEqual(self.req('instructor','/rpc/save_shared_y_sheets',edit)[0],403)
  self.assertEqual(self.req('student','/rpc/set_y_sheets_share',{**g,'p_revision':2}),(200,3))
  self.assertEqual(self.read(p,grant=1)[0],403);self.assertEqual(self.read(p,grant=3)[0],200)
 def test_forged_management_actor_direct_writes_and_anonymous_denied(self):
  p,g=self.setup_file();self.assertEqual(self.req('instructor','/rpc/set_y_sheets_share',g)[0],403)
  self.assertEqual(self.req('instructor','/rpc/preview_y_sheets_recipient',{'p_actor':self.users['instructor']['id'],'p_id':p['p_id'],'p_number':'123456789'})[0],403)
  self.assertEqual(self.stack.request('rest','/rpc/read_shared_y_sheets',{'p_actor':self.users['instructor']['id'],'p_id':p['p_id']})[0],401)
  self.assertEqual(self.req('instructor',f"/y_sheets_workbooks?id=eq.{p['p_id']}",{'name':'Forged'},'PATCH')[0],403)
 def test_owner_and_editor_native_concurrent_saves_have_one_winner(self):
  p,g=self.setup_file('edit');a={**p,'p_request_id':str(uuid.uuid4()),'p_expected_revision':1};b=self.edit(p)
  with ThreadPoolExecutor(2) as pool:
   results=[f.result() for f in [pool.submit(self.req,'student','/rpc/save_y_sheets_workbook',a),pool.submit(self.req,'instructor','/rpc/save_shared_y_sheets',b)]]
  self.assertEqual(sorted(r[0] for r in results),[200,409])
