import json,uuid,unittest,subprocess,time
from concurrent.futures import ThreadPoolExecutor
from support import run,value,U,O,A,I,BASE
from test_sheets_folders import workbook,sql,folder,organize
from test_sheets_sharing import share,read,save

def grant(id,permission='edit',revision=0,actor=U,recipient=O,check=True):
 return run('SELECT public.set_y_sheets_folder_share('+','.join(map(sql,[actor,id,recipient,permission,revision]))+')',actor,check)
def loaded(id):return json.loads(read(id).stdout)
def move(id,parent,revision=0,kind='workbook',name=None):return organize(id,kind,revision=revision,parent=parent,name=name or 'Folder')
class SheetsInheritance(unittest.TestCase):
 def test_current_future_nested_files_inherit_without_copying(self):
  root=folder();child=folder(parent=root);id=workbook();move(id,child);grant(root,'view')
  self.assertEqual(loaded(id)['permission'],'view')
  future=workbook();self.assertNotEqual(read(future,check=False).returncode,0);move(future,child)
  self.assertEqual(loaded(future)['permission'],'view');self.assertEqual(value(f"SELECT owner_id FROM public.y_sheets_workbooks WHERE id='{future}'"),U)
  self.assertNotEqual(save(future,check=False).returncode,0)
 def test_nested_edit_wins_and_revoking_one_source_preserves_other(self):
  root=folder();child=folder(parent=root);id=workbook();move(id,child);grant(root,'view');grant(child,'edit')
  initial=loaded(id);self.assertEqual(initial['permission'],'edit');grant(child,'none',1)
  self.assertEqual(loaded(id)['permission'],'view');self.assertNotEqual(read(id,grant=initial['grantRevision'],check=False).returncode,0)
  grant(root,'none',1);self.assertNotEqual(read(id,check=False).returncode,0)
 def test_file_move_updates_inheritance_and_retains_independent_direct_grants(self):
  source=folder();dest=folder();id=workbook();grant(source,'edit');grant(dest,'view');share(id,'view');move(id,source)
  first=loaded(id);before=value(f"SELECT row_to_json(w) FROM public.y_sheets_workbooks w WHERE id='{id}'")
  move(id,dest,1);self.assertEqual(loaded(id)['permission'],'view');self.assertNotEqual(save(id,first['workbook'],grant=first['grantRevision'],check=False).returncode,0)
  move(id,None,2);self.assertEqual(loaded(id)['permission'],'view');self.assertEqual(value(f"SELECT row_to_json(w) FROM public.y_sheets_workbooks w WHERE id='{id}'"),before)
  self.assertEqual(value(f"SELECT revision FROM y_sheets_private.shares WHERE workbook_id='{id}'"),'1')
 def test_moving_subtree_updates_descendants_without_changing_local_folder_grants(self):
  a=folder();b=folder();child=folder(parent=a);leaf=folder(parent=child);id=workbook();move(id,leaf)
  grant(a,'edit');grant(b,'view');grant(child,'view',recipient=A);move(child,b,1,'folder')
  self.assertEqual(loaded(id)['permission'],'view');self.assertEqual(json.loads(read(id,A).stdout)['permission'],'view')
  grant(b,'none',1);self.assertNotEqual(read(id,check=False).returncode,0);self.assertEqual(json.loads(read(id,A).stdout)['permission'],'view')
 def test_folder_revoke_keeps_direct_editor_and_direct_revoke_keeps_folder_viewer(self):
  p=folder();id=workbook();move(id,p);grant(p,'view');share(id,'edit');epoch=loaded(id)['grantRevision'];grant(p,'none',1)
  self.assertEqual(loaded(id)['permission'],'edit');self.assertNotEqual(read(id,grant=epoch,check=False).returncode,0)
  grant(p,'view',2);share(id,'none',1);self.assertEqual(loaded(id)['permission'],'view')
 def test_move_out_and_back_cannot_resurrect_session_or_old_receipt(self):
  p=folder();id=workbook();grant(p);move(id,p);initial=loaded(id);request=str(uuid.uuid4());save(id,initial['workbook'],grant=initial['grantRevision'],request=request)
  move(id,None,1);move(id,p,2);self.assertGreater(loaded(id)['grantRevision'],initial['grantRevision'])
  self.assertNotEqual(save(id,initial['workbook'],grant=initial['grantRevision'],request=request,check=False).returncode,0)
 def test_owner_only_no_platform_bypass_forgery_or_table_access(self):
  p=folder()
  for actor in [O,A,I]:self.assertNotEqual(grant(p,actor=actor,recipient=U,check=False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.set_y_sheets_folder_share('{U}','{p}','{O}','edit',0)",A,False).returncode,0)
  for table in ['folder_shares','effective_shares']:
   self.assertNotEqual(run(f'SELECT * FROM y_sheets_private.{table}',O,False).returncode,0)
  for role in ['anon','service_role']:
   self.assertNotEqual(run(f"SET LOCAL ROLE {role};SELECT public.list_y_sheets_folder_shares('{U}','{p}')",check=False).returncode,0)
  self.assertNotEqual(grant(p,recipient=U,check=False).returncode,0)
 def test_exact_recipient_preview_and_cas_retry(self):
  p=folder();number=value(f"SELECT user_number FROM public.users WHERE id='{O}'")
  result=json.loads(value(f"SELECT public.preview_y_sheets_folder_recipient('{U}','{p}','{number}')",U));self.assertEqual(result['id'],O);self.assertNotIn('email',result)
  grant(p);self.assertEqual(grant(p,revision=0).stdout.strip(),'1');self.assertNotEqual(grant(p,'view',0,check=False).returncode,0)
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda mode:grant(p,mode,1,check=False),['view','none']))
  self.assertEqual(sum(r.returncode==0 for r in results),1)
 def test_inherited_explanation_is_owner_only_and_separate_from_direct_list(self):
  p=folder(name='Source folder');id=workbook();move(id,p);grant(p,'view')
  rows=json.loads(value(f"SELECT public.list_y_sheets_inherited('{U}','{id}')",U));self.assertEqual(rows,[dict(id=O,number=value(f"SELECT user_number FROM public.users WHERE id='{O}'"),name=value(f"SELECT full_name FROM public.users WHERE id='{O}'"),permission='view',folderId=p,folderName='Source folder')])
  self.assertEqual(json.loads(value(f"SELECT public.list_y_sheets_shares('{U}','{id}')",U)),[])
  self.assertNotEqual(run(f"SELECT public.list_y_sheets_inherited('{O}','{id}')",O,False).returncode,0)
 def test_recipient_listing_includes_inherited_once_and_removes_revoked(self):
  p=folder();id=workbook();move(id,p);grant(p);share(id)
  rows=json.loads(value(f"SELECT public.list_shared_y_sheets('{O}')",O));self.assertEqual(sum(r['id']==id for r in rows),1)
  share(id,'none',1);grant(p,'none',1);rows=json.loads(value(f"SELECT public.list_shared_y_sheets('{O}')",O));self.assertNotIn(id,[r['id'] for r in rows])
 def test_metadata_updates_do_not_change_access_epoch(self):
  p=folder();id=workbook();move(id,p);grant(p);epoch=loaded(id)['grantRevision']
  organize(id,'workbook',revision=1,parent=p,favorite=True,pinned=True);organize(p,revision=1,name='Renamed')
  self.assertEqual(loaded(id)['grantRevision'],epoch)
 def test_audit_failure_rolls_back_grant_and_effective_access(self):
  p=folder(name='Private folder');id=workbook();move(id,p);grant(p)
  event=value(f"SELECT id FROM public.audit_events WHERE entity_type='folder_shares' AND new_values->>'folder_id'='{p}' ORDER BY occurred_at DESC LIMIT 1")
  self.assertEqual(value(f"SELECT person_id FROM public.audit_event_people WHERE event_id='{event}' AND relation='affected'"),O)
  self.assertNotIn('Private folder',value(f"SELECT row_to_json(e) FROM public.audit_events e WHERE id='{event}'"))
  try:
   run("CREATE FUNCTION public.fail_folder_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='folder_shares' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_folder_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_folder_audit()")
   self.assertNotEqual(grant(p,'none',1,check=False).returncode,0);self.assertEqual(loaded(id)['permission'],'edit')
  finally:run('DROP TRIGGER fail_folder_audit ON public.audit_events;DROP FUNCTION public.fail_folder_audit()')
 def test_waiting_save_cannot_bypass_committed_folder_revocation(self):
  p=folder();id=workbook();move(id,p);grant(p);initial=loaded(id)
  process=subprocess.Popen(BASE,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  process.stdin.write(f"BEGIN;SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub='{U}';SELECT public.set_y_sheets_folder_share('{U}','{p}','{O}','none',1);SELECT pg_advisory_xact_lock(510062);SELECT pg_sleep(1);COMMIT;");process.stdin.close()
  try:
   deadline=time.monotonic()+8
   while time.monotonic()<deadline:
    if value("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=510062 AND granted")=='1':break
    time.sleep(.02)
   else:self.fail('Revocation marker missing')
   self.assertNotEqual(save(id,initial['workbook'],grant=initial['grantRevision'],check=False).returncode,0)
   process.wait(timeout=8);self.assertEqual(process.returncode,0,process.stderr.read());self.assertEqual(value(f"SELECT revision FROM public.y_sheets_workbooks WHERE id='{id}'"),'1')
  finally:process.wait(timeout=8);process.stdout.close();process.stderr.close()
 def test_new_catalog_acl_rls_and_search_paths_are_hardened(self):
  for table in ['folder_shares','effective_shares']:
   self.assertEqual(value(f"SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='y_sheets_private.{table}'::regclass"),'t')
   for role in ['anon','authenticated','service_role']:
    self.assertEqual(value(f"SELECT has_table_privilege('{role}','y_sheets_private.{table}','SELECT,INSERT,UPDATE,DELETE')"),'f')
  functions=['public.preview_y_sheets_folder_recipient(uuid,uuid,text)','public.list_y_sheets_folder_shares(uuid,uuid,integer)','public.set_y_sheets_folder_share(uuid,uuid,uuid,text,bigint)','public.list_y_sheets_inherited(uuid,uuid,integer)']
  for f in functions:
   self.assertEqual(value(f"SELECT proconfig @> ARRAY['search_path=\"\"'] FROM pg_proc WHERE oid='{f}'::regprocedure"),'t')
   self.assertEqual(value(f"SELECT has_function_privilege('authenticated','{f}','EXECUTE')"),'t')
   for role in ['anon','service_role']:self.assertEqual(value(f"SELECT has_function_privilege('{role}','{f}','EXECUTE')"),'f')
  for f in ['y_sheets_private.refresh_inheritance(uuid)','y_sheets_private.refresh_inheritance_trigger()','y_sheets_private.lock_folder_owner(uuid,uuid)']:
   for role in ['anon','authenticated','service_role']:self.assertEqual(value(f"SELECT has_function_privilege('{role}','{f}','EXECUTE')"),'f')
