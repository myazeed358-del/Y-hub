import unittest
import test_y_sheets as fixtures
class SheetsLibraryHTTP(unittest.TestCase):
 setUpClass=classmethod(fixtures.SheetsHTTP.setUpClass.__func__)
 payload=fixtures.SheetsHTTP.payload
 req=fixtures.SheetsHTTP.req
 def file(self):
  p=self.payload();p['p_content']['sheets'][0]['cells']={'0,0':{'raw':'=2+3','computed':5},'1,1':{'raw':'Private saved value'}};self.assertEqual(self.req('student','/rpc/save_y_sheets_workbook',p),(200,1));return p
 def test_preview_returns_bounded_actual_raw_content_and_requires_current_revision(self):
  p=self.file();args={'p_owner':self.users['student']['id'],'p_id':p['p_id'],'p_revision':1};status,data=self.req('student','/rpc/preview_y_sheets_library',args);self.assertEqual(status,200);self.assertEqual(len(data['cells']),24);self.assertEqual(data['cells'][0]['text'],'=2+3')
  self.assertEqual(self.req('student','/rpc/preview_y_sheets_library',{**args,'p_revision':2})[0],409)
 def test_shared_editor_admin_forged_actor_and_anonymous_cannot_preview_or_classify(self):
  p=self.file();owner=self.users['student']['id'];self.req('student','/rpc/set_y_sheets_share',{'p_actor':owner,'p_id':p['p_id'],'p_recipient':self.users['instructor']['id'],'p_permission':'edit','p_revision':0})
  for role in ['instructor','admin','super_admin']:
   args={'p_owner':self.users[role]['id'],'p_id':p['p_id'],'p_revision':1};self.assertEqual(self.req(role,'/rpc/preview_y_sheets_library',args)[0],403)
   self.assertEqual(self.req(role,'/rpc/classify_y_sheets',{**args,'p_kind':'workbook','p_category':'Stolen','p_revision':0})[0],403)
  self.assertEqual(self.req('instructor','/rpc/preview_y_sheets_library',{'p_owner':owner,'p_id':p['p_id'],'p_revision':1})[0],403)
  self.assertEqual(self.stack.request('rest','/rpc/browse_y_sheets_library',{'p_owner':owner})[0],401)
 def test_category_filter_and_cas_do_not_change_content_revision(self):
  p=self.file();owner=self.users['student']['id'];args={'p_owner':owner,'p_kind':'workbook','p_id':p['p_id'],'p_revision':0,'p_category':'Research'}
  self.assertEqual(self.req('student','/rpc/classify_y_sheets',args),(200,1));self.assertEqual(self.req('student','/rpc/classify_y_sheets',{**args,'p_category':'Other'})[0],409)
  status,data=self.req('student','/rpc/browse_y_sheets_library',{'p_owner':owner,'p_view':'all','p_category':'research'});self.assertEqual(status,200);row=next(r for r in data['items'] if r['id']==p['p_id']);self.assertEqual(row['category'],'Research');self.assertEqual(row['revision'],1)
 def test_trash_hides_preview_restore_keeps_category_and_purge_erases_label(self):
  p=self.file();owner=self.users['student']['id'];self.req('student','/rpc/classify_y_sheets',{'p_owner':owner,'p_kind':'workbook','p_id':p['p_id'],'p_revision':0,'p_category':'Course'})
  status,e=self.req('student','/rpc/trash_y_sheets',{'p_actor':owner,'p_kind':'workbook','p_id':p['p_id'],'p_revision':1});self.assertEqual(status,200)
  self.assertEqual(self.req('student','/rpc/preview_y_sheets_library',{'p_owner':owner,'p_id':p['p_id'],'p_revision':1})[0],403)
  self.req('student','/rpc/restore_y_sheets_trash',{'p_actor':owner,'p_entry':e});status,data=self.req('student','/rpc/browse_y_sheets_library',{'p_owner':owner,'p_view':'all','p_category':'Course'});row=next(r for r in data['items'] if r['id']==p['p_id']);self.assertEqual(row['category_revision'],2)
  _,e=self.req('student','/rpc/trash_y_sheets',{'p_actor':owner,'p_kind':'workbook','p_id':p['p_id'],'p_revision':2});self.req('student','/rpc/purge_y_sheets_trash',{'p_actor':owner,'p_entry':e});self.assertEqual(self.stack.sql(f"SELECT count(*) FROM y_sheets_private.categories WHERE id='{p['p_id']}'"),'0')
