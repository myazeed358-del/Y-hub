import json,uuid,unittest,subprocess,time
from concurrent.futures import ThreadPoolExecutor
from support import run,value,U,O,A,I,BASE
from test_sheets_folders import workbook,folder,organize,sql,browse
from test_sheets_sharing import share,read,save
from test_sheets_inheritance import grant

def trash(id,kind='workbook',revision=1,actor=U,check=True):
 return run('SELECT public.trash_y_sheets('+','.join(map(sql,[actor,kind,id,revision]))+')',actor,check)
def restore(entry,actor=U,check=True):return run(f"SELECT public.restore_y_sheets_trash('{actor}','{entry}')",actor,check)
def purge(entry,actor=U,check=True):return run(f"SELECT public.purge_y_sheets_trash('{actor}','{entry}')",actor,check)
def entries(actor=U):return json.loads(value(f"SELECT public.list_y_sheets_trash('{actor}')",actor))
def entry_id(id,kind='workbook'):return trash(id,kind).stdout.strip()
class SheetsTrash(unittest.TestCase):
 def test_file_hidden_from_owner_and_recipient_but_listed_privately_for_30_days(self):
  id=workbook('Secret cells');share(id);data=json.loads(read(id).stdout);e=entry_id(id)
  self.assertEqual(value(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'",U),'0')
  self.assertNotEqual(read(id,check=False).returncode,0);self.assertNotEqual(save(id,data['workbook'],check=False).returncode,0)
  row=next(x for x in entries() if x['id']==e);self.assertEqual(row['name'],'Secret cells');self.assertNotIn('payload',row)
  self.assertEqual(value(f"SELECT expires_at-deleted_at=interval '30 days' FROM y_sheets_private.trash_entries WHERE id='{e}'"),'t')
  self.assertNotIn(e,[x['id'] for x in entries(O)])
 def test_folder_tree_restore_at_root_preserves_ids_content_and_internal_parents(self):
  outer=folder();root=folder(parent=outer);child=folder(parent=root);leaf=folder(parent=child);id=workbook();organize(id,'workbook',parent=leaf)
  before=value(f"SELECT content FROM public.y_sheets_workbooks WHERE id='{id}'");grant(outer);grant(root);share(id)
  e=entry_id(root,'folder');self.assertEqual(value(f"SELECT count(*) FROM public.y_sheets_folders WHERE id IN ('{root}','{child}','{leaf}')"),'0')
  self.assertEqual(restore(e).stdout.strip(),root);self.assertEqual(restore(e).stdout.strip(),root)
  self.assertEqual(value(f"SELECT parent_id IS NULL FROM public.y_sheets_folders WHERE id='{root}'"),'t')
  self.assertEqual(value(f"SELECT parent_id FROM public.y_sheets_folders WHERE id='{leaf}'"),child)
  self.assertEqual(value(f"SELECT parent_id FROM y_sheets_private.locations WHERE id='{id}'"),leaf)
  self.assertEqual(value(f"SELECT content FROM public.y_sheets_workbooks WHERE id='{id}'"),before)
  self.assertNotEqual(read(id,check=False).returncode,0)
  self.assertEqual(value(f"SELECT permission FROM y_sheets_private.shares WHERE workbook_id='{id}'"),'none')
  self.assertEqual(value(f"SELECT permission FROM y_sheets_private.folder_shares WHERE folder_id='{root}'"),'none')
  self.assertEqual(value(f"SELECT payload IS NULL AND name IS NULL FROM y_sheets_private.trash_entries WHERE id='{e}'"),'t')
 def test_single_file_restore_detaches_from_shared_parent_and_regrant_invalidates_old_epoch(self):
  p=folder();id=workbook();organize(id,'workbook',parent=p);grant(p);share(id);old=json.loads(read(id).stdout);e=entry_id(id);restore(e)
  self.assertEqual(value(f"SELECT parent_id IS NULL FROM y_sheets_private.locations WHERE id='{id}'"),'t')
  self.assertNotEqual(read(id,check=False).returncode,0);share(id,'edit',2)
  current=json.loads(read(id).stdout);self.assertGreater(current['grantRevision'],old['grantRevision']);self.assertNotEqual(save(id,old['workbook'],grant=old['grantRevision'],check=False).returncode,0)
  self.assertEqual(save(id,current['workbook'],grant=current['grantRevision'],revision=2).stdout.strip(),'3')
 def test_owner_old_receipts_and_new_stale_writes_rejected_after_restore(self):
  id=workbook();receipt=json.loads(value(f"SELECT row_to_json(r) FROM y_sheets_private.save_receipts r WHERE workbook_id='{id}' LIMIT 1"));content=value(f"SELECT content FROM public.y_sheets_workbooks WHERE id='{id}'");e=entry_id(id);restore(e)
  for request,revision in [(receipt['request_id'],receipt['expected_revision']),(str(uuid.uuid4()),1),(str(uuid.uuid4()),0)]:
   result=run(f"SELECT public.save_y_sheets_workbook('{id}','{request}',{revision},{sql(content)}::jsonb,'{U}')",U,False);self.assertNotEqual(result.returncode,0)
  self.assertEqual(value(f"SELECT public.save_y_sheets_workbook('{id}','{uuid.uuid4()}',2,{sql(content)}::jsonb,'{U}')",U),'3')
 def test_empty_folder_restore_and_reserved_folder_ids_cannot_be_recreated(self):
  p=folder();e=entry_id(p,'folder');self.assertNotEqual(organize(p,revision=0,check=False).returncode,0)
  restore(e);self.assertEqual(value(f"SELECT revision FROM public.y_sheets_folders WHERE id='{p}'"),'2')
  self.assertNotEqual(organize(p,revision=1,name='Stale',check=False).returncode,0)
 def test_repeated_trash_does_not_duplicate_or_extend_retention(self):
  id=workbook();e=entry_id(id);expiry=value(f"SELECT expires_at FROM y_sheets_private.trash_entries WHERE id='{e}'")
  self.assertEqual(entry_id(id),e);self.assertEqual(value(f"SELECT expires_at FROM y_sheets_private.trash_entries WHERE id='{e}'"),expiry)
  restore(e);e2=trash(id,revision=2).stdout.strip();self.assertNotEqual(e,e2);self.assertNotEqual(restore(e2,actor=O,check=False).returncode,0)
 def test_wrong_revision_and_cross_owner_operations_are_atomic(self):
  id=workbook();self.assertNotEqual(trash(id,revision=8,check=False).returncode,0)
  for actor in [O,A,I]:self.assertNotEqual(trash(id,actor=actor,check=False).returncode,0)
  e=entry_id(id)
  for actor in [O,A,I]:
   self.assertNotEqual(restore(e,actor,False).returncode,0);self.assertNotEqual(purge(e,actor,False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.restore_y_sheets_trash('{U}','{e}')",O,False).returncode,0)
 def test_expiry_denies_restore_and_listing_erases_content_without_extending_date(self):
  id=workbook();e=entry_id(id);run(f"UPDATE y_sheets_private.trash_entries SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{e}'")
  self.assertNotEqual(restore(e,check=False).returncode,0);self.assertNotIn(e,[r['id'] for r in entries()])
  self.assertEqual(value(f"SELECT state='purged' AND payload IS NULL AND name IS NULL FROM y_sheets_private.trash_entries WHERE id='{e}'"),'t')
 def test_manual_purge_is_final_and_retains_only_identity_fence(self):
  p=folder();id=workbook();organize(id,'workbook',parent=p);e=entry_id(p,'folder');purge(e);purge(e)
  self.assertNotEqual(restore(e,check=False).returncode,0);self.assertNotEqual(organize(p,revision=0,check=False).returncode,0)
  self.assertEqual(value(f"SELECT payload IS NULL AND name IS NULL FROM y_sheets_private.trash_entries WHERE id='{e}'"),'t')
  self.assertEqual(value(f"SELECT state FROM y_sheets_private.lifecycle WHERE id='{id}'"),'purged')
 def test_service_purge_excludes_live_and_restored_entries_and_is_not_browser_callable(self):
  id=workbook();expired=entry_id(id);live=entry_id(workbook());restored=entry_id(workbook());restore(restored)
  run(f"UPDATE y_sheets_private.trash_entries SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{expired}'")
  self.assertNotEqual(run('SELECT public.purge_expired_y_sheets_trash()',U,False).returncode,0)
  run('SET LOCAL ROLE service_role;SELECT public.purge_expired_y_sheets_trash()')
  self.assertEqual(value(f"SELECT state FROM y_sheets_private.trash_entries WHERE id='{expired}'"),'purged');self.assertEqual(value(f"SELECT state FROM y_sheets_private.trash_entries WHERE id='{live}'"),'trashed');self.assertEqual(value(f"SELECT state FROM y_sheets_private.trash_entries WHERE id='{restored}'"),'restored')
 def test_concurrent_restore_and_purge_have_one_winner(self):
  id=workbook();e=entry_id(id)
  with ThreadPoolExecutor(2) as pool:results=[f.result() for f in [pool.submit(restore,e,check=False),pool.submit(purge,e,check=False)]]
  self.assertEqual(sum(r.returncode==0 for r in results),1)
  state=value(f"SELECT state FROM y_sheets_private.trash_entries WHERE id='{e}'");self.assertEqual(value(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'"),'1' if state=='restored' else '0')
 def test_restore_then_move_to_shared_folder_reapplies_current_inheritance_only(self):
  p=folder();grant(p);id=workbook();e=entry_id(id);restore(e);self.assertNotEqual(read(id,check=False).returncode,0)
  organize(id,'workbook',revision=1,parent=p);self.assertEqual(json.loads(read(id).stdout)['permission'],'edit')
 def test_audit_has_no_names_or_content_and_failure_rolls_back_archive(self):
  id=workbook('Private secret');
  try:
   run("CREATE FUNCTION public.fail_trash_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='trash_entries' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_trash_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_trash_audit()")
   self.assertNotEqual(trash(id,check=False).returncode,0);self.assertEqual(value(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'"),'1')
  finally:run('DROP TRIGGER fail_trash_audit ON public.audit_events;DROP FUNCTION public.fail_trash_audit()')
  e=entry_id(id);event=value(f"SELECT new_values FROM public.audit_events WHERE entity_id='{e}' ORDER BY occurred_at DESC LIMIT 1")
  self.assertNotIn('Private secret',event);self.assertNotIn('payload',event)
 def test_catalog_private_tables_helpers_and_anonymous_are_denied(self):
  for table in ['trash_entries','lifecycle']:
   self.assertEqual(value(f"SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='y_sheets_private.{table}'::regclass"),'t')
   for role in ['anon','authenticated','service_role']:self.assertEqual(value(f"SELECT has_table_privilege('{role}','y_sheets_private.{table}','SELECT,INSERT,UPDATE,DELETE')"),'f')
  for role in ['anon','service_role']:
   self.assertNotEqual(run(f"SET LOCAL ROLE {role};SELECT public.list_y_sheets_trash('{U}')",check=False).returncode,0)
  self.assertNotEqual(run(f"SELECT y_sheets_private.purge_trash_entry('{uuid.uuid4()}')",U,False).returncode,0)
 def test_waiting_save_cannot_resurrect_file_after_committed_trash(self):
  id=workbook();content=value(f"SELECT content FROM public.y_sheets_workbooks WHERE id='{id}'")
  process=subprocess.Popen(BASE,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  process.stdin.write(f"BEGIN;SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub='{U}';SELECT public.trash_y_sheets('{U}','workbook','{id}',1);SELECT pg_advisory_xact_lock(470055);SELECT pg_sleep(1);COMMIT;");process.stdin.close()
  try:
   deadline=time.monotonic()+8
   while time.monotonic()<deadline:
    if value("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=470055 AND granted")=='1':break
    time.sleep(.02)
   else:self.fail('Trash marker missing')
   self.assertNotEqual(run(f"SELECT public.save_y_sheets_workbook('{id}','{uuid.uuid4()}',1,{sql(content)}::jsonb,'{U}')",U,False).returncode,0)
   process.wait(timeout=8);self.assertEqual(process.returncode,0,process.stderr.read())
  finally:process.wait(timeout=8);process.stdout.close();process.stderr.close()
 def test_restore_audit_failure_keeps_archive_and_rolls_back_every_recreated_row(self):
  p=folder();id=workbook();organize(id,'workbook',parent=p);e=entry_id(p,'folder')
  try:
   run("CREATE FUNCTION public.fail_restore_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='trash_entries' AND NEW.new_values->>'state'='restored' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_restore_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_restore_audit()")
   self.assertNotEqual(restore(e,check=False).returncode,0)
   self.assertEqual(value(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'"),'0');self.assertEqual(value(f"SELECT count(*) FROM public.y_sheets_folders WHERE id='{p}'"),'0')
   self.assertEqual(value(f"SELECT state='trashed' AND payload IS NOT NULL FROM y_sheets_private.trash_entries WHERE id='{e}'"),'t')
  finally:run('DROP TRIGGER fail_restore_audit ON public.audit_events;DROP FUNCTION public.fail_restore_audit()')
