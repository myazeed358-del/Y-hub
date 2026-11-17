import unittest,uuid
import test_y_sheets as fixtures
import test_sheets_folders as folders
class SheetsInheritanceHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.SheetsHTTP.setUpClass.__func__)
 payload=fixtures.SheetsHTTP.payload
 req=fixtures.SheetsHTTP.req
 folder=folders.SheetsFoldersHTTP.folder
 def setup_tree(self):
  f=self.folder();p=self.payload();self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1))
  move={**f,'p_kind':'workbook','p_id':p['p_id'],'p_parent':f['p_id'],'p_name':None}
  self.assertEqual(self.req('student','/rpc/organize_y_sheets',move),(200,1))
  grant={'p_actor':self.users['student']['id'],'p_id':f['p_id'],'p_recipient':self.users['instructor']['id'],'p_permission':'edit','p_revision':0}
  self.assertEqual(self.req('student','/rpc/set_y_sheets_folder_share',grant),(200,1));return f,p,move,grant
 def read(self,p,grant=None):return self.req('instructor','/rpc/read_shared_y_sheets',{'p_actor':self.users['instructor']['id'],'p_id':p['p_id'],'p_grant':grant})
 def test_real_token_inherits_and_move_revokes_without_content_change(self):
  f,p,move,g=self.setup_tree();status,data=self.read(p);self.assertEqual(status,200);self.assertEqual(data['permission'],'edit')
  edit={'p_actor':self.users['instructor']['id'],'p_id':p['p_id'],'p_grant':data['grantRevision'],'p_request':str(uuid.uuid4()),'p_revision':1,'p_content':p['p_content']}
  self.assertEqual(self.req('instructor','/rpc/save_shared_y_sheets',edit),(200,2))
  self.assertEqual(self.req('student','/rpc/organize_y_sheets',{**move,'p_parent':None,'p_revision':1}),(200,2));self.assertEqual(self.read(p)[0],403)
  self.assertEqual(self.req('instructor','/rpc/save_shared_y_sheets',edit)[0],403)
  self.assertEqual(self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=revision"),(200,[{'revision':2}]))
 def test_folder_revocation_preserves_direct_grant_and_invalidates_old_session(self):
  f,p,m,g=self.setup_tree();direct={**g,'p_id':p['p_id'],'p_permission':'view'}
  self.assertEqual(self.req('student','/rpc/set_y_sheets_share',direct),(200,1));old=self.read(p)[1]['grantRevision']
  self.assertEqual(self.req('student','/rpc/set_y_sheets_folder_share',{**g,'p_permission':'none','p_revision':1}),(200,2))
  self.assertEqual(self.read(p)[1]['permission'],'view');self.assertEqual(self.read(p,old)[0],403)
 def test_folder_management_and_inherited_metadata_are_owner_only(self):
  f,p,m,g=self.setup_tree()
  for role in ['instructor','admin','super_admin']:
   self.assertEqual(self.req(role,'/rpc/set_y_sheets_folder_share',{**g,'p_actor':self.users[role]['id']})[0],403)
   self.assertEqual(self.req(role,'/rpc/list_y_sheets_inherited',{'p_actor':self.users[role]['id'],'p_id':p['p_id']})[0],403)
  self.assertEqual(self.req('instructor','/rpc/set_y_sheets_folder_share',g)[0],403)
  self.assertEqual(self.stack.request('rest','/rpc/list_y_sheets_folder_shares',{'p_actor':g['p_actor'],'p_id':f['p_id']})[0],401)
  self.assertEqual(len(self.req('student','/rpc/list_y_sheets_inherited',{'p_actor':g['p_actor'],'p_id':p['p_id']})[1]),1)
