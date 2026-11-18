import json,uuid,unittest
from concurrent.futures import ThreadPoolExecutor
from support import run,value,U,O,A,I
from test_sheets_folders import workbook,folder,organize,sql
from test_sheets_sharing import share
from test_sheets_trash import trash,restore,purge

def classify(id,label='Course',revision=0,kind='workbook',actor=U,check=True):return run('SELECT public.classify_y_sheets('+','.join(map(sql,[actor,kind,id,revision,label]))+')',actor,check)
def preview(id,revision=1,actor=U,check=True):return run('SELECT public.preview_y_sheets_library('+','.join(map(sql,[actor,id,revision]))+')',actor,check)
def library(category=None,search='',offset=0,actor=U):return json.loads(value('SELECT public.browse_y_sheets_library('+','.join(map(sql,[actor,None,'all',search,'name',offset,False,category]))+')',actor))
class SheetsLibrary(unittest.TestCase):
 def test_preview_uses_active_saved_sheet_and_bounded_raw_inputs(self):
  id=workbook();content=json.loads(value(f"SELECT content FROM public.y_sheets_workbooks WHERE id='{id}'"));first=content['sheets'][0];first['cells']={'0,0':{'raw':'FIRST'}}
  second={**first,'id':'second','name':'Active saved sheet','cells':{'0,0':{'raw':'=1+2','computed':999},'1,1':{'raw':'<script>bad()</script>'},'2,2':{'raw':'x'*500},'6,0':{'raw':'OUTSIDE'}}};content['sheets'].append(second);content['activeSheetId']='second'
  value(f"SELECT public.save_y_sheets_workbook('{id}','{uuid.uuid4()}',1,{sql(json.dumps(content))}::jsonb,'{U}')",U)
  data=json.loads(preview(id,2).stdout);self.assertEqual(data['sheetName'],'Active saved sheet');self.assertEqual(data['sheetCount'],2);self.assertEqual(len(data['cells']),24)
  self.assertEqual(data['cells'][0]['text'],'=1+2');self.assertTrue(data['cells'][10]['truncated']);self.assertEqual(len(data['cells'][10]['text']),160)
  self.assertNotIn('OUTSIDE',json.dumps(data));self.assertNotIn('computed',json.dumps(data));self.assertNotIn('FIRST',json.dumps(data))
 def test_owner_only_preview_and_categories_even_for_shared_editor_or_admin(self):
  id=workbook();share(id)
  for actor in [O,A,I]:
   self.assertNotEqual(preview(id,actor=actor,check=False).returncode,0);self.assertNotEqual(classify(id,actor=actor,check=False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.preview_y_sheets_library('{U}','{id}',1)",O,False).returncode,0)
 def test_preview_revision_conflict_and_deleted_file_fail_closed(self):
  id=workbook();self.assertNotEqual(preview(id,2,check=False).returncode,0);e=trash(id).stdout.strip();self.assertNotEqual(preview(id,check=False).returncode,0);restore(e);self.assertNotEqual(preview(id,check=False).returncode,0);self.assertEqual(preview(id,2).returncode,0)
 def test_category_is_independent_of_content_location_and_shares(self):
  id=workbook();p=folder();organize(id,'workbook',parent=p);share(id)
  tables=['public.y_sheets_workbooks','y_sheets_private.locations','y_sheets_private.shares','y_sheets_private.effective_shares','y_sheets_private.save_receipts']
  def snap(t):return value(f'SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)) FROM {t} r')
  before={t:snap(t) for t in tables};classify(id,' الرياضيات ')
  for t in tables:self.assertEqual(snap(t),before[t],t)
  self.assertEqual(value(f"SELECT category FROM y_sheets_private.categories WHERE id='{id}'"),'الرياضيات')
 def test_folder_file_filter_is_case_insensitive_and_uncategorized_is_explicit(self):
  name='Library-'+str(uuid.uuid4());a=workbook(name+' file');b=workbook(name+' other');p=folder(name=name+' folder');classify(a,'Course');classify(p,'Course',kind='folder')
  self.assertEqual({r['id'] for r in library('course',name)['items']},{a,p});self.assertEqual([r['id'] for r in library('',name)['items']],[b]);self.assertEqual(len(library(None,name)['items']),3)
  classify(a,None,1);self.assertEqual({r['id'] for r in library('',name)['items']},{a,b})
 def test_invalid_labels_and_stale_category_updates_do_not_write(self):
  id=workbook();classify(id)
  for label in ['x'*41,'line\nbreak']:
   self.assertNotEqual(classify(id,label,1,check=False).returncode,0)
  self.assertEqual(classify(id,'Course',0).stdout.strip(),'1');self.assertNotEqual(classify(id,'Other',0,check=False).returncode,0)
  self.assertEqual(value(f"SELECT category FROM y_sheets_private.categories WHERE id='{id}'"),'Course')
 def test_concurrent_category_updates_have_one_winner(self):
  id=workbook();classify(id)
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda label:classify(id,label,1,check=False),['One','Two']))
  self.assertEqual(sum(r.returncode==0 for r in results),1)
 def test_trash_preserves_category_restore_advances_revision_and_purge_erases_it(self):
  p=folder();id=workbook();organize(id,'workbook',parent=p);classify(id);classify(p,'Folder category',kind='folder');e=trash(p,'folder').stdout.strip()
  self.assertNotEqual(classify(id,'Hidden',1,check=False).returncode,0);self.assertNotIn(id,[r['id'] for r in library('Course')['items']]);restore(e)
  self.assertEqual(value(f"SELECT revision FROM y_sheets_private.categories WHERE id='{id}'"),'2');self.assertNotEqual(classify(id,'Stale',1,check=False).returncode,0)
  e=trash(p,'folder',revision=2).stdout.strip();purge(e);self.assertEqual(value(f"SELECT count(*) FROM y_sheets_private.categories WHERE id IN ('{id}','{p}')"),'0')
 def test_audit_redacts_category_and_required_failure_rolls_back(self):
  id=workbook();classify(id,'Secret classification');event=value(f"SELECT new_values FROM public.audit_events WHERE entity_type='categories' AND entity_id='{id}' ORDER BY occurred_at DESC LIMIT 1");self.assertNotIn('Secret classification',event)
  try:
   run("CREATE FUNCTION public.fail_category_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='categories' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_category_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_category_audit()")
   self.assertNotEqual(classify(id,'Other',1,check=False).returncode,0);self.assertEqual(value(f"SELECT category FROM y_sheets_private.categories WHERE id='{id}'"),'Secret classification')
  finally:run('DROP TRIGGER fail_category_audit ON public.audit_events;DROP FUNCTION public.fail_category_audit()')
 def test_filter_is_applied_before_paging_and_percent_is_literal(self):
  label='P%'+uuid.uuid4().hex[:10]
  for i in range(52):classify(workbook('Page '+str(i).zfill(2)),label)
  first=library(label)['items'];second=library(label,offset=50)['items'];self.assertEqual(len(first),51);self.assertEqual(len(second),2);self.assertEqual(len({x['id'] for x in first[:50]+second}),52);self.assertEqual(library(label.replace('%',''))['items'],[])
 def test_private_table_and_new_rpc_catalog_acl(self):
  self.assertEqual(value("SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='y_sheets_private.categories'::regclass"),'t')
  for role in ['anon','authenticated','service_role']:
   self.assertEqual(value(f"SELECT has_table_privilege('{role}','y_sheets_private.categories','SELECT,INSERT,UPDATE,DELETE')"),'f')
  for f in ['public.classify_y_sheets(uuid,text,uuid,bigint,text)','public.browse_y_sheets_library(uuid,uuid,text,text,text,integer,boolean,text)','public.preview_y_sheets_library(uuid,uuid,bigint)']:
   self.assertEqual(value(f"SELECT proconfig @> ARRAY['search_path=\"\"'] FROM pg_proc WHERE oid='{f}'::regprocedure"),'t')
   for role in ['anon','service_role']:self.assertEqual(value(f"SELECT has_function_privilege('{role}','{f}','EXECUTE')"),'f')
 def test_expiry_cleanup_erases_archived_labels(self):
  id=workbook();classify(id,'Expired private label');e=trash(id).stdout.strip();run(f"UPDATE y_sheets_private.trash_entries SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{e}'");value(f"SELECT public.list_y_sheets_trash('{U}')",U)
  self.assertEqual(value(f"SELECT count(*) FROM y_sheets_private.categories WHERE id='{id}'"),'0')
 def test_legacy_directory_contract_remains_unchanged(self):
  id=workbook();q=f"SELECT public.browse_y_sheets('{U}',NULL,'all','','name',0,false)";before=value(q,U);classify(id);self.assertEqual(value(q,U),before)
