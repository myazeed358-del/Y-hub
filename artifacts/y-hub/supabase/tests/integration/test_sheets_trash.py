import unittest,uuid
import test_y_sheets as fixtures
import test_sheets_folders as folders
class SheetsTrashHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.SheetsHTTP.setUpClass.__func__)
 payload=fixtures.SheetsHTTP.payload
 req=fixtures.SheetsHTTP.req
 folder=folders.SheetsFoldersHTTP.folder
 def file(self):
  p=self.payload();self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1));return p
 def actor(self):return self.users['student']['id']
 def trash(self,p,kind='workbook'):
  status,e=self.req('student','/rpc/trash_y_sheets',{'p_actor':self.actor(),'p_kind':kind,'p_id':p['p_id'],'p_revision':1});self.assertEqual(status,200);return e
 def test_native_delete_restore_preserves_id_but_rejects_old_receipt(self):
  p=self.file();self.assertEqual(self.req('student','/rpc/delete_y_sheets_workbook',{'p_id':p['p_id'],'p_expected_revision':1}),(200,p['p_id']))
  status,rows=self.req('student','/rpc/list_y_sheets_trash',{'p_actor':self.actor()});self.assertEqual(status,200);e=next(x['id'] for x in rows if x['rootId']==p['p_id'])
  self.assertEqual(self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=id"),(200,[]))
  self.assertEqual(self.req('student','/rpc/restore_y_sheets_trash',{'p_actor':self.actor(),'p_entry':e}),(200,p['p_id']))
  self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p)[0],409)
  self.assertEqual(self.req('student',f"/y_sheets_workbooks?id=eq.{p['p_id']}&select=revision"),(200,[{'revision':2}]))
 def test_folder_tree_restores_without_inherited_or_direct_access(self):
  f=self.folder();p=self.file();self.req('student','/rpc/organize_y_sheets',{**f,'p_kind':'workbook','p_id':p['p_id'],'p_parent':f['p_id'],'p_name':None})
  g={'p_actor':self.actor(),'p_id':f['p_id'],'p_recipient':self.users['instructor']['id'],'p_permission':'edit','p_revision':0};self.assertEqual(self.req('student','/rpc/set_y_sheets_folder_share',g),(200,1))
  r={'p_actor':self.users['instructor']['id'],'p_id':p['p_id']};self.assertEqual(self.req('instructor','/rpc/read_shared_y_sheets',r)[0],200)
  e=self.trash(f,'folder');self.assertEqual(self.req('instructor','/rpc/read_shared_y_sheets',r)[0],403)
  self.assertEqual(self.req('student','/rpc/restore_y_sheets_trash',{'p_actor':self.actor(),'p_entry':e})[0],200);self.assertEqual(self.req('instructor','/rpc/read_shared_y_sheets',r)[0],403)
 def test_roles_forged_actor_and_anonymous_cannot_access_others_trash(self):
  p=self.file();e=self.trash(p)
  for role in ['instructor','admin','super_admin']:
   self.assertEqual(self.req(role,'/rpc/restore_y_sheets_trash',{'p_actor':self.users[role]['id'],'p_entry':e})[0],403)
   self.assertEqual(self.req(role,'/rpc/purge_y_sheets_trash',{'p_actor':self.actor(),'p_entry':e})[0],403)
  self.assertEqual(self.stack.request('rest','/rpc/list_y_sheets_trash',{'p_actor':self.actor()})[0],401)
  self.assertEqual(self.req('student','/rpc/purge_expired_y_sheets_trash',{})[0],403)
 def test_expired_restore_is_terminal_and_content_is_purged_by_listing(self):
  p=self.file();e=self.trash(p);self.stack.sql(f"UPDATE y_sheets_private.trash_entries SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{e}'")
  self.assertEqual(self.req('student','/rpc/restore_y_sheets_trash',{'p_actor':self.actor(),'p_entry':e})[0],409)
  self.req('student','/rpc/list_y_sheets_trash',{'p_actor':self.actor()});self.assertEqual(self.stack.sql(f"SELECT payload IS NULL FROM y_sheets_private.trash_entries WHERE id='{e}'"),'t')
